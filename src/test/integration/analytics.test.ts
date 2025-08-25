import { resetEnv } from '../../config/env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Analytics Integration Tests', () => {
  beforeEach(async () => {
    // Reset environment to test defaults
    resetEnv();
    
    // Clean database
    await prisma.user.deleteMany();
    await prisma.analyticsEvent.deleteMany();
    await prisma.analyticsReport.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Add test cases here
});
