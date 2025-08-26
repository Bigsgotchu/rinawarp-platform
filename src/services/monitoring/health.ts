import { prisma } from '../lib/db';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import axios from 'axios';
import logger from '../utils/logger';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const duration = Date.now() - startTime;
    return {
      status: 'healthy',
      message: `Database responded in ${duration}ms`,
      details: {
        latency: duration,
      },
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      message: `Database check failed: ${error.message}`,
      details: {
        error: error.message,
      },
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    await redis.ping();
    const duration = Date.now() - startTime;
    return {
      status: 'healthy',
      message: `Redis responded in ${duration}ms`,
      details: {
        latency: duration,
      },
    };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return {
      status: 'unhealthy',
      message: `Redis check failed: ${error.message}`,
      details: {
        error: error.message,
      },
    };
  }
}

async function checkExternalAPIs(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    // Check Website API
    const websiteApiResponse = await axios.get(
      `${env.WEBSITE_API_URL}/health`,
      {
        timeout: 5000,
      }
    );

    if (websiteApiResponse.status !== 200) {
      throw new Error(
        `Website API returned status ${websiteApiResponse.status}`
      );
    }

    const duration = Date.now() - startTime;
    return {
      status: 'healthy',
      message: `External APIs responded in ${duration}ms`,
      details: {
        latency: duration,
        apis: {
          website: 'healthy',
        },
      },
    };
  } catch (error) {
    logger.error('External APIs health check failed:', error);
    return {
      status: 'unhealthy',
      message: `External APIs check failed: ${error.message}`,
      details: {
        error: error.message,
      },
    };
  }
}

async function checkSystem(): Promise<HealthCheckResult> {
  try {
    const memoryUsage = process.memoryUsage();
    const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const memoryPercent = Math.round((heapUsed / heapTotal) * 100);

    const healthy = memoryPercent < 90; // Alert if memory usage is above 90%

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      message: healthy
        ? `System is healthy (Memory: ${memoryPercent}%)`
        : `High memory usage: ${memoryPercent}%`,
      details: {
        memory: {
          used: heapUsed,
          total: heapTotal,
          percent: memoryPercent,
        },
        uptime: process.uptime(),
      },
    };
  } catch (error) {
    logger.error('System health check failed:', error);
    return {
      status: 'unhealthy',
      message: `System check failed: ${error.message}`,
      details: {
        error: error.message,
      },
    };
  }
}

export async function runHealthChecks(): Promise<
  Record<string, HealthCheckResult>
> {
  const [dbHealth, redisHealth, apiHealth, systemHealth] =
    await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkExternalAPIs(),
      checkSystem(),
    ]);

  return {
    database:
      dbHealth.status === 'fulfilled'
        ? dbHealth.value
        : {
            status: 'unhealthy',
            message: 'Health check failed to execute',
            details: { error: dbHealth.reason },
          },
    redis:
      redisHealth.status === 'fulfilled'
        ? redisHealth.value
        : {
            status: 'unhealthy',
            message: 'Health check failed to execute',
            details: { error: redisHealth.reason },
          },
    externalApis:
      apiHealth.status === 'fulfilled'
        ? apiHealth.value
        : {
            status: 'unhealthy',
            message: 'Health check failed to execute',
            details: { error: apiHealth.reason },
          },
    system:
      systemHealth.status === 'fulfilled'
        ? systemHealth.value
        : {
            status: 'unhealthy',
            message: 'Health check failed to execute',
            details: { error: systemHealth.reason },
          },
  };
}

export default {
  checkDatabase,
  checkRedis,
  checkExternalAPIs,
  checkSystem,
  runHealthChecks,
};
