import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '@rinawarp/shared';

// Initialize Redis client with robust error handling and reconnection
const createRedisClient = () => {
  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    enableOfflineQueue: false,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis connection attempt ${times}, retrying in ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  client.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  client.on('error', (err) => {
    logger.error('Redis connection error:', err);
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  client.on('reconnecting', (ms) => {
    logger.info(`Redis reconnecting in ${ms}ms`);
  });

  return client;
};

// Create Redis client instance
const redisClient = createRedisClient();

// Configure rate limiter with failover handling
const createRateLimiter = () => new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_limit',
  points: 100, // Number of points
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 1 minute if limit exceeded
  insuranceLimiter: {
    points: 50,    // Reduced rate when Redis is down
    duration: 60,  // Same window as main limiter
  },
});

// Create rate limiter instance
let rateLimiter = createRateLimiter();

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
