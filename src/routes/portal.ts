import express from 'express';
import { authenticate } from '../middleware/authenticate';
import { checkRole } from '../middleware/roleCheck';
import StripePortalService from '../services/StripePortalService';
import { AppError } from '../middleware/errorHandler';

const router = express.Router();

/**
 * @swagger
 * /api/portal/session:
 *   post:
 *     tags: [Billing Portal]
 *     summary: Create a Stripe Customer Portal session
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Portal session URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 */
router.post('/session',
  authenticate,
  async (req, res, next) => {
    try {
      const { userId } = req.user!;
      const url = await StripePortalService.createPortalSession(userId);
      res.json({ url });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/portal/features:
 *   get:
 *     tags: [Billing Portal]
 *     summary: Get available portal features
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Portal features configuration
 */
router.get('/features',
  authenticate,
  async (req, res, next) => {
    try {
      const features = await StripePortalService.getPortalFeatures();
      res.json(features);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/portal/config:
 *   put:
 *     tags: [Billing Portal]
 *     summary: Update portal configuration
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allowPaymentUpdate:
 *                 type: boolean
 *               allowProfileUpdate:
 *                 type: boolean
 *               allowCancel:
 *                 type: boolean
 *               allowPause:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Portal configuration updated
 */
router.put('/config',
  authenticate,
  checkRole('ADMIN'),
  async (req, res, next) => {
    try {
      await StripePortalService.updatePortalConfig(req.body);
      res.json({ message: 'Portal configuration updated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/portal/checkout:
 *   post:
 *     tags: [Billing Portal]
 *     summary: Create a Stripe Checkout session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - priceId
 *             properties:
 *               priceId:
 *                 type: string
 *               successUrl:
 *                 type: string
 *               cancelUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checkout session URL
 */
router.post('/checkout',
  authenticate,
  async (req, res, next) => {
    try {
      const { userId } = req.user!;
      const { priceId, successUrl, cancelUrl } = req.body;

      if (!priceId) {
        throw new AppError('Price ID is required', 'INVALID_INPUT', 400);
      }

      const sessionUrl = await StripePortalService.createCheckoutSession(
        userId,
        priceId,
        successUrl || `${process.env.FRONTEND_URL}/billing/success`,
        cancelUrl || `${process.env.FRONTEND_URL}/billing/cancel`
      );

      res.json({ url: sessionUrl });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/portal/events:
 *   post:
 *     tags: [Billing Portal]
 *     summary: Handle Stripe Customer Portal events
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event handled successfully
 */
router.post('/events',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      const sig = req.headers['stripe-signature'];
      
      if (!sig) {
        throw new AppError('No Stripe signature found', 'INVALID_WEBHOOK', 400);
      }

      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_PORTAL_WEBHOOK_SECRET!
      );

      await StripePortalService.handlePortalEvent(event);
      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/portal/return:
 *   get:
 *     tags: [Billing Portal]
 *     summary: Handle return from Stripe Customer Portal
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Return handling successful
 */
router.get('/return',
  authenticate,
  async (req, res, next) => {
    try {
      // Handle any necessary cleanup or state updates after portal session
      res.redirect('/settings/billing');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
