import { PrismaClient } from '@prisma/client';

const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/rinawarp_test';

// Configure Prisma client for tests
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

export const initializeTestDatabase = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Test database connected successfully');

    // Run any necessary migrations or seed data
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

    return prisma;
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
};

export const closeTestDatabase = async () => {
  await prisma.$disconnect();
};

export { prisma };
