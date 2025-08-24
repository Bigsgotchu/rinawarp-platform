import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

let prisma: PrismaClient;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    prisma.$on('query', (e) => {
      logger.debug('Query: ' + e.query);
      logger.debug('Params: ' + e.params);
      logger.debug('Duration: ' + e.duration + 'ms');
    });

    prisma.$on('error', (e) => {
      logger.error('Database error:', e);
    });
  }
  return prisma;
};

export const closePrismaConnection = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
};

export default {
  getPrismaClient,
  closePrismaConnection,
};
