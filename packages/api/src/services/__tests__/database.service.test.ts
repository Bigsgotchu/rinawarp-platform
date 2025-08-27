import { DatabaseService } from '../database';
import {
  createTestUser,
  createTestTier,
  createTestSubscription,
} from '../../test/helpers';
import prisma from '../../lib/prisma';

describe('DatabaseService', () => {
  const dbService = new DatabaseService();

  describe('user operations', () => {
    it('should create a user', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        hashedPassword: 'hashed_password',
        role: 'USER',
      };

      const user = await dbService.createUser(userData);

      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
    });

    it('should get user by id', async () => {
      const createdUser = await createTestUser();
      const user = await dbService.getUserById(createdUser.id);

      expect(user).toBeDefined();
      expect(user?.id).toBe(createdUser.id);
      expect(user?.email).toBe(createdUser.email);
    });

    it('should get user by email', async () => {
      const createdUser = await createTestUser();
      const user = await dbService.getUserByEmail(createdUser.email);

      expect(user).toBeDefined();
      expect(user?.id).toBe(createdUser.id);
      expect(user?.email).toBe(createdUser.email);
    });
  });

  describe('subscription operations', () => {
    it('should create a subscription', async () => {
      const user = await createTestUser();
      const tier = await createTestTier();

      const subscriptionData = {
        userId: user.id,
        tierId: tier.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        stripeSubscriptionId: 'test_sub_id',
      };

      const subscription = await dbService.createSubscription(subscriptionData);

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe(user.id);
      expect(subscription.tierId).toBe(tier.id);
    });

    it('should get subscription by user id', async () => {
      const user = await createTestUser();
      const tier = await createTestTier();
      const createdSubscription = await createTestSubscription(user.id, tier.id);

      const subscription = await dbService.getSubscriptionByUserId(user.id);

      expect(subscription).toBeDefined();
      expect(subscription?.id).toBe(createdSubscription.id);
      expect(subscription?.tier).toBeDefined();
      expect(subscription?.tier.id).toBe(tier.id);
    });
  });

  describe('usage tracking', () => {
    it('should create a usage record', async () => {
      const user = await createTestUser();
      const usageData = {
        userId: user.id,
        type: 'API_REQUEST',
        quantity: 1,
      };

      const usage = await dbService.createUsageRecord(usageData);

      expect(usage).toBeDefined();
      expect(usage.userId).toBe(user.id);
      expect(usage.type).toBe(usageData.type);
      expect(usage.quantity).toBe(usageData.quantity);
    });

    it('should get user usage for date range', async () => {
      const user = await createTestUser();
      const usageData = {
        userId: user.id,
        type: 'API_REQUEST',
        quantity: 1,
      };

      await dbService.createUsageRecord(usageData);

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now

      const usage = await dbService.getUserUsage(user.id, startDate, endDate);

      expect(usage).toBeDefined();
      expect(usage.length).toBe(1);
      expect(usage[0].userId).toBe(user.id);
      expect(usage[0].type).toBe(usageData.type);
    });
  });
});
