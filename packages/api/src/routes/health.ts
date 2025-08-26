import { Router } from 'express';
import { CacheService } from '@rinawarp/core';
import { logger } from '@rinawarp/shared';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  dependencies: {
    redis: 'healthy' | 'unhealthy';
  };
  timestamp: string;
}

router.get('/', async (req, res) => {
  try {
    // Check Redis connection
    const cache = CacheService.getInstance();
    await cache.set('health-check', 'ok', 5); // 5 second TTL
    const redisStatus = await cache.get('health-check') === 'ok' ? 'healthy' : 'unhealthy';

    const status: HealthStatus = {
      status: redisStatus === 'healthy' ? 'healthy' : 'unhealthy',
      uptime: process.uptime(),
      dependencies: {
        redis: redisStatus,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(status);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      uptime: process.uptime(),
      dependencies: {
        redis: 'unhealthy',
      },
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
