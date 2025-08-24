import { User, UserStatus, UserRole, UserPreferences } from '../types/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import db from '../utils/db';
import { Prisma } from '@prisma/client';

class UserService {
  async getUserProfile(userId: string): Promise<Partial<User>> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          currentPlan: true,
          createdAt: true,
          lastLoginAt: true,
          preferences: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      return user;
    } catch (error) {
      logger.error('Failed to get user profile:', error);
      throw error;
    }
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      email?: string;
      preferences?: UserPreferences;
    }
  ): Promise<Partial<User>> {
    try {
      // Check if email is being updated and is unique
      if (data.email) {
        const existingUser = await db.user.findUnique({
          where: { email: data.email },
        });

        if (existingUser && existingUser.id !== userId) {
          throw new AppError('Email already in use', 'DUPLICATE_EMAIL', 400);
        }
      }

      const user = await db.user.update({
        where: { id: userId },
        data: {
          name: data.name,
          email: data.email,
          preferences: data.preferences as Prisma.JsonValue,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          preferences: true,
        },
      });

      return user;
    } catch (error) {
      logger.error('Failed to update user profile:', error);
      throw error;
    }
  }

  async deleteAccount(userId: string): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
          subscriptionId: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      // Cancel Stripe subscription if exists
      if (user.subscriptionId) {
        await StripeService.cancelSubscription(userId);
      }

      // Delete Stripe customer if exists
      if (user.stripeCustomerId) {
        await StripeService.deleteCustomer(user.stripeCustomerId);
      }

      // Delete user and all related data (cascade delete will handle relations)
      await db.user.delete({
        where: { id: userId },
      });
    } catch (error) {
      logger.error('Failed to delete user account:', error);
      throw error;
    }
  }

  async getUsageMetrics(
    userId: string,
    period: 'daily' | 'monthly' = 'monthly'
  ): Promise<any> {
    try {
      const startDate = new Date();
      if (period === 'monthly') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else {
        startDate.setDate(startDate.getDate() - 1);
      }

      const metrics = await db.usageMetrics.findMany({
        where: {
          userId,
          date: {
            gte: startDate,
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      // Group metrics by type
      const groupedMetrics = metrics.reduce((acc, metric) => {
        if (!acc[metric.metricType]) {
          acc[metric.metricType] = [];
        }
        acc[metric.metricType].push({
          count: metric.count,
          date: metric.date,
        });
        return acc;
      }, {} as Record<string, any[]>);

      return {
        period,
        metrics: groupedMetrics,
      };
    } catch (error) {
      logger.error('Failed to get usage metrics:', error);
      throw error;
    }
  }

  async recordUsage(
    userId: string,
    metricType: string,
    count: number = 1
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Update or create daily metric
      await db.usageMetrics.upsert({
        where: {
          userId_metricType_date: {
            userId,
            metricType,
            date: today,
          },
        },
        update: {
          count: {
            increment: count,
          },
        },
        create: {
          userId,
          metricType,
          count,
          period: 'daily',
          date: today,
        },
      });

      // Update or create monthly metric
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      await db.usageMetrics.upsert({
        where: {
          userId_metricType_date: {
            userId,
            metricType,
            date: monthStart,
          },
        },
        update: {
          count: {
            increment: count,
          },
        },
        create: {
          userId,
          metricType,
          count,
          period: 'monthly',
          date: monthStart,
        },
      });
    } catch (error) {
      logger.error('Failed to record usage:', error);
      throw error;
    }
  }

  async getBillingHistory(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{
    payments: any[];
    total: number;
  }> {
    try {
      const [payments, total] = await Promise.all([
        db.paymentHistory.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.paymentHistory.count({
          where: { userId },
        }),
      ]);

      return {
        payments,
        total,
      };
    } catch (error) {
      logger.error('Failed to get billing history:', error);
      throw error;
    }
  }

  async getSubscriptionHistory(userId: string): Promise<any[]> {
    try {
      const events = await db.subscriptionEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return events;
    } catch (error) {
      logger.error('Failed to get subscription history:', error);
      throw error;
    }
  }

  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      const currentPreferences = (user.preferences as UserPreferences) || {};
      const updatedPreferences = {
        ...currentPreferences,
        ...preferences,
      };

      await db.user.update({
        where: { id: userId },
        data: {
          preferences: updatedPreferences as Prisma.JsonValue,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to update preferences:', error);
      throw error;
    }
  }

  async checkUsageLimit(userId: string, metricType: string): Promise<boolean> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { currentPlan: true },
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const currentUsage = await db.usageMetrics.findFirst({
        where: {
          userId,
          metricType,
          date: {
            gte: monthStart,
          },
          period: 'monthly',
        },
        select: { count: true },
      });

      const limits = {
        FREE: {
          commands_executed: 100,
          workflows_created: 3,
        },
        BASIC: {
          commands_executed: 1000,
          workflows_created: 10,
        },
        PRO: {
          commands_executed: 10000,
          workflows_created: 50,
        },
        ENTERPRISE: {
          commands_executed: -1, // unlimited
          workflows_created: -1, // unlimited
        },
      };

      const limit = limits[user.currentPlan][metricType];
      if (limit === -1) return true; // Unlimited

      const usage = currentUsage?.count || 0;
      return usage < limit;
    } catch (error) {
      logger.error('Failed to check usage limit:', error);
      throw error;
    }
  }
}

export default new UserService();
