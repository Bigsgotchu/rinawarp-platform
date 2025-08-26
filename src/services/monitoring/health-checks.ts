import { db } from '../../lib/db';
import { redis } from '../../lib/redis';
import { env } from '../../config/env';

interface HealthCheckResult {
  healthy: boolean;
  message?: string;
}

// Database health check
export async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const duration = Date.now() - startTime;
    
    return {
      healthy: true,
      message: `Database responded in ${duration}ms`,
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Database check failed: ${error.message}`,
    };
  }
}

// Redis health check
export async function checkRedis(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    await redis.ping();
    const duration = Date.now() - startTime;

    return {
      healthy: true,
      message: `Redis responded in ${duration}ms`,
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Redis check failed: ${error.message}`,
    };
  }
}

// AI Service health check
export async function checkAIService(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(env.AI_SERVICE_URL + '/health');
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`AI service returned status ${response.status}`);
    }

    return {
      healthy: true,
      message: `AI service responded in ${duration}ms`,
    };
  } catch (error) {
    return {
      healthy: false,
      message: `AI service check failed: ${error.message}`,
    };
  }
}

// System resources check
export async function checkSystemResources(): Promise<HealthCheckResult> {
  try {
    const usage = process.memoryUsage();
    const memoryUsage = usage.heapUsed / usage.heapTotal;
    const cpuUsage = process.cpuUsage();
    const totalCpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    const healthy = memoryUsage < 0.9 && totalCpuUsage < 90;
    const message = `Memory usage: ${(memoryUsage * 100).toFixed(1)}%, CPU usage: ${totalCpuUsage.toFixed(1)}s`;

    return {
      healthy,
      message: healthy ? message : `System resources critical: ${message}`,
    };
  } catch (error) {
    return {
      healthy: false,
      message: `System resources check failed: ${error.message}`,
    };
  }
}

// API rate limits check
export async function checkRateLimits(): Promise<HealthCheckResult> {
  try {
    const rateLimitKey = 'rate_limit_status';
    const rateLimitData = await redis.get(rateLimitKey);
    
    if (!rateLimitData) {
      return {
        healthy: true,
        message: 'Rate limits are within acceptable range',
      };
    }

    const data = JSON.parse(rateLimitData);
    const isHealthy = data.totalBlocked < 1000 && data.currentRate < data.maxRate * 0.9;

    return {
      healthy: isHealthy,
      message: isHealthy
        ? `Rate limits normal: ${data.currentRate}/${data.maxRate} req/s`
        : `Rate limits critical: ${data.currentRate}/${data.maxRate} req/s, ${data.totalBlocked} blocked`,
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Rate limits check failed: ${error.message}`,
    };
  }
}
