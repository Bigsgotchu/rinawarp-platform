import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '@rinawarp/shared';

interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  rules: FeatureFlagRule[];
}

interface FeatureFlagRule {
  type: 'user' | 'group' | 'percentage' | 'environment';
  value: string | number;
}

export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private prisma: PrismaClient;
  private redis: Redis;
  private logger: Logger;
  private cache: Map<string, FeatureFlag> = new Map();
  private cacheTimeout = 60 * 1000; // 1 minute
  private lastCacheUpdate = 0;

  private constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis(process.env.REDIS_URL || '');
    this.logger = new Logger('FeatureFlagService');
  }

  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  public async isFeatureEnabled(
    featureName: string,
    context: {
      userId?: string;
      groupIds?: string[];
      environment?: string;
    }
  ): Promise<boolean> {
    try {
      const feature = await this.getFeatureFlag(featureName);
      if (!feature) {
        return false;
      }

      if (!feature.enabled) {
        return false;
      }

      // Check rules
      for (const rule of feature.rules) {
        switch (rule.type) {
          case 'user':
            if (context.userId && rule.value === context.userId) {
              return true;
            }
            break;
          case 'group':
            if (context.groupIds?.includes(rule.value as string)) {
              return true;
            }
            break;
          case 'environment':
            if (context.environment && rule.value === context.environment) {
              return true;
            }
            break;
          case 'percentage':
            const percentage = rule.value as number;
            if (this.isUserInPercentage(context.userId || '', percentage)) {
              return true;
            }
            break;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Error checking feature flag', { error, featureName });
      return false;
    }
  }

  private async getFeatureFlag(name: string): Promise<FeatureFlag | null> {
    try {
      // Check memory cache first
      if (this.shouldUseCache()) {
        const cachedFeature = this.cache.get(name);
        if (cachedFeature) {
          return cachedFeature;
        }
      }

      // Check Redis cache
      const redisKey = `feature_flag:${name}`;
      const cachedData = await this.redis.get(redisKey);
      if (cachedData) {
        const feature = JSON.parse(cachedData);
        this.cache.set(name, feature);
        return feature;
      }

      // Get from database
      const feature = await this.prisma.featureFlag.findUnique({
        where: { name },
        include: { rules: true }
      });

      if (!feature) {
        return null;
      }

      const featureFlag: FeatureFlag = {
        name: feature.name,
        description: feature.description,
        enabled: feature.enabled,
        rules: feature.rules.map(r => ({
          type: r.type as 'user' | 'group' | 'percentage' | 'environment',
          value: r.value
        }))
      };

      // Update caches
      await this.redis.set(redisKey, JSON.stringify(featureFlag), 'EX', 300); // 5 minutes
      this.cache.set(name, featureFlag);
      this.lastCacheUpdate = Date.now();

      return featureFlag;
    } catch (error) {
      this.logger.error('Error fetching feature flag', { error, name });
      return null;
    }
  }

  private shouldUseCache(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheTimeout;
  }

  private isUserInPercentage(userId: string, percentage: number): boolean {
    // Use consistent hashing to ensure the same user always gets the same result
    const hash = this.hashString(userId);
    const normalized = hash % 100;
    return normalized < percentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  public async createFeatureFlag(flag: Omit<FeatureFlag, 'rules'> & { rules: Omit<FeatureFlagRule, 'id'>[] }) {
    try {
      const created = await this.prisma.featureFlag.create({
        data: {
          name: flag.name,
          description: flag.description,
          enabled: flag.enabled,
          rules: {
            create: flag.rules
          }
        },
        include: { rules: true }
      });

      // Clear caches
      await this.redis.del(`feature_flag:${flag.name}`);
      this.cache.delete(flag.name);

      return created;
    } catch (error) {
      this.logger.error('Error creating feature flag', { error, flag });
      throw error;
    }
  }

  public async updateFeatureFlag(name: string, updates: Partial<FeatureFlag>) {
    try {
      const updated = await this.prisma.featureFlag.update({
        where: { name },
        data: {
          description: updates.description,
          enabled: updates.enabled,
          rules: updates.rules ? {
            deleteMany: {},
            create: updates.rules
          } : undefined
        },
        include: { rules: true }
      });

      // Clear caches
      await this.redis.del(`feature_flag:${name}`);
      this.cache.delete(name);

      return updated;
    } catch (error) {
      this.logger.error('Error updating feature flag', { error, name, updates });
      throw error;
    }
  }
}
