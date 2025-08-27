import { Request, Response, NextFunction } from 'express';
import { PrismaClient, UsageType } from '@prisma/client';
import { logger } from '@rinawarp/shared';
import { AuthRequest } from './auth';

const prisma = new PrismaClient();

export function trackAPIRequest() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return next();
    }

    try {
      // Track API request
      await prisma.usageRecord.create({
        data: {
          userId: req.user.id,
          type: UsageType.API_REQUEST,
          quantity: 1,
          metadata: {
            path: req.path,
            method: req.method,
          },
        },
      });
    } catch (error) {
      // Don't fail the request if usage tracking fails
      logger.error('Failed to track API request:', error);
    }

    next();
  };
}

export async function trackTokenUsage(userId: string, promptTokens: number, completionTokens: number) {
  try {
    await Promise.all([
      prisma.usageRecord.create({
        data: {
          userId,
          type: UsageType.PROMPT_TOKENS,
          quantity: promptTokens,
          metadata: {
            timestamp: new Date().toISOString(),
          },
        },
      }),
      prisma.usageRecord.create({
        data: {
          userId,
          type: UsageType.COMPLETION_TOKENS,
          quantity: completionTokens,
          metadata: {
            timestamp: new Date().toISOString(),
          },
        },
      }),
    ]);
  } catch (error) {
    logger.error('Failed to track token usage:', error);
  }
}
