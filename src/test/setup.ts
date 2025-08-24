import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Clear all test data
export const clearDatabase = async () => {
  const tables = ['User', 'Workflow', 'Analytics', 'Subscription'];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
};

// Create a test user
export const createTestUser = async (
  override: Partial<{ email: string; name: string; role: string }> = {}
) => {
  const defaultUser = {
    email: 'test@example.com',
    name: 'Test User',
    hashedPassword: hashSync('password123', 10),
    role: 'USER',
    ...override,
  };

  const user = await prisma.user.create({
    data: defaultUser,
  });

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

  return { user, token };
};

// Create a test workflow
export const createTestWorkflow = async (userId: string) => {
  return await prisma.workflow.create({
    data: {
      name: 'Test Workflow',
      description: 'Test workflow description',
      steps: [
        {
          type: 'command',
          config: { command: 'echo "test"' },
        },
      ],
      userId,
    },
  });
};

// Create a test subscription
export const createTestSubscription = async (userId: string) => {
  return await prisma.subscription.create({
    data: {
      userId,
      plan: 'basic',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
};

// Test request factory
export const createTestRequest = (
  overrides: Record<string, any> = {}
): Record<string, any> => ({
  body: {},
  query: {},
  params: {},
  headers: {},
  ...overrides,
});

// Test response factory
export const createTestResponse = () => {
  const res: Record<string, any> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

// Mock authenticated request
export const mockAuthRequest = (user: any) => {
  return {
    user,
    headers: {
      authorization: `Bearer test-token`,
    },
  };
};

// Initialize test environment
export const setupTestEnv = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  
  // Clear database
  await clearDatabase();
};

// Cleanup test environment
export const teardownTestEnv = async () => {
  await clearDatabase();
  await prisma.$disconnect();
};

export { prisma };
