import { db } from '../database';
import { CacheService } from './cache';
import { logger } from '../../utils/logger';

export interface CommandHistoryEntry {
  id: string;
  userId: string;
  command: string;
  directory: string;
  exitCode?: number;
  duration?: number;
  timestamp: Date;
  tags?: string[];
}

export interface SearchOptions {
  query?: string; // Search text
  directory?: string; // Specific directory
  limit?: number; // Max results
  offset?: number; // Pagination offset
  tags?: string[]; // Filter by tags
  exitCode?: number; // Filter by exit code
  startDate?: Date; // Filter by date range
  endDate?: Date;
}

export class CommandHistoryService {
  private cache: CacheService;
  private readonly cachePrefix = 'history:';
  private readonly searchCacheTTL = 300; // 5 minutes

  constructor() {
    this.cache = new CacheService();
  }

  /**
   * Add command to history
   */
  public async addCommand(
    userId: string,
    command: string,
    options: {
      directory: string;
      exitCode?: number;
      duration?: number;
      tags?: string[];
    }
  ): Promise<CommandHistoryEntry> {
    try {
      const entry: CommandHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        command,
        directory: options.directory,
        exitCode: options.exitCode,
        duration: options.duration,
        timestamp: new Date(),
        tags: options.tags,
      };

      // Save to database
      await db.commandHistory.create(entry);

      // Invalidate caches
      await this.invalidateUserCaches(userId);

      return entry;
    } catch (error) {
      logger.error('Failed to add command to history:', error);
      throw error;
    }
  }

  /**
   * Search command history
   */
  public async searchHistory(
    userId: string,
    options: SearchOptions = {}
  ): Promise<CommandHistoryEntry[]> {
    try {
      // Try cache first
      const cacheKey = this.getSearchCacheKey(userId, options);
      const cached = await this.cache.get<CommandHistoryEntry[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Build query
      const query: any = { userId };

      if (options.query) {
        query.command = { $regex: options.query, $options: 'i' };
      }

      if (options.directory) {
        query.directory = options.directory;
      }

      if (options.tags?.length) {
        query.tags = { $all: options.tags };
      }

      if (options.exitCode !== undefined) {
        query.exitCode = options.exitCode;
      }

      if (options.startDate || options.endDate) {
        query.timestamp = {};
        if (options.startDate) {
          query.timestamp.$gte = options.startDate;
        }
        if (options.endDate) {
          query.timestamp.$lte = options.endDate;
        }
      }

      // Execute query
      const results = await db.commandHistory.findMany(query, {
        limit: options.limit || 100,
        offset: options.offset || 0,
        sort: { timestamp: -1 },
      });

      // Cache results
      await this.cache.set(cacheKey, results, this.searchCacheTTL);

      return results;
    } catch (error) {
      logger.error('Failed to search command history:', error);
      return [];
    }
  }

  /**
   * Get frequent commands
   */
  public async getFrequentCommands(
    userId: string,
    directory?: string
  ): Promise<
    Array<{
      command: string;
      count: number;
      avgDuration?: number;
      successRate: number;
    }>
  > {
    try {
      const cacheKey = `${this.cachePrefix}frequent:${userId}:${directory || 'all'}`;
      const cached = await this.cache.get<any[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Aggregate command statistics
      const stats = await db.commandHistory.aggregate([
        {
          $match: {
            userId,
            ...(directory ? { directory } : {}),
          },
        },
        {
          $group: {
            _id: '$command',
            count: { $sum: 1 },
            avgDuration: { $avg: '$duration' },
            successCount: {
              $sum: {
                $cond: [{ $eq: ['$exitCode', 0] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            command: '$_id',
            count: 1,
            avgDuration: 1,
            successRate: {
              $divide: ['$successCount', '$count'],
            },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
      ]);

      // Cache results
      await this.cache.set(cacheKey, stats, 3600); // 1 hour

      return stats;
    } catch (error) {
      logger.error('Failed to get frequent commands:', error);
      return [];
    }
  }

  /**
   * Get command suggestions
   */
  public async getCommandSuggestions(
    userId: string,
    partial: string,
    directory?: string
  ): Promise<string[]> {
    try {
      // Get from history
      const history = await this.searchHistory(userId, {
        query: `^${partial}`,
        directory,
        limit: 5,
      });

      // Get frequent commands
      const frequent = await this.getFrequentCommands(userId, directory);

      // Combine and deduplicate
      const suggestions = new Set([
        ...history.map(h => h.command),
        ...frequent
          .filter(f => f.command.startsWith(partial))
          .map(f => f.command),
      ]);

      return Array.from(suggestions);
    } catch (error) {
      logger.error('Failed to get command suggestions:', error);
      return [];
    }
  }

  /**
   * Delete command from history
   */
  public async deleteCommand(userId: string, commandId: string): Promise<void> {
    try {
      await db.commandHistory.delete({
        id: commandId,
        userId,
      });

      // Invalidate caches
      await this.invalidateUserCaches(userId);
    } catch (error) {
      logger.error('Failed to delete command:', error);
      throw error;
    }
  }

  /**
   * Clear user's command history
   */
  public async clearHistory(
    userId: string,
    options: {
      before?: Date;
      directory?: string;
    } = {}
  ): Promise<void> {
    try {
      const query: any = { userId };

      if (options.before) {
        query.timestamp = { $lt: options.before };
      }

      if (options.directory) {
        query.directory = options.directory;
      }

      await db.commandHistory.deleteMany(query);

      // Invalidate caches
      await this.invalidateUserCaches(userId);
    } catch (error) {
      logger.error('Failed to clear command history:', error);
      throw error;
    }
  }

  /**
   * Get search cache key
   */
  private getSearchCacheKey(userId: string, options: SearchOptions): string {
    return `${this.cachePrefix}search:${userId}:${JSON.stringify(options)}`;
  }

  /**
   * Invalidate user caches
   */
  private async invalidateUserCaches(userId: string): Promise<void> {
    try {
      const pattern = `${this.cachePrefix}*:${userId}:*`;
      const keys = await this.cache.mdelete([pattern]);
      logger.debug(
        `Invalidated ${keys.length} cache entries for user ${userId}`
      );
    } catch (error) {
      logger.error('Failed to invalidate user caches:', error);
    }
  }

  /**
   * Get history statistics
   */
  public async getStats(userId: string): Promise<{
    totalCommands: number;
    uniqueCommands: number;
    averageDuration: number;
    successRate: number;
    mostUsedDirectories: Array<{
      directory: string;
      count: number;
    }>;
  }> {
    try {
      const cacheKey = `${this.cachePrefix}stats:${userId}`;
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate statistics
      const stats = await db.commandHistory.aggregate([
        {
          $match: { userId },
        },
        {
          $group: {
            _id: null,
            totalCommands: { $sum: 1 },
            uniqueCommands: { $addToSet: '$command' },
            avgDuration: { $avg: '$duration' },
            successCount: {
              $sum: {
                $cond: [{ $eq: ['$exitCode', 0] }, 1, 0],
              },
            },
            directories: { $addToSet: '$directory' },
          },
        },
        {
          $project: {
            totalCommands: 1,
            uniqueCommands: { $size: '$uniqueCommands' },
            averageDuration: '$avgDuration',
            successRate: {
              $divide: ['$successCount', '$totalCommands'],
            },
          },
        },
      ]);

      // Get most used directories
      const directories = await db.commandHistory.aggregate([
        {
          $match: { userId },
        },
        {
          $group: {
            _id: '$directory',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 5,
        },
        {
          $project: {
            directory: '$_id',
            count: 1,
          },
        },
      ]);

      const result = {
        ...stats[0],
        mostUsedDirectories: directories,
      };

      // Cache results
      await this.cache.set(cacheKey, result, 3600); // 1 hour

      return result;
    } catch (error) {
      logger.error('Failed to get history stats:', error);
      return {
        totalCommands: 0,
        uniqueCommands: 0,
        averageDuration: 0,
        successRate: 0,
        mostUsedDirectories: [],
      };
    }
  }
}
