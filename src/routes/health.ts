import express from 'express';
import { HealthController } from '../controllers/command';

const router = express.Router();

router.get('/', HealthController.check);
router.get('/detailed', HealthController.detailed);

export const healthRouter = router;

import { Router } from 'express';
import { metricsHandler } from '../services/prometheus';
import healthService from '../services/health';
import logger from '../utils/logger';

const router = Router();

// Simple health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Run quick liveness check
    res.json({ status: 'healthy' });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Detailed health check endpoint (requires authentication in production)
router.get('/health/detailed', async (req, res) => {
  try {
    const results = await healthService.runHealthChecks();
    const isHealthy = Object.values(results).every(
      result => result.status === 'healthy'
    );

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      checks: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Prometheus metrics endpoint
router.get('/metrics', metricsHandler);

export default router;
