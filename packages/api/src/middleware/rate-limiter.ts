import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '@rinawarp/shared';

// Initialize Redis client
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  enableOfflineQueue: false,
});

// Configure rate limiter
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_limit',
  points: 100, // Number of points
  duration: 60, // Per 60 seconds
});

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip rate limiting for health check endpoint
  if (req.path === '/health') {
    return next();
  }

  const clientId = req.ip;
  
  try {
    const rateLimiterRes = await rateLimiter.consume(clientId);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': rateLimiterRes.remainingPoints.toString(),
      'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
    });
    
    next();
  } catch (error) {
    if (error instanceof Error) {
      logger.warn(`Rate limit exceeded for IP ${clientId}`);
      
      // If rate limit exceeded, error will contain msBeforeNext
      const resetTime = new Date(Date.now() + (error as any).msBeforeNext).toISOString();
      
      res.set({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime,
        'Retry-After': Math.ceil((error as any).msBeforeNext / 1000).toString(),
      });
      
      res.status(429).json({
        error: {
          message: 'Too many requests',
          retryAfter: Math.ceil((error as any).msBeforeNext / 1000),
        },
      });
    } else {
      logger.error('Rate limiter error:', error);
      next(error);
    }
  }
};
