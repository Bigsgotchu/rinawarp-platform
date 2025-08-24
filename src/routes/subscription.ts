import express from 'express';
import {
  getSubscriptionTiers,
  createSubscription,
  cancelSubscription,
  getCurrentSubscription,
  getUsageStats,
} from '../controllers/subscription';
import authenticate from '../middleware/auth';
import { trackUsage } from '../middleware/usage-tracking';
import { UsageType } from '@prisma/client';

const router = express.Router();

// Public routes
router.get('/tiers', getSubscriptionTiers);

// Protected routes
router.use(authenticate);
router.post('/subscribe', trackUsage(UsageType.API_REQUEST), createSubscription);
router.post('/cancel', trackUsage(UsageType.API_REQUEST), cancelSubscription);
router.get('/current', trackUsage(UsageType.API_REQUEST), getCurrentSubscription);
router.get('/usage', trackUsage(UsageType.API_REQUEST), getUsageStats);

export default router;
