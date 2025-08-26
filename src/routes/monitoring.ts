import express from 'express';
import MonitoringController from '../controllers/command';
import { authenticate } from '../middleware/authenticate';
import { checkRole } from '../middleware/roleCheck';

const router = express.Router();

/**
 * @swagger
 * /api/monitoring/health:
 *   get:
 *     tags: [Monitoring]
 *     summary: Get detailed health status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed health status
 */
router.get(
  '/health',
  authenticate,
  checkRole(['ADMIN']),
  MonitoringController.getHealth
);

/**
 * @swagger
 * /api/monitoring/liveness:
 *   get:
 *     tags: [Monitoring]
 *     summary: Simple liveness probe
 *     responses:
 *       200:
 *         description: Basic health check response
 */
router.get('/liveness', MonitoringController.getLiveness);

/**
 * @swagger
 * /api/monitoring/metrics:
 *   get:
 *     tags: [Monitoring]
 *     summary: Get system metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System metrics
 */
router.get(
  '/metrics',
  authenticate,
  checkRole(['ADMIN']),
  MonitoringController.getMetrics
);

export default router;
