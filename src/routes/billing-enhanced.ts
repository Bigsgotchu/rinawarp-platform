import express from 'express';
import { authenticate } from '../middleware/authenticate';
import { validateBilling } from '../middleware/billingValidation';
import BillingService from '../services/BillingService';
import SubscriptionService from '../services/SubscriptionService';
import { AppError } from '../middleware/errorHandler';
import { SubscriptionPlan } from '../types/auth';
import {
  securityHeaders,
  paymentRateLimiter,
  idempotencyCheck,
  fraudDetection,
  validateHighValueTransaction,
  verifyStripeWebhook,
  validatePaymentAmount,
} from '../middleware/security';
import logger from '../utils/logger';

const router = express.Router();

// Apply security headers to all routes
router.use(securityHeaders);

// Payment methods management
router.get('/payment-methods',
  authenticate,
  paymentRateLimiter,
  async (req, res, next) => {
    try {
      const { userId } = req.user!;
      const paymentMethods = await BillingService.getPaymentMethods(userId);
      res.json(paymentMethods);
    } catch (error) {
      logger.error('Failed to get payment methods:', error);
      next(error);
    }
  }
);

router.post('/payment-methods',
  authenticate,
  validateBilling.addPaymentMethod,
  paymentRateLimiter,
  idempotencyCheck,
  fraudDetection,
  async (req, res, next) => {
    try {
      const { userId } = req.user!;
      const { paymentMethodId } = req.body;

      await BillingService.updatePaymentMethod(userId, paymentMethodId);
      
      // Log successful payment method addition
      logger.info(`Payment method added for user ${userId}`);
      
      res.json({ message: 'Payment method added successfully' });
    } catch (error) {
      logger.error('Failed to add payment method:', error);
      next(error);
    }
  }
);

// Subscription management
router.post('/subscriptions',
  authenticate,
  validateBilling.createSubscription,
  paymentRateLimiter,
  idempotencyCheck,
  fraudDetection,
  validateHighValueTransaction,
  validatePaymentAmount,
  async (req, res, next) => {
    try {
      const { userId } = req.user!;
      const { plan, paymentMethodId } = req.body;

      if (!Object.values(SubscriptionPlan).includes(plan)) {
        throw new AppError('Invalid subscription plan', 'INVALID_PLAN', 400);
      }

      const subscription = await SubscriptionService.createSubscription(
        userId,
        plan,
        paymentMethodId,
        req.idempotencyKey
      );

      // Log successful subscription creation
      logger.info(`Subscription created for user ${userId}, plan: ${plan}`);

      res.json(subscription);
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      next(error);
    }
  }
);

// Webhook handling
router.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  verifyStripeWebhook,
  async (req, res, next) => {
    try {
      const event = req.stripeEvent;
      
      // Log webhook event
      logger.info(`Processing Stripe webhook: ${event.type}`);

      await StripePortalService.handlePortalEvent(event);
      
      res.json({ received: true });
    } catch (error) {
      logger.error('Failed to handle Stripe webhook:', error);
      next(error);
    }
  }
);

// Invoice management
router.get('/invoices',
  authenticate,
  paymentRateLimiter,
  async (req, res, next) => {
    try {
      const { userId } = req.user!;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await BillingService.getBillingHistory(
        userId,
        limit,
        offset
      );

      res.json(history);
    } catch (error) {
      logger.error('Failed to get billing history:', error);
      next(error);
    }
  }
);

// Error handling middleware
router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Billing route error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  // Handle Stripe errors
  if (err.type && err.type.startsWith('Stripe')) {
    return res.status(400).json({
      error: 'Payment processing error',
      code: 'STRIPE_ERROR',
      details: err.message,
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});

export default router;
