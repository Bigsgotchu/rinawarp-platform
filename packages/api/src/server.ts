const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
import { logger } from '@rinawarp/shared';
import * as dotenv from 'dotenv';
import type { Application, Request, Response, NextFunction } from 'express';
import { APIOptions } from './types';
import { errorHandler } from './middleware/error-handler';
import terminalRoutes from './routes/terminal';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import subscriptionRoutes from './routes/subscription';
import usageRoutes from './routes/usage';
import checkoutRoutes from './routes/checkout';
import webhookStripeRoutes from './routes/webhooks/stripe';
import { trackAPIRequest } from './middleware/track-usage';
import { stripeWebhookMiddleware } from './middleware/stripe-webhook';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || 'localhost';
const CORS_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

export class APIServer {
  private app: Application;
  private options: APIOptions;

  public static async create(): Promise<APIServer> {
    const server = new APIServer({
      port: PORT,
      host: HOST,
      enableDocs: true,
      enableMetrics: true,
      cors: {
        origin: CORS_ORIGIN,
        credentials: true,
      },
    });
    return server;
  }

  constructor(options: APIOptions) {
    this.app = express();
    this.options = options;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors(this.options.cors));

    // Stripe webhook raw body MUST be registered BEFORE json parser
    // to allow Stripe signature verification
    this.app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

    // Body parsing middleware for all other routes
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());

    // Usage tracking middleware
    this.app.use(trackAPIRequest());

    // Logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check routes
    this.app.use('/health', healthRoutes);

    // Auth routes
    this.app.use('/api/auth', authRoutes);

    // Subscription routes
    this.app.use('/api/subscriptions', subscriptionRoutes);

    // Usage routes
    this.app.use('/api/usage', usageRoutes);

    // Checkout routes
    this.app.use('/api/checkout', checkoutRoutes);

    // Webhook routes
    this.app.use('/api/webhooks/stripe', webhookStripeRoutes);

    // Terminal routes
    this.app.use('/api/terminal', terminalRoutes);

    // Documentation
    if (this.options.enableDocs) {
      this.setupDocs();
    }

    // Metrics
    if (this.options.enableMetrics) {
      this.setupMetrics();
    }

    // Error handling
    this.app.use(errorHandler);
  }

  private setupDocs(): void {
    // Add Swagger documentation setup here
  }

  private setupMetrics(): void {
    // Add metrics setup here
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.options.port, () => {
        logger.info(`API server listening on port ${this.options.port}`);
        resolve();
      });
    });
  }

  public getApp(): Application {
    return this.app;
  }
}

export default APIServer;
