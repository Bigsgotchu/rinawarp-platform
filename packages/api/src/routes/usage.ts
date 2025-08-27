import { Router } from 'express';
import { UsageService } from '../services/usage.service';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';

const router = Router();
const usageService = new UsageService();

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
});

// Routes
router.get('/current', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const usage = await usageService.getCurrentPeriodUsage(req.user!.id);
    res.json(usage);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/history',
  requireAuth,
  validateRequest({ query: dateRangeSchema }),
  async (req: AuthRequest, res, next) => {
    try {
      const { startDate, endDate } = req.query as unknown as z.infer<typeof dateRangeSchema>;
      const history = await usageService.getUsageHistory(
        req.user!.id,
        startDate,
        endDate
      );
      res.json(history);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
