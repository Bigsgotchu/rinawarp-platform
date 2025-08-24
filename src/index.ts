import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import AnalyticsReportScheduler from './schedulers/AnalyticsReportScheduler';
import { setupApiDocs } from './docs/setupDocs';
import authRoutes from './routes/auth';
import config from './config';
import routes from './routes';
import { requestLogger } from './middleware/requestLogger';
import { MonitoringService } from './services/MonitoringService';
import logger from './utils/logger';
import * as Sentry from '@sentry/node';
import Redis from 'ioredis';
import cookieParser from 'cookie-parser';
import { helmetConfig, corsConfig } from './config/security';
import { rateLimiter, securityHeaders } from './middleware/security';

// Initialize Monitoring
const monitoring = MonitoringService.getInstance();

// Initialize Express
const app: Express = express();
const port = process.env.PORT || 3000;

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Initialize Redis
let redis: Redis;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  });
  declare global {
    var redis: Redis;
  }
  global.redis = redis as any;
} catch (error) {
  console.error('Failed to initialize Redis:', error);
  process.exit(1);
}

// Initialize Prisma
let prisma: PrismaClient;
try {
  prisma = new PrismaClient();
  // Make prisma available globally with proper typing
  declare global {
    var prisma: PrismaClient;
  }
  global.prisma = prisma;
} catch (error) {
  console.error('Failed to initialize Prisma:', error);
  process.exit(1);
}

// Security middleware
app.use(helmet(helmetConfig));
app.use(cors(corsConfig));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Request logging
app.use(requestLogger());

// Security middlewares
app.use(securityHeaders);

// Rate limiting
app.use(rateLimiter);

// Setup API documentation
setupApiDocs(app);

// Mount API routes
app.use('/', routes);

// Basic health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await monitoring.getHealthStatus();
    res.json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
    });
  }
});

// Error handling must be after all middlewares
app.use(Sentry.Handlers.errorHandler());

// Initialize server and monitoring
app.listen(port, async () => {
  // Start metrics collection
  monitoring.startMetricsCollection();
  console.log(`Server running on port ${port}`);
  
  // Initialize analytics report scheduler
  try {
    await AnalyticsReportScheduler.start();
    console.log('Analytics report scheduler started');
  } catch (error) {
    console.error('Failed to start analytics report scheduler:', error);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  monitoring.stopMetricsCollection();
  await prisma.$disconnect();
  AnalyticsReportScheduler.stop();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  monitoring.captureError(error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
  monitoring.captureError(new Error('Unhandled Promise Rejection'));
});

export default app;
