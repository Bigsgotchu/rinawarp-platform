import express from 'express';
import { authenticate } from '../middleware/authenticate';
import { validateSubscription } from '../middleware/subscriptionValidation';
import { validateBilling } from '../middleware/billingValidation';
import BillingService from '../services/command';
import SubscriptionService from '../services/command';
import { AppError } from '../middleware/errorHandler';
import { SubscriptionPlan } from '../types/auth';

const router = express.Router();

/**
 * @swagger
 * /api/billing/payment-methods:
 *   get:
 *     tags: [Billing]
 *     summary: Get user's payment methods
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payment methods
 */
router.get('/payment-methods', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const paymentMethods = await BillingService.getPaymentMethods(userId);
    res.json(paymentMethods);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/billing/payment-methods:
 *   post:
 *     tags: [Billing]
 *     summary: Add new payment method
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethodId
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment method added successfully
 */
router.post(
  '/payment-methods',
  authenticate,
  validateBilling.addPaymentMethod,
  async (req, res, next) => {
    try {
      const { userId } = req.user!;
      const { paymentMethodId } = req.body;

      await BillingService.updatePaymentMethod(userId, paymentMethodId);
      res.json({ message: 'Payment method added successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/billing/invoices:
 *   get:
 *     tags: [Billing]
 *     summary: Get billing history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Billing history
 */
router.get('/invoices', authenticate, async (req, res, next) => {
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
    next(error);
  }
});

/**
 * @swagger
 * /api/billing/subscriptions:
 *   get:
 *     tags: [Billing]
 *     summary: Get subscription details
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription details
 */
router.get('/subscriptions', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const details = await SubscriptionService.getSubscriptionDetails(userId);
    res.json(details);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/billing/subscriptions:
 *   post:
 *     tags: [Billing]
 *     summary: Create new subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plan
 *               - paymentMethodId
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [BASIC, PRO, ENTERPRISE]
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription created successfully
 */
router.post(
  '/subscriptions',
  authenticate,
  validateSubscription.create,
  async (req, res, next) => {
    try {
      const { userId } = req.user!;
      const { plan, paymentMethodId } = req.body;

      if (!Object.values(SubscriptionPlan).includes(plan)) {
        throw new AppError('Invalid subscription plan', 'INVALID_PLAN', 400);
      }

      await SubscriptionService.createSubscription(
        userId,
        plan,
        paymentMethodId
      );
      res.json({ message: 'Subscription created successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/billing/subscriptions:
 *   put:
 *     tags: [Billing]
 *     summary: Update subscription plan
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plan
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [BASIC, PRO, ENTERPRISE]
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 */
router.put(
  '/subscriptions',
  authenticate,
  validateSubscription.update,
  async (req, res, next) => {
    try {
      const { userId } = req.user!;
      const { plan } = req.body;

      if (!Object.values(SubscriptionPlan).includes(plan)) {
        throw new AppError('Invalid subscription plan', 'INVALID_PLAN', 400);
      }

      await SubscriptionService.updateSubscription(userId, plan);
      res.json({ message: 'Subscription updated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/billing/subscriptions:
 *   delete:
 *     tags: [Billing]
 *     summary: Cancel subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: immediate
 *         schema:
 *           type: boolean
 *         description: Whether to cancel immediately or at period end
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 */
router.delete('/subscriptions', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const immediate = req.query.immediate === 'true';

    await SubscriptionService.cancelSubscription(userId, immediate);
    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/billing/usage:
 *   get:
 *     tags: [Billing]
 *     summary: Get current usage metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current usage metrics
 */
router.get('/usage', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const details = await SubscriptionService.getSubscriptionDetails(userId);
    res.json({
      usage: details.usage,
      limits: details.features,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
