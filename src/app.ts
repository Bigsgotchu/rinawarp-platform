import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import routes from './routes';
import { rateLimiter } from './middleware/security/rateLimiter';
import { securityHeaders } from './middleware/security/security';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { config } from './config';

const app = express();
const prisma = new PrismaClient();

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  enableOfflineQueue: false,
});

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(requestLogger());

// Security middleware
app.use(securityHeaders);
app.use(rateLimiter);

// API Routes
app.use('/api/v1', routes);

// Health check endpoint (before rate limiting)
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis connection
    await redis.ping();
    
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Error handling
app.use(errorHandler);

// Export app for testing
export default app;
