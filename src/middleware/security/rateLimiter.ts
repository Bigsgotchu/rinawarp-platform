import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type { AuthRequest } from '../../types/auth';
import { SubscriptionPlan } from '../../types/auth';
import { AppError } from '../../utils/errors';
import { redisClient } from '../../lib/redis';

const createRateLimiter = (opts: { points: number; duration: number }) => {
  return new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rate_limit',
    points: opts.points,
    duration: opts.duration,
  });
};

const rateLimiterRedis = createRateLimiter({
  points: 100, // Default points
  duration: 60, // Per 60 seconds by default
});

const planLimits: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 100,
  [SubscriptionPlan.BASIC]: 500,
  [SubscriptionPlan.PRO]: 2000,
  [SubscriptionPlan.ENTERPRISE]: 10000,
};

export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId || 'anonymous';
    const userPlan = req.user?.subscription?.plan || SubscriptionPlan.BASIC;
    const points = planLimits[userPlan];

    const rateLimiterRes = await rateLimiterRedis.consume(userId, 1);

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': points.toString(),
      'X-RateLimit-Remaining': (
        points - rateLimiterRes.consumedPoints
      ).toString(),
      'X-RateLimit-Reset': new Date(
        Date.now() + rateLimiterRes.msBeforeNext
      ).toISOString(),
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
