import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { logger } from '@rinawarp/shared';
import dotenv from 'dotenv';
import { APIOptions } from './types';
import terminalRoutes from './routes/terminal';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || 'localhost';
const CORS_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

export class APIServer {
  private app: express.Application;
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

    // Body parsing middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());

    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check routes
    this.app.use('/health', healthRoutes);

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
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
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

  public getApp(): express.Application {
    return this.app;
  }
}

export default APIServer;
