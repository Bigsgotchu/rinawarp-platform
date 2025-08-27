import { Router } from 'express';
import { UsageService } from '../services/usage.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const usageService = new UsageService();

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
});

// Routes
router.get('/current', authenticate, async (req, res, next) => {
  try {
    const usage = await usageService.getCurrentPeriodUsage(req.user!.userId);
    res.json(usage);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/history',
  authenticate,
  validateRequest({ query: dateRangeSchema }),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query as unknown as z.infer<typeof dateRangeSchema>;
      const history = await usageService.getUsageHistory(
        req.user!.userId,
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
