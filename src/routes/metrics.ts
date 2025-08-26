import express from 'express';
import MonitoringService from '../services/monitoring/monitoring';
import UsageTrackingService from '../services/monitoring/usage-tracking';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import { validateAuth } from '../middleware/auth';

const router = express.Router();

// System metrics - Admin only
router.get('/system', validateAuth.admin, async (req, res) => {
  try {
    const metrics = await MonitoringService.getInstance().getSystemMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get system metrics' });
  }
});

// Health status - Public
router.get('/health', async (req, res) => {
  try {
    const healthChecks = MonitoringService.getInstance().getHealthChecks();
    const isHealthy = MonitoringService.getInstance().isHealthy();

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      checks: healthChecks,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

// Request metrics - Admin only
router.get('/requests', validateAuth.admin, async (req, res) => {
  try {
    const monitoring = MonitoringService.getInstance();
    const timeRange = {
      start: Date.now() - (parseInt(req.query.range as string) || 3600000), // Default 1 hour
      end: Date.now(),
    };

    const metrics = {
      total: monitoring.getMetrics('request.total', timeRange),
      latency: monitoring.getMetrics('request.latency', timeRange),
      errors: monitoring.getMetrics('request.error', timeRange),
      statusCodes: Object.fromEntries(
        [200, 201, 400, 401, 403, 404, 500].map(code => [
          code,
          monitoring.getMetrics(`response.status.${code}`, timeRange),
        ])
      ),
    };

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get request metrics' });
  }
});

// User's own AI usage metrics
router.get('/ai/usage', validateAuth.user, async (req, res) => {
  try {
    const stats = await UsageTrackingService.getInstance().getAIUsageStats(
      req.user!.id
    );
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get AI usage metrics' });
  }
});

// User's own command usage metrics
router.get('/commands/usage', validateAuth.user, async (req, res) => {
  try {
    const { command } = req.query;
    if (!command) {
      res.status(400).json({ error: 'Command parameter is required' });
      return;
    }

    const stats = await UsageTrackingService.getInstance().getCommandStats(
      command as string
    );
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get command metrics' });
  }
});

// Rate limit metrics - Admin only
router.get('/rate-limits', validateAuth.admin, async (req, res) => {
  try {
    const rateLimitKey = 'rate_limit_status';
    const data = await redis.get(rateLimitKey);

    if (!data) {
      res.json({
        currentRate: 0,
        maxRate: parseInt(env.RATE_LIMIT_MAX || '6000'),
        totalBlocked: 0,
      });
      return;
    }

    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get rate limit metrics' });
  }
});

export const metricsRouter = router;
