import { db } from '../../lib/db';
import { redis } from '../../lib/redis';
import logger from '../../utils/logger';

interface AIUsageData {
  userId: string;
  model: string;
  prompt: string;
  responseTokens: number;
  promptTokens: number;
  latency: number;
  error?: string;
}

interface CommandUsageData {
  userId: string;
  command: string;
  arguments?: string[];
  duration: number;
  success: boolean;
  error?: string;
}

class UsageTrackingService {
  private static instance: UsageTrackingService;

  private constructor() {}

  public static getInstance(): UsageTrackingService {
    if (!UsageTrackingService.instance) {
      UsageTrackingService.instance = new UsageTrackingService();
    }
    return UsageTrackingService.instance;
  }

  // Track AI request
  public async trackAIUsage(data: AIUsageData): Promise<void> {
    try {
      // Store in database
      await db.aiUsage.create({
        data: {
          userId: data.userId,
          model: data.model,
          prompt: data.prompt,
          responseTokens: data.responseTokens,
          promptTokens: data.promptTokens,
          latency: data.latency,
          error: data.error,
          timestamp: new Date(),
        },
      });

      // Update user's usage metrics in Redis
      const userKey = `user:${data.userId}:ai_usage`;
      const pipe = redis.pipeline();

      // Increment daily usage
      const today = new Date().toISOString().split('T')[0];
      pipe.hincrby(`${userKey}:${today}`, 'requests', 1);
      pipe.hincrby(`${userKey}:${today}`, 'tokens', data.promptTokens + data.responseTokens);

      // Update rate tracking
      pipe.incr(`${userKey}:rate:${Math.floor(Date.now() / 1000)}`);
      pipe.expire(`${userKey}:rate:${Math.floor(Date.now() / 1000)}`, 3600);

      await pipe.exec();
    } catch (error) {
      logger.error('Failed to track AI usage:', error);
    }
  }

  // Track terminal command
  public async trackCommandUsage(data: CommandUsageData): Promise<void> {
    try {
      // Store in database
      await db.commandUsage.create({
        data: {
          userId: data.userId,
          command: data.command,
          arguments: data.arguments,
          duration: data.duration,
          success: data.success,
          error: data.error,
          timestamp: new Date(),
        },
      });

      // Update command statistics in Redis
      const commandKey = `command:${data.command}`;
      const pipe = redis.pipeline();

      // Increment usage count
      pipe.hincrby(commandKey, 'total_uses', 1);
      pipe.hincrby(commandKey, data.success ? 'successful' : 'failed', 1);

      // Update average duration
      pipe.hget(commandKey, 'avg_duration').then(avg => {
        const currentAvg = parseFloat(avg || '0');
        const currentCount = parseInt(await redis.hget(commandKey, 'total_uses') || '0');
        const newAvg = (currentAvg * (currentCount - 1) + data.duration) / currentCount;
        pipe.hset(commandKey, 'avg_duration', newAvg.toString());
      });

      // Record in time series
      const timeKey = `${commandKey}:time:${Math.floor(Date.now() / 3600000)}`; // Hourly buckets
      pipe.hincrby(timeKey, 'count', 1);
      pipe.expire(timeKey, 86400); // Keep for 24 hours

      await pipe.exec();

      // Update user's command history
      await redis.lpush(
        `user:${data.userId}:command_history`,
        JSON.stringify({
          command: data.command,
          arguments: data.arguments,
          timestamp: Date.now(),
          success: data.success,
        })
      );
      await redis.ltrim(`user:${data.userId}:command_history`, 0, 99); // Keep last 100 commands
    } catch (error) {
      logger.error('Failed to track command usage:', error);
    }
  }

  // Get user's AI usage statistics
  public async getAIUsageStats(userId: string): Promise<{
    dailyRequests: number;
    dailyTokens: number;
    currentRate: number;
  }> {
    try {
      const userKey = `user:${userId}:ai_usage`;
      const today = new Date().toISOString().split('T')[0];

      // Get daily stats
      const dailyStats = await redis.hgetall(`${userKey}:${today}`);
      const dailyRequests = parseInt(dailyStats.requests || '0');
      const dailyTokens = parseInt(dailyStats.tokens || '0');

      // Calculate current rate (requests in last minute)
      const now = Math.floor(Date.now() / 1000);
      const ratePromises = [];
      for (let i = 0; i < 60; i++) {
        ratePromises.push(redis.get(`${userKey}:rate:${now - i}`));
      }
      const rates = await Promise.all(ratePromises);
      const currentRate = rates.reduce((sum, rate) => sum + parseInt(rate || '0'), 0);

      return {
        dailyRequests,
        dailyTokens,
        currentRate,
      };
    } catch (error) {
      logger.error('Failed to get AI usage stats:', error);
      return {
        dailyRequests: 0,
        dailyTokens: 0,
        currentRate: 0,
      };
    }
  }

  // Get command usage statistics
  public async getCommandStats(command: string): Promise<{
    totalUses: number;
    successRate: number;
    avgDuration: number;
    recentUsage: { time: number; count: number }[];
  }> {
    try {
      const commandKey = `command:${command}`;

      // Get basic stats
      const stats = await redis.hgetall(commandKey);
      const totalUses = parseInt(stats.total_uses || '0');
      const successful = parseInt(stats.successful || '0');
      const avgDuration = parseFloat(stats.avg_duration || '0');

      // Get recent usage (last 24 hours)
      const now = Math.floor(Date.now() / 3600000);
      const recentUsage = [];
      for (let i = 0; i < 24; i++) {
        const timeKey = `${commandKey}:time:${now - i}`;
        const count = parseInt((await redis.hget(timeKey, 'count')) || '0');
        recentUsage.push({
          time: (now - i) * 3600000,
          count,
        });
      }

      return {
        totalUses,
        successRate: totalUses > 0 ? (successful / totalUses) * 100 : 0,
        avgDuration,
        recentUsage: recentUsage.reverse(),
      };
    } catch (error) {
      logger.error('Failed to get command stats:', error);
      return {
        totalUses: 0,
        successRate: 0,
        avgDuration: 0,
        recentUsage: [],
      };
    }
  }
}

export default UsageTrackingService.getInstance();
