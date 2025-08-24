import { Request, Response, NextFunction } from 'express';
import { PrismaClient, UsageType } from '@prisma/client';
import logger from '../minimal/logger';

const prisma = new PrismaClient();

export const trackUsage = (type: UsageType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      logger.warn('Usage tracking skipped: No user ID found');
      return next();
    }

    const startTime = Date.now();
    let originalSend = res.send;

    // Override res.send() to track usage after response is sent
    res.send = function(body: any): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Track usage asynchronously
      prisma.usageRecord.create({
        data: {
          userId,
          type,
          quantity: 1,
          metadata: {
            duration,
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
          },
        },
      }).catch(error => {
        logger.error('Failed to track usage:', error);
      });

      return originalSend.call(this, body);
    };

    next();
  };
};

export const trackTokenUsage = async (
  userId: string,
  promptTokens: number,
  completionTokens: number
) => {
  try {
    await Promise.all([
      prisma.usageRecord.create({
        data: {
          userId,
          type: UsageType.PROMPT_TOKENS,
          quantity: promptTokens,
        },
      }),
      prisma.usageRecord.create({
        data: {
          userId,
          type: UsageType.COMPLETION_TOKENS,
          quantity: completionTokens,
        },
      }),
    ]);
  } catch (error) {
    logger.error('Failed to track token usage:', error);
    throw error;
  }
};
