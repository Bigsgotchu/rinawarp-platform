import * as Sentry from '@sentry/node';
import { MetricsAggregator } from '@opentelemetry/api';
import { logger } from '../utils/logger';
import { performance } from 'perf_hooks';
import os from 'os';

export class MonitoringService {
  private static instance: MonitoringService;
  private metricsInterval: NodeJS.Timer | null = null;
  private startTime: number;

  private constructor() {
    this.startTime = Date.now();
    this.initializeSentry();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private initializeSentry() {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 1.0,
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Express({ app: true }),
        ],
      });
    }
  }

  public startMetricsCollection(interval: number = 60000) {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);
  }

  public stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private async collectMetrics() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        system: {
          uptime: process.uptime(),
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem(),
            processUsage: process.memoryUsage(),
          },
          cpu: {
            load: os.loadavg(),
            cores: os.cpus().length,
          },
        },
        process: {
          uptime: (Date.now() - this.startTime) / 1000,
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
      };

      logger.info('System metrics collected', { metrics });
      return metrics;
    } catch (error) {
      logger.error('Error collecting metrics', { error });
      throw error;
    }
  }

  public captureError(error: Error, context: Record<string, any> = {}) {
    logger.error(error.message, {
      stack: error.stack,
      ...context,
    });

    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: context,
      });
    }
  }

  public async getHealthStatus(): Promise<Record<string, any>> {
    try {
      const dbHealth = await this.checkDatabaseHealth();
      const redisHealth = await this.checkRedisHealth();
      const systemHealth = await this.checkSystemHealth();

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealth,
        redis: redisHealth,
        system: systemHealth,
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      throw error;
    }
  }

  private async checkDatabaseHealth(): Promise<Record<string, any>> {
    try {
      const startTime = performance.now();
      await global.prisma.$queryRaw`SELECT 1`;
      const responseTime = performance.now() - startTime;

      return {
        status: 'ok',
        responseTime: `${responseTime.toFixed(2)}ms`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private async checkRedisHealth(): Promise<Record<string, any>> {
    try {
      const redis = global.redis;
      const startTime = performance.now();
      await redis.ping();
      const responseTime = performance.now() - startTime;

      return {
        status: 'ok',
        responseTime: `${responseTime.toFixed(2)}ms`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private async checkSystemHealth(): Promise<Record<string, any>> {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    return {
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usagePercent: memoryUsagePercent.toFixed(2) + '%',
      },
      cpu: {
        load: os.loadavg(),
        cores: os.cpus().length,
      },
      disk: await this.checkDiskSpace(),
    };
  }

  private async checkDiskSpace(): Promise<Record<string, any>> {
    try {
      // You might want to use a package like 'disk-space' here
      // This is a simplified version
      return {
        status: 'ok',
        // Add actual disk space metrics here
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }
}
