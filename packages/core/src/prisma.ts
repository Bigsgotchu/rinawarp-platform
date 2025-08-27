import { PrismaClient } from '@prisma/client';
import { logger } from '@rinawarp/shared';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;

  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    logger.debug(`Query ${params.model}.${params.action} took ${after - before}ms`);
    return result;
  });
}
