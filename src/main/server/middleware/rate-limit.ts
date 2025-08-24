import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cache';
import { logger } from '../../utils/logger';

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Max number of requests per window
  message?: string;  // Error message
  statusCode?: number; // HTTP status code for rate limit exceeded
  keyGenerator?: (req: Request) => string; // Function to generate rate limit key
}

export class RateLimiter {
  private cache: CacheService;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.cache = new CacheService();
    this.config = {
      windowMs: 60 * 1000, // 1 minute
      max: 100,           // 100 requests per minute
      message: 'Too many requests, please try again later',
      statusCode: 429,
      keyGenerator: (req: Request) => {
        // Default to IP address if no user ID
        return req.user?.id || req.ip;
      },
      ...config,
    };
  }

  /**
   * Rate limit middleware
   */
  public middleware = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const key = `ratelimit:${this.config.keyGenerator!(req)}`;
      
      // Get current hits
      const hits = await this.getHits(key);
      
      // Check if limit exceeded
      if (hits.total >= this.config.max) {
        res.status(this.config.statusCode!).json({
          error: this.config.message,
          retryAfter: Math.ceil((hits.expires - Date.now()) / 1000),
        });
        return;
      }

      // Increment hits
      await this.incrementHits(key);

      // Set headers
      res.setHeader('X-RateLimit-Limit', this.config.max);
      res.setHeader('X-RateLimit-Remaining', this.config.max - hits.total - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(hits.expires / 1000));

      next();
    } catch (error) {
      logger.error('Rate limit error:', error);
      next(error);
    }
  };

  /**
   * Get current hits for key
   */
  private async getHits(
    key: string
  ): Promise<{
    total: number;
    expires: number;
  }> {
    try {
      const data = await this.cache.get<{
        hits: number;
        expires: number;
      }>(key);

      if (!data) {
        return {
          total: 0,
          expires: Date.now() + this.config.windowMs,
        };
      }

      // Check if window expired
      if (Date.now() > data.expires) {
        return {
          total: 0,
          expires: Date.now() + this.config.windowMs,
        };
      }

      return {
        total: data.hits,
        expires: data.expires,
      };
    } catch (error) {
      logger.error('Failed to get rate limit hits:', error);
      return {
        total: 0,
        expires: Date.now() + this.config.windowMs,
      };
    }
  }

  /**
   * Increment hits for key
   */
  private async incrementHits(key: string): Promise<void> {
    try {
      const data = await this.cache.get<{
        hits: number;
        expires: number;
      }>(key);

      if (!data || Date.now() > data.expires) {
        // Start new window
        await this.cache.set(
          key,
          {
            hits: 1,
            expires: Date.now() + this.config.windowMs,
          },
          Math.ceil(this.config.windowMs / 1000)
        );
      } else {
        // Increment existing window
        await this.cache.set(
          key,
          {
            hits: data.hits + 1,
            expires: data.expires,
          },
          Math.ceil((data.expires - Date.now()) / 1000)
        );
      }
    } catch (error) {
      logger.error('Failed to increment rate limit hits:', error);
    }
  }
}
