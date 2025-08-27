import { PrismaClient, User, SubscriptionTier, UserSubscription } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

export async function createTestUser(
  overrides: Partial<User> = {}
): Promise<User> {
const defaultUser: Partial<User> = {
    email: 'test@example.com',
    name: 'Test User',
    hashedPassword: await hash('password123', 10),
role: 'USER' as const,
  };

  return prisma.user.create({
    data: {
      ...defaultUser,
      ...overrides,
    },
  });
}

export async function createTestTier(
  overrides: Partial<SubscriptionTier> = {}
): Promise<SubscriptionTier> {
const defaultTier: Partial<SubscriptionTier> = {
    name: 'Basic',
    description: 'Basic tier',
    price: 9.99,
    currency: 'usd',
interval: 'MONTHLY' as const,
    features: {},
    active: true,
  };

  return prisma.subscriptionTier.create({
    data: {
      ...defaultTier,
      ...overrides,
    },
  });
}

export async function createTestSubscription(
  userId: string,
  tierId: string,
  overrides: Partial<UserSubscription> = {}
): Promise<UserSubscription> {
const defaultSubscription: Partial<UserSubscription> = {
    userId,
    tierId,
status: 'ACTIVE' as const,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    stripeSubscriptionId: 'test_sub_id',
  };

  return prisma.userSubscription.create({
    data: {
      ...defaultSubscription,
      ...overrides,
    },
  });
}

export async function clearDatabase() {
  const tables = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  for (const { tablename } of tables) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "public"."${tablename}" CASCADE;`
      );
    }
  }
}
