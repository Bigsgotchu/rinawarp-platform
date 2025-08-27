import { PrismaClient } from '@prisma/client';
import { logger } from '@rinawarp/shared';

const prisma = new PrismaClient();

export { prisma };

// Configure logging after Prisma client is initialized
if (process.env.NODE_ENV !== 'production') {
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    logger.debug(`Query ${params.model}.${params.action} took ${after - before}ms`);
    return result;
  });
}

if (process.env.NODE_ENV !== 'production') {
  (global as any).prisma = prisma;
}
