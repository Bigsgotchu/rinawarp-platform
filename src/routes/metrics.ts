import express from 'express';
import { MetricsController } from '../controllers/command';
import { validateAuth } from '../middleware/auth';

const router = express.Router();

router.get('/usage', validateAuth.user, MetricsController.getUsageMetrics);
router.get('/system', validateAuth.admin, MetricsController.getSystemMetrics);

export const metricsRouter = router;
