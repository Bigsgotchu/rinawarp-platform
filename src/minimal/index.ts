import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './logger';
import { MonitoringService } from './monitoring';
import DatabaseService from './database';
import subscriptionRoutes from '../routes/subscription';

const app = express();
const port = process.env.PORT || 3000;

// Initialize services
const monitoring = MonitoringService.getInstance();
const database = DatabaseService.getInstance();

// Basic security
app.use(helmet());
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/subscriptions', subscriptionRoutes);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });
  next();
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const [systemHealth, dbHealth] = await Promise.all([
      monitoring.getHealthStatus(),
      database.checkHealth()
    ]);

    res.json({
      ...systemHealth,
      database: dbHealth
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await monitoring.collectMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to collect metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to collect metrics'
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Start server and monitoring
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  monitoring.startMetricsCollection();
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  monitoring.stopMetricsCollection();
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  monitoring.stopMetricsCollection();
  await database.disconnect();
  process.exit(0);
});

export default app;
