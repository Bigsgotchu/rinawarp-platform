import express from 'express';
import {
  getSubscriptionTiers,
  createSubscription,
  cancelSubscription,
  getCurrentSubscription,
  getUsageStats,
  updateSubscription,
  createCustomerPortalSession,
  handleWebhook,
} from '../controllers/subscription';
import authenticate from '../middleware/auth';
import { trackUsage } from '../middleware/usage-tracking';
import { UsageType } from '@prisma/client';

const router = express.Router();

// Public routes
router.get('/tiers', getSubscriptionTiers);

// Protected routes
router.use(authenticate);
router.post(
  '/subscribe',
  trackUsage(UsageType.API_REQUEST),
  createSubscription
);
router.post('/cancel', trackUsage(UsageType.API_REQUEST), cancelSubscription);
router.get(
  '/current',
  trackUsage(UsageType.API_REQUEST),
  getCurrentSubscription
);
router.get('/usage', trackUsage(UsageType.API_REQUEST), getUsageStats);

// Customer portal
router.post('/portal-session', trackUsage(UsageType.API_REQUEST), createCustomerPortalSession);

// Update subscription
router.put('/update', trackUsage(UsageType.API_REQUEST), updateSubscription);

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

export default router;
