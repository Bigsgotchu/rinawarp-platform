import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from '../config/env';
import { authRouter } from '../routes/auth';
import { metricsRouter } from '../routes/metrics';
import { healthRouter } from '../routes/health';
import { errorHandler } from '../middleware/error';
import { setupRequestLogger } from '../middleware/logging';
import { rateLimiter } from '../middleware/security';
import { validateAuth } from '../middleware/auth';
import { csrfProtection } from '../middleware/security';

export function createServer(): Express {
  const app = express();

  // Basic middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Security middleware
  if (env.NODE_ENV === 'production') {
    app.use(csrfProtection());
    app.use(rateLimiter);
  }

  // Logging
  app.use(setupRequestLogger());

  // Routes
  app.use('/api/auth', authRouter);
  app.use('/api/metrics', validateAuth.user, metricsRouter);
  app.use('/api/health', healthRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}

export default createServer;
