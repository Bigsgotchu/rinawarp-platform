import { Request, Response } from 'express';
import { rateLimiterMiddleware } from '../rate-limiter';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '@rinawarp/shared';

// Mock dependencies
jest.mock('ioredis');
jest.mock('rate-limiter-flexible');
jest.mock('@rinawarp/shared', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Rate Limiter Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup request mock
    mockRequest = {
      ip: '127.0.0.1',
      path: '/_rltest',
    };
    
    // Setup response mock
    mockResponse = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    // Setup next function mock
    nextFunction = jest.fn();
  });
  
  it('should skip rate limiting for health check endpoint', async () => {
    mockRequest.path = '/health';
    
    await rateLimiterMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );
    
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.set).not.toHaveBeenCalled();
  });
  
  it('should apply rate limiting for non-health check endpoints', async () => {
    const mockRateLimiterRes = {
      remainingPoints: 99,
      msBeforeNext: 60000,
    };
    
    (RateLimiterRedis.prototype.consume as jest.Mock).mockResolvedValueOnce(
      mockRateLimiterRes
    );
    
    await rateLimiterMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );
    
    expect(mockResponse.set).toHaveBeenCalledWith({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
      'X-RateLimit-Reset': expect.any(String),
    });
    expect(nextFunction).toHaveBeenCalled();
  });
  
  it('should handle rate limit exceeded', async () => {
    const mockError = {
      msBeforeNext: 30000,
    };
    
    (RateLimiterRedis.prototype.consume as jest.Mock).mockRejectedValueOnce(
      mockError
    );
    
    await rateLimiterMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );
    
    expect(mockResponse.set).toHaveBeenCalledWith({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': expect.any(String),
      'Retry-After': '30',
    });
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        message: 'Too many requests',
        retryAfter: 30,
      },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Rate limit exceeded for IP 127.0.0.1'
    );
  });
  
  it('should handle Redis connection errors', async () => {
    const connectionError = new Error('Redis connection failed');
    
    (RateLimiterRedis.prototype.consume as jest.Mock).mockRejectedValueOnce(
      connectionError
    );
    
    await rateLimiterMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );
    
    expect(logger.error).toHaveBeenCalledWith(
      'Rate limiter error:',
      connectionError
    );
    expect(nextFunction).toHaveBeenCalledWith(connectionError);
  });
});
