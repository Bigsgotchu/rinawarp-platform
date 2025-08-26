import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger';
import { db } from '../database';
import { CacheService } from './cache';

const execAsync = promisify(exec);

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface CommandStats {
  totalCommands: number;
  averageDuration: number;
  successRate: number;
  commonCommands: Array<{
    command: string;
    count: number;
  }>;
}

export class CommandService {
  private cache: CacheService;
  private readonly statsPrefix = 'command_stats:';

  constructor() {
    this.cache = new CacheService();
  }

  /**
   * Execute command
   */
  public async execute(
    command: string,
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      userId?: string;
    } = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // Prepare execution options
      const execOptions: ExecOptions = {
        cwd: options.cwd || process.cwd(),
        env: {
          ...process.env,
          ...options.env,
        },
        timeout: options.timeout || 30000, // 30 seconds default timeout
      };

      // Execute command
      const { stdout, stderr } = await execAsync(command, execOptions);
      const duration = Date.now() - startTime;
      const exitCode = 0; // Success

      // Track command execution
      await this.trackExecution(command, {
        userId: options.userId,
        duration,
        exitCode,
        cwd: execOptions.cwd,
      });

      return {
        stdout,
        stderr,
        exitCode,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const exitCode = error.code || 1;

      // Track failed execution
      await this.trackExecution(command, {
        userId: options.userId,
        duration,
        exitCode,
        cwd: options.cwd || process.cwd(),
      });

      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode,
        duration,
      };
    }
  }

  /**
   * Track command execution
   */
  private async trackExecution(
    command: string,
    details: {
      userId?: string;
      duration: number;
      exitCode: number;
      cwd: string;
    }
  ): Promise<void> {
    try {
      // Store in command history
      if (details.userId) {
        await db.commandHistory.create({
          userId: details.userId,
          command,
          directory: details.cwd,
          exitCode: details.exitCode,
          duration: details.duration,
        });

        // Update user stats
        await this.updateUserStats(details.userId, command, details);
      }

      // Update global stats
      await this.updateGlobalStats(command, details);
    } catch (error) {
      logger.error('Failed to track command execution:', error);
    }
  }

  /**
   * Update user command stats
   */
  private async updateUserStats(
    userId: string,
    command: string,
    details: {
      duration: number;
      exitCode: number;
    }
  ): Promise<void> {
    try {
      const cacheKey = `${this.statsPrefix}user:${userId}`;
      const stats = await this.getStats(cacheKey);

      // Update stats
      stats.totalCommands++;
      stats.averageDuration =
        (stats.averageDuration * (stats.totalCommands - 1) + details.duration) /
        stats.totalCommands;
      stats.successRate =
        (stats.successRate * (stats.totalCommands - 1) +
          (details.exitCode === 0 ? 1 : 0)) /
        stats.totalCommands;

      // Update common commands
      const commandEntry = stats.commonCommands.find(
        c => c.command === command
      );
      if (commandEntry) {
        commandEntry.count++;
      } else {
        stats.commonCommands.push({ command, count: 1 });
        stats.commonCommands.sort((a, b) => b.count - a.count);
        stats.commonCommands = stats.commonCommands.slice(0, 10); // Keep top 10
      }

      // Cache updated stats
      await this.cache.set(cacheKey, stats, 24 * 3600); // 24 hours
    } catch (error) {
      logger.error('Failed to update user stats:', error);
    }
  }

  /**
   * Update global command stats
   */
  private async updateGlobalStats(
    command: string,
    details: {
      duration: number;
      exitCode: number;
    }
  ): Promise<void> {
    try {
      const cacheKey = `${this.statsPrefix}global`;
      const stats = await this.getStats(cacheKey);

      // Update stats
      stats.totalCommands++;
      stats.averageDuration =
        (stats.averageDuration * (stats.totalCommands - 1) + details.duration) /
        stats.totalCommands;
      stats.successRate =
        (stats.successRate * (stats.totalCommands - 1) +
          (details.exitCode === 0 ? 1 : 0)) /
        stats.totalCommands;

      // Update common commands
      const commandEntry = stats.commonCommands.find(
        c => c.command === command
      );
      if (commandEntry) {
        commandEntry.count++;
      } else {
        stats.commonCommands.push({ command, count: 1 });
        stats.commonCommands.sort((a, b) => b.count - a.count);
        stats.commonCommands = stats.commonCommands.slice(0, 10); // Keep top 10
      }

      // Cache updated stats
      await this.cache.set(cacheKey, stats, 24 * 3600); // 24 hours
    } catch (error) {
      logger.error('Failed to update global stats:', error);
    }
  }

  /**
   * Get command stats
   */
  private async getStats(cacheKey: string): Promise<CommandStats> {
    try {
      // Try to get from cache
      const cached = await this.cache.get<CommandStats>(cacheKey);
      if (cached) {
        return cached;
      }

      // Return default stats
      return {
        totalCommands: 0,
        averageDuration: 0,
        successRate: 1,
        commonCommands: [],
      };
    } catch (error) {
      logger.error('Failed to get command stats:', error);
      return {
        totalCommands: 0,
        averageDuration: 0,
        successRate: 1,
        commonCommands: [],
      };
    }
  }

  /**
   * Get user command stats
   */
  public async getUserStats(userId: string): Promise<CommandStats> {
    return this.getStats(`${this.statsPrefix}user:${userId}`);
  }

  /**
   * Get global command stats
   */
  public async getGlobalStats(): Promise<CommandStats> {
    return this.getStats(`${this.statsPrefix}global`);
  }

  /**
   * Get command suggestions based on history
   */
  public async getSuggestions(
    userId: string,
    partial: string,
    cwd: string
  ): Promise<string[]> {
    try {
      // Get user's command history
      const history = await db.commandHistory.findMany({
        userId,
        command: { $regex: `^${partial}` },
        directory: cwd,
        limit: 5,
        sort: { createdAt: -1 },
      });

      // Get global suggestions
      const globalHistory = await db.commandHistory.findMany({
        command: { $regex: `^${partial}` },
        directory: cwd,
        limit: 5,
        sort: { count: -1 },
      });

      // Combine and deduplicate suggestions
      const suggestions = new Set([
        ...history.map(h => h.command),
        ...globalHistory.map(h => h.command),
      ]);

      return Array.from(suggestions);
    } catch (error) {
      logger.error('Failed to get command suggestions:', error);
      return [];
    }
  }

  /**
   * Validate command
   */
  public validateCommand(command: string): boolean {
    // TODO: Implement command validation
    // This could check for dangerous commands, required permissions, etc.
    return true;
  }

  /**
   * Parse command
   */
  public parseCommand(command: string): {
    command: string;
    args: string[];
    options: Record<string, string>;
  } {
    // TODO: Implement proper command parsing
    const parts = command.split(' ');
    return {
      command: parts[0],
      args: parts.slice(1),
      options: {},
    };
  }
}
