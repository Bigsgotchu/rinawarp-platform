import Redis from 'ioredis';
import { Command, CommandResult, CommandContext } from '../types';
import logger from '../utils/logger';

class CommandLearningService {
  private redis: Redis;
  private readonly COMMAND_PATTERNS_KEY = 'command_patterns';
  private readonly COMMAND_CONTEXT_KEY = 'command_contexts';
  private readonly MAX_PATTERNS = 1000;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async learnFromCommand(
    command: Command,
    result: CommandResult,
    context: CommandContext
  ): Promise<void> {
    try {
      const pattern = this.extractPattern(command);
      const contextKey = `${this.COMMAND_CONTEXT_KEY}:${pattern}`;

      // Store successful command pattern
      if (result.exitCode === 0) {
        await this.redis.zincrby(this.COMMAND_PATTERNS_KEY, 1, pattern);

        // Store context for successful command
        await this.redis.lpush(
          contextKey,
          JSON.stringify({
            ...context,
            timestamp: new Date().toISOString(),
          })
        );

        // Trim context list
        await this.redis.ltrim(contextKey, 0, 99); // Keep last 100 contexts
      }

      // Trim patterns to prevent unlimited growth
      const patternCount = await this.redis.zcard(this.COMMAND_PATTERNS_KEY);
      if (patternCount > this.MAX_PATTERNS) {
        await this.redis.zremrangebyrank(
          this.COMMAND_PATTERNS_KEY,
          0,
          patternCount - this.MAX_PATTERNS - 1
        );
      }
    } catch (error) {
      logger.error('Failed to learn from command:', error);
    }
  }

  async getSimilarPatterns(command: Command): Promise<string[]> {
    try {
      const pattern = this.extractPattern(command);
      const results = await this.redis.zrevrangebyscore(
        this.COMMAND_PATTERNS_KEY,
        '+inf',
        '-inf',
        'LIMIT',
        0,
        5
      );

      return results.filter(p => this.patternSimilarity(pattern, p) > 0.5);
    } catch (error) {
      logger.error('Failed to get similar patterns:', error);
      return [];
    }
  }

  async getContextualSuggestions(
    command: Command,
    context: CommandContext
  ): Promise<string[]> {
    try {
      const similarPatterns = await this.getSimilarPatterns(command);
      const suggestions: string[] = [];

      for (const pattern of similarPatterns) {
        const contextKey = `${this.COMMAND_CONTEXT_KEY}:${pattern}`;
        const contexts = await this.redis.lrange(contextKey, 0, 9);

        for (const ctx of contexts) {
          const storedContext = JSON.parse(ctx);
          if (this.contextMatch(context, storedContext)) {
            suggestions.push(pattern);
            break;
          }
        }
      }

      return suggestions;
    } catch (error) {
      logger.error('Failed to get contextual suggestions:', error);
      return [];
    }
  }

  private extractPattern(command: Command): string {
    // Convert command and args to a pattern
    // e.g., "git commit -m" becomes "git:commit:-m:*"
    const parts = [command.command];
    if (command.args) {
      for (const arg of command.args) {
        if (arg.startsWith('-')) {
          parts.push(arg);
        } else {
          parts.push('*');
        }
      }
    }
    return parts.join(':');
  }

  private patternSimilarity(pattern1: string, pattern2: string): number {
    const parts1 = pattern1.split(':');
    const parts2 = pattern2.split(':');

    // Simple Jaccard similarity
    const set1 = new Set(parts1);
    const set2 = new Set(parts2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private contextMatch(
    context1: CommandContext,
    context2: CommandContext
  ): boolean {
    // Consider contexts similar if they share the same directory or have similar previous commands
    return (
      context1.currentDirectory === context2.currentDirectory ||
      (context1.previousCommands &&
        context2.previousCommands &&
        this.arrayIntersection(
          context1.previousCommands,
          context2.previousCommands
        ).length > 0)
    );
  }

  private arrayIntersection<T>(arr1: T[], arr2: T[]): T[] {
    const set2 = new Set(arr2);
    return arr1.filter(x => set2.has(x));
  }
}

export default new CommandLearningService();
