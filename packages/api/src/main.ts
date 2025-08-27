import express from 'express';
import { logger } from '@rinawarp/shared';
import * as dotenv from 'dotenv';
import { Response, Request, NextFunction } from 'express';
import { stripeWebhookHandler } from './webhooks/stripe';
import cors from 'cors';

// Load environment variables
const envPath = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: envPath });

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || 'localhost';
const CORS_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

// Initialize Express app
const app = express();

// CORS
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));

// Stripe webhook must come before JSON body parser
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

// Body parsing middleware for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Server error:', err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    },
  });
});

// Start server
app.listen(PORT, HOST, () => {
  logger.info(`Server is running on http://${HOST}:${PORT}`);
});
