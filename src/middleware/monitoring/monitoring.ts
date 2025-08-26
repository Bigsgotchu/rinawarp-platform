import { Request, Response, NextFunction } from 'express';
import MonitoringService from '../services/monitoring';
import logger from '../utils/logger';

export interface MonitoringOptions {
  includeBody?: boolean;
  includePath?: boolean;
  tags?: Record<string, string>;
}

export function monitorRequest(options: MonitoringOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const monitoring = MonitoringService.getInstance();

    // Track total requests
    monitoring.recordMetric('request.total', 1, {
      method: req.method,
      ...(options.includePath ? { path: req.path } : {}),
      ...options.tags,
    });

    // Override end to track response metrics
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any, callback?: any): any {
      // Calculate request duration
      const duration = Date.now() - startTime;

      // Record latency
      monitoring.recordMetric('request.latency', duration, {
        method: req.method,
        status: res.statusCode.toString(),
        ...(options.includePath ? { path: req.path } : {}),
        ...options.tags,
      });

      // Track status codes
      monitoring.recordMetric(`response.status.${res.statusCode}`, 1, {
        method: req.method,
        ...(options.includePath ? { path: req.path } : {}),
        ...options.tags,
      });

      // Track errors
      if (res.statusCode >= 400) {
        monitoring.recordMetric('request.error', 1, {
          method: req.method,
          status: res.statusCode.toString(),
          ...(options.includePath ? { path: req.path } : {}),
          ...options.tags,
        });
      }

      // Call original end
      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  };
}

export function healthCheck(
  name: string,
  check: () => Promise<{ healthy: boolean; message?: string }>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const monitoring = MonitoringService.getInstance();

    try {
      const result = await check();
      const duration = Date.now() - startTime;

      monitoring.recordHealthCheck({
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        message: result.message,
        latency: duration,
      });

      if (!result.healthy) {
        res.status(503).json({
          status: 'unhealthy',
          check: name,
          message: result.message,
        });
        return;
      }

      next();
    } catch (error) {
      const duration = Date.now() - startTime;

      monitoring.recordHealthCheck({
        name,
        status: 'unhealthy',
        message: error.message,
        latency: duration,
      });

      logger.error(`Health check failed: ${name}`, error);

      res.status(503).json({
        status: 'unhealthy',
        check: name,
        message: error.message,
      });
    }
  };
}

// Import health check implementations
import {
  checkDatabase,
  checkRedis,
  checkAIService,
  checkSystemResources,
  checkRateLimits,
} from '../../services/monitoring/health-checks';

// Database health check
export const databaseHealthCheck = healthCheck('database', checkDatabase);

// Redis health check
export const redisHealthCheck = healthCheck('redis', checkRedis);

// AI Service health check
export const aiServiceHealthCheck = healthCheck('ai-service', checkAIService);

// System resources health check
export const systemResourcesHealthCheck = healthCheck(
  'system-resources',
  checkSystemResources
);

// Rate limits health check
export const rateLimitsHealthCheck = healthCheck('rate-limits', checkRateLimits);
