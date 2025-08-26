import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth';
import { prisma } from '../lib/prisma';
import { UsageType } from '@prisma/client';
import UsageTrackingService from '../services/command';
import logger from '../utils/logger';

/**
 * Track API usage via response interceptor
 */
export const trackUsage = (type: UsageType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;

    // Override res.send() to track usage after response is sent
    res.send = function (body: any): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (req.user?.userId) {
        // Track usage asynchronously via service
        UsageTrackingService.getInstance()
          .trackUsage(type, 1, {
            duration,
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            userId: req.user.userId,
          })
          .catch(error => {
            logger.error('Failed to track usage:', error);
          });

        // Update monthly usage counter
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

        prisma.monthlyUsage
          .upsert({
            where: {
              userId_month: {
                userId: req.user.userId,
                month: monthKey,
              },
            },
            update: {
              count: { increment: 1 },
              lastUpdated: now,
            },
            create: {
              userId: req.user.userId,
              month: monthKey,
              count: 1,
              lastUpdated: now,
            },
          })
          .catch(error => {
            logger.error('Failed to update monthly usage:', error);
          });
      }

      return originalSend.call(this, body);
    };

    next();
  };
};

/**
 * Track AI token usage
 */
export const trackTokenUsage = async (
  promptTokens: number,
  completionTokens: number
) => {
  try {
    await UsageTrackingService.getInstance().trackTokenUsage(
      promptTokens,
      completionTokens
    );
  } catch (error) {
    logger.error('Failed to track token usage:', error);
    throw error;
  }
};

/**
 * Check user's usage limits
 */
export const checkUsageLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.userId) {
      return next();
    }

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    const monthlyUsage = await prisma.monthlyUsage.findUnique({
      where: {
        userId_month: {
          userId: req.user.userId,
          month: monthKey,
        },
      },
    });

    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.userId },
    });

    if (!subscription) {
      return next();
    }

    const usageLimit = subscription.usageLimit;
    const currentUsage = monthlyUsage?.count || 0;

    if (currentUsage >= usageLimit) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        code: 'USAGE_LIMIT_EXCEEDED',
        message:
          'You have exceeded your monthly usage limit. Please upgrade your plan.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
