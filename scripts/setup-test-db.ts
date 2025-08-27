import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function setupTestDatabase() {
  const DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/rinawarp_test';
  
  try {
    // Create test database if it doesn't exist
    await execAsync(`psql -c 'CREATE DATABASE rinawarp_test;' -U postgres`);
    console.log('Test database created successfully');
  } catch (error) {
    if (!(error as any).message.includes('already exists')) {
      console.error('Error creating test database:', error);
      process.exit(1);
    }
  }

  // Initialize Prisma client with test database
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL,
      },
    },
  });

  try {
    // Run migrations on test database
    await execAsync('npx prisma migrate reset --force --skip-generate --skip-seed');
    console.log('Test database migrations applied successfully');

    // Create any necessary extensions
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    console.log('Database extensions created successfully');

    await prisma.$disconnect();
    console.log('Test database setup completed successfully');
  } catch (error) {
    console.error('Error setting up test database:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

setupTestDatabase();
