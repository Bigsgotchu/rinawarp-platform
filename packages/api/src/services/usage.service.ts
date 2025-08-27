import { UsageRecord, UsageType } from '@prisma/client';
import prisma from '../lib/prisma';
import { APIError } from '../middleware/error-handler';

export interface UsageSummary {
  total: number;
  byType: Record<UsageType, number>;
  periodStart: Date;
  periodEnd: Date;
}

export class UsageService {
  async trackUsage(
    userId: string,
    type: UsageType,
    quantity: number,
    metadata?: any
  ): Promise<UsageRecord> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new APIError(404, 'User not found');
    }

    // Check if user has reached their usage limit
    const currentPeriodUsage = await this.getCurrentPeriodUsage(userId);
    const usageLimit = this.getUsageLimit(user.subscription?.tierId);

    if (usageLimit && currentPeriodUsage.total + quantity > usageLimit) {
      throw new APIError(403, 'Usage limit exceeded');
    }

    return prisma.usageRecord.create({
      data: {
        userId,
        type,
        quantity,
        metadata,
      },
    });
  }

  async getCurrentPeriodUsage(userId: string): Promise<UsageSummary> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new APIError(404, 'User not found');
    }

    const periodStart = user.subscription?.currentPeriodStart || new Date();
    const periodEnd = user.subscription?.currentPeriodEnd || new Date();

    const records = await prisma.usageRecord.findMany({
      where: {
        userId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const byType = records.reduce((acc, record) => {
      acc[record.type] = (acc[record.type] || 0) + record.quantity;
      return acc;
    }, {} as Record<UsageType, number>);

    const total = records.reduce((sum, record) => sum + record.quantity, 0);

    return {
      total,
      byType,
      periodStart,
      periodEnd,
    };
  }

  async getUsageHistory(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageRecord[]> {
    return prisma.usageRecord.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private getUsageLimit(tierId?: string): number | null {
    // This should be replaced with actual tier limits from your subscription tiers
    const tierLimits: Record<string, number> = {
      'free': 1000,
      'basic': 10000,
      'pro': 50000,
      'enterprise': Infinity,
    };

    return tierId ? tierLimits[tierId] || null : null;
  }
}
