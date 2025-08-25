import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { AppError } from '../middleware/errorHandler';
import { redisClient } from '../lib/redis';
import { SubscriptionPlan } from '../types/auth';

const rateLimiterRedis = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_limit',
  points: 100, // Default points
  duration: 60, // Per 60 seconds by default
});

const planLimits = {
  [SubscriptionPlan.BASIC]: 100,
  [SubscriptionPlan.PRO]: 1000,
  [SubscriptionPlan.ENTERPRISE]: 10000,
};

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId || 'anonymous';
    const userPlan = req.user?.subscription?.plan || SubscriptionPlan.BASIC;
    const points = planLimits[userPlan];

    const rateLimiterRes = await rateLimiterRedis.consume(userId, 1);
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': points.toString(),
      'X-RateLimit-Remaining': (points - rateLimiterRes.consumedPoints).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
    });

    next();
  } catch (error) {
    if (error instanceof Error) {
      next(new AppError('Too many requests', 'RATE_LIMIT_EXCEEDED', 429));
    } else {
      next(error);
    }
  }
};
