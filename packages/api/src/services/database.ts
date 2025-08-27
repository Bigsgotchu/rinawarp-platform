import prisma from '../lib/prisma';
import { User, SubscriptionTier, UserSubscription, UsageRecord } from '@prisma/client';

export class DatabaseService {
  // User operations
  async createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
    return prisma.user.create({ data });
  }

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
        emailPreferences: true,
      },
    });
  }

  async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        subscription: true,
        emailPreferences: true,
      },
    });
  }

  // Subscription operations
  async createSubscription(data: Omit<UserSubscription, 'id' | 'createdAt' | 'updatedAt'>) {
    return prisma.userSubscription.create({ data });
  }

  async getSubscriptionByUserId(userId: string) {
    return prisma.userSubscription.findUnique({
      where: { userId },
      include: {
        tier: true,
      },
    });
  }

  // Usage tracking
  async createUsageRecord(data: Omit<UsageRecord, 'id' | 'createdAt'>) {
    return prisma.usageRecord.create({ data });
  }

  async getUserUsage(userId: string, startDate: Date, endDate: Date) {
    return prisma.usageRecord.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  }

  // Subscription tiers
  async getActiveTiers() {
    return prisma.subscriptionTier.findMany({
      where: { active: true },
    });
  }

  async getTierById(id: string) {
    return prisma.subscriptionTier.findUnique({
      where: { id },
    });
  }
}
