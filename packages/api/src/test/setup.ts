import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';
import { URL } from 'url';

// Create a test database URL
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/rinawarp_test';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Reset database
  try {
    const url = new URL(process.env.DATABASE_URL);
    const dbName = url.pathname.split('/')[1];
    
    // Drop test database if it exists
    execSync(
      `dropdb --if-exists ${dbName}`,
      { stdio: 'ignore' }
    );

    // Create test database
    execSync(
      `createdb ${dbName}`,
      { stdio: 'ignore' }
    );

    // Run migrations
    execSync(
      'npx prisma migrate reset --force',
      { stdio: 'ignore' }
    );
  } catch (error) {
    console.error('Database setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up tables before each test
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
});
