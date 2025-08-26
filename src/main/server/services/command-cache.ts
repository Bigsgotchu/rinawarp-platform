import { CacheService } from './cache';
import { CommandResult } from './command';
import { logger } from '../../utils/logger';
import * as crypto from 'crypto';

export interface CacheConfig {
  ttl: number; // Cache TTL in seconds
  maxSize: number; // Maximum number of entries to cache
  allowedCommands: string[]; // List of commands that can be cached
}

export class CommandCacheService {
  private cache: CacheService;
  private config: CacheConfig;
  private readonly cachePrefix = 'cmd:';

  constructor(config?: Partial<CacheConfig>) {
    this.cache = new CacheService();
    this.config = {
      ttl: 3600, // 1 hour
      maxSize: 1000, // 1000 entries
      allowedCommands: [
        // Safe, read-only commands
        'git status',
        'git log',
        'git branch',
        'ls',
        'pwd',
        'whoami',
        'df',
        'du',
        'ps',
        'top',
        'htop',
        'free',
        'uptime',
        'date',
      ],
      ...config,
    };
  }

  /**
   * Check if command can be cached
   */
  public canCache(command: string): boolean {
    return this.config.allowedCommands.some(allowed =>
      command.startsWith(allowed)
    );
  }

  /**
   * Get cached result
   */
  public async get(
    command: string,
    cwd: string
  ): Promise<CommandResult | null> {
    try {
      if (!this.canCache(command)) {
        return null;
      }

      const key = this.getCacheKey(command, cwd);
      return await this.cache.get<CommandResult>(key);
    } catch (error) {
      logger.error('Failed to get cached command:', error);
      return null;
    }
  }

  /**
   * Cache command result
   */
  public async set(
    command: string,
    cwd: string,
    result: CommandResult
  ): Promise<void> {
    try {
      if (!this.canCache(command)) {
        return;
      }

      const key = this.getCacheKey(command, cwd);
      await this.cache.set(key, result, this.config.ttl);

      // Track cache size
      await this.trackCacheSize();
    } catch (error) {
      logger.error('Failed to cache command:', error);
    }
  }

  /**
   * Clear cached result
   */
  public async clear(command: string, cwd: string): Promise<void> {
    try {
      const key = this.getCacheKey(command, cwd);
      await this.cache.delete(key);
    } catch (error) {
      logger.error('Failed to clear cached command:', error);
    }
  }

  /**
   * Clear all cached results
   */
  public async clearAll(): Promise<void> {
    try {
      await this.cache.clear();
    } catch (error) {
      logger.error('Failed to clear command cache:', error);
    }
  }

  /**
   * Get cache key
   */
  private getCacheKey(command: string, cwd: string): string {
    // Create hash of command and cwd to avoid key length issues
    const hash = crypto
      .createHash('sha256')
      .update(`${command}:${cwd}`)
      .digest('hex');

    return `${this.cachePrefix}${hash}`;
  }

  /**
   * Track and manage cache size
   */
  private async trackCacheSize(): Promise<void> {
    try {
      const stats = await this.cache.getStats();

      // If cache is too large, remove oldest entries
      if (stats.keys > this.config.maxSize) {
        // Get all command cache keys
        const keys = await this.getAllCacheKeys();

        // Sort by access time and remove oldest
        const toRemove = keys
          .sort((a, b) => a.accessTime - b.accessTime)
          .slice(0, keys.length - this.config.maxSize)
          .map(k => k.key);

        // Remove old entries
        await this.cache.mdelete(toRemove);
      }
    } catch (error) {
      logger.error('Failed to track cache size:', error);
    }
  }

  /**
   * Get all cache keys with access times
   */
  private async getAllCacheKeys(): Promise<
    Array<{
      key: string;
      accessTime: number;
    }>
  > {
    try {
      // This is a placeholder - actual implementation would depend
      // on the cache backend's capabilities
      return [];
    } catch (error) {
      logger.error('Failed to get cache keys:', error);
      return [];
    }
  }

  /**
   * Get cache stats
   */
  public async getStats(): Promise<{
    size: number;
    hits: number;
    misses: number;
  }> {
    try {
      const stats = await this.cache.getStats();
      return {
        size: stats.keys,
        hits: stats.hits,
        misses: stats.misses,
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        size: 0,
        hits: 0,
        misses: 0,
      };
    }
  }

  /**
   * Preload common commands
   */
  public async preload(cwd: string): Promise<void> {
    try {
      const commands = ['git status', 'git branch', 'ls -la'];

      for (const command of commands) {
        if (this.canCache(command)) {
          // Execute and cache command
          // This would be implemented based on your command execution service
          logger.info(`Preloading command: ${command}`);
        }
      }
    } catch (error) {
      logger.error('Failed to preload commands:', error);
    }
  }
}
