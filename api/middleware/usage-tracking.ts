/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient, UsageType, UserSubscription } from '@prisma/client';

const prisma = new PrismaClient();

interface ExtendedRequest extends Request {
  user?: {
    id: string;
    subscription?: UserSubscription;
  };
}

export async function trackApiUsage(req: ExtendedRequest, res: Response, next: NextFunction) {
  const startTime = process.hrtime();
  const oldSend = res.send;

  // Override response.send to track metrics before sending
  res.send = function(body): Response {
    const endTime = process.hrtime(startTime);
    const duration = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds

    // Only track if we have a user
    if (req.user?.id) {
      trackUsageMetrics(req.user.id, {
        endpoint: req.path,
        method: req.method,
        responseTime: duration,
        statusCode: res.statusCode,
        bodySize: body ? JSON.stringify(body).length : 0
      }).catch(console.error);
    }

    res.send = oldSend;
    return oldSend.apply(res, arguments as any);
  };

  next();
}

interface UsageMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  bodySize: number;
}

import { notifications } from '../services/notifications';

async function trackUsageMetrics(userId: string, metrics: UsageMetrics) {
  try {
    // Get user's subscription and tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: {
          include: {
            tier: true
          }
        }
      }
    });

    if (!user || !user.subscription) return;

    const { subscription } = user;
    const features = subscription.tier.features as any;

    // Record API request
    await prisma.usageRecord.create({
      data: {
        userId,
        type: UsageType.API_REQUEST,
        quantity: 1,
        metadata: {
          endpoint: metrics.endpoint,
          method: metrics.method,
          responseTime: metrics.responseTime,
          statusCode: metrics.statusCode
        }
      }
    });

    // Get current month's usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyRequests = await prisma.usageRecord.count({
      where: {
        userId,
        type: UsageType.API_REQUEST,
        createdAt: {
          gte: startOfMonth
        }
      }
    });

    // Check if user is approaching limit
    const limit = features.aiAssistance.requestsPerMonth;
    if (limit && limit !== null) { // Skip check for unlimited plans
      const usagePercent = (monthlyRequests / limit) * 100;

      // Alert at 80%, 90%, and 95% usage
      if (usagePercent >= 95) {
        await notifications.sendAlert({
          userId,
          type: 'USAGE_WARNING',
          message: `Critical: You have used ${usagePercent.toFixed(1)}% of your monthly API requests`,
          usagePercent,
          metadata: {
            limit,
            used: monthlyRequests,
            endpoint: metrics.endpoint
          }
        });
      } else if (usagePercent >= 90) {
        await notifications.sendAlert({
          userId,
          type: 'UPGRADE_RECOMMENDED',
          message: `You have used ${usagePercent.toFixed(1)}% of your monthly API requests`,
          usagePercent,
          metadata: {
            limit,
            used: monthlyRequests,
            endpoint: metrics.endpoint
          }
        });
      } else if (usagePercent >= 80) {
        await notifications.sendAlert({
          userId,
          type: 'USAGE_WARNING',
          message: `You have used ${usagePercent.toFixed(1)}% of your monthly API requests`,
          usagePercent,
          metadata: {
            limit,
            used: monthlyRequests,
            endpoint: metrics.endpoint
          }
        });
      }

      // If over limit, record overage
      if (monthlyRequests > limit) {
        await Promise.all([
          prisma.usageRecord.create({
            data: {
              userId,
              type: UsageType.API_REQUEST,
              quantity: 1,
              metadata: {
                type: 'overage',
                endpoint: metrics.endpoint,
                method: metrics.method
              }
            }
          }),
          notifications.sendAlert({
            userId,
            type: 'LIMIT_EXCEEDED',
            message: `You have exceeded your monthly API request limit`,
            usagePercent: (monthlyRequests / limit) * 100,
            metadata: {
              limit,
              used: monthlyRequests,
              endpoint: metrics.endpoint
            }
          })
        ]);
      }
    }
  } catch (error) {
    console.error('Error tracking usage metrics:', error);
  }
}

export async function checkUsageLimits(req: ExtendedRequest, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get user's subscription and tier
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        subscription: {
          include: {
            tier: true
          }
        }
      }
    });

    if (!user || !user.subscription) {
      return res.status(403).json({ error: 'No active subscription' });
    }

    const { subscription } = user;
    const features = subscription.tier.features as any;

    // Get current month's usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyRequests = await prisma.usageRecord.count({
      where: {
        userId: user.id,
        type: UsageType.API_REQUEST,
        createdAt: {
          gte: startOfMonth
        }
      }
    });

    // Check if user has exceeded limit
    const limit = features.aiAssistance.requestsPerMonth;
    if (limit && limit !== null && monthlyRequests >= limit) {
      return res.status(429).json({
        error: 'API limit exceeded',
        limit,
        usage: monthlyRequests,
        reset: startOfMonth.setMonth(startOfMonth.getMonth() + 1),
        upgrade_url: '/api/subscription/upgrade'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking usage limits:', error);
    next(error);
  }
}
