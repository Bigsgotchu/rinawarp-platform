import express from 'express';
import AuthController from '../controllers/AuthController';
import { require2FA } from '../middleware/require2FA';
import { session, requireSession } from '../middleware/session';
import { validateAuth } from '../middleware/authValidation';
import { authenticate } from '../middleware/authenticate';
import { validateSubscription } from '../middleware/subscriptionValidation';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post('/register',
  validateAuth.register,
  AuthController.register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login',
  validateAuth.login,
  AuthController.login
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New tokens generated
 */
router.post('/refresh',
  validateAuth.refresh,
  AuthController.refreshToken
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       204:
 *         description: Logged out successfully
 */
router.post('/logout',
  authenticate,
  validateAuth.logout,
  AuthController.logout
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post('/reset-password',
  validateAuth.resetPassword,
  AuthController.resetPassword
);

/**
 * @swagger
 * /api/auth/reset-password/confirm:
 *   post:
 *     tags: [Authentication]
 *     summary: Confirm password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post('/reset-password/confirm',
  validateAuth.confirmResetPassword,
  AuthController.confirmResetPassword
);

/**
 * @swagger
 * /api/subscriptions:
 *   post:
 *     tags: [Billing]
 *     summary: Create a new subscription
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
 *                 enum: [basic, pro, enterprise]
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription created successfully
 */
router.post('/subscriptions',
  authenticate,
  validateSubscription.create,
  AuthController.createSubscription
);

/**
 * @swagger
 * /api/subscriptions:
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
 *                 enum: [basic, pro, enterprise]
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 */
router.put('/subscriptions',
  authenticate,
  validateSubscription.update,
  AuthController.updateSubscription
);

/**
 * @swagger
 * /api/subscriptions:
 *   delete:
 *     tags: [Billing]
 *     summary: Cancel subscription
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 */
router.delete('/subscriptions',
  authenticate,
  AuthController.cancelSubscription
);

/**
 * @swagger
 * /api/subscriptions/status:
 *   get:
 *     tags: [Billing]
 *     summary: Get subscription status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current subscription status
 */
router.get('/subscriptions/status',
  authenticate,
  AuthController.getSubscriptionStatus
);

/**
 * @swagger
 * /api/auth/2fa/setup:
 *   post:
 *     tags: [Authentication]
 *     summary: Initialize 2FA setup
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup initialized
 */
router.post('/2fa/setup',
  authenticate,
  AuthController.initialize2FA
);

/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify 2FA setup
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA setup verified
 */
router.post('/2fa/verify',
  authenticate,
  AuthController.verify2FA
);

/**
 * @swagger
 * /api/auth/2fa/disable:
 *   post:
 *     tags: [Authentication]
 *     summary: Disable 2FA
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA disabled
 */
router.post('/2fa/disable',
  authenticate,
  require2FA,
  AuthController.disable2FA
);

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     tags: [Authentication]
 *     summary: Get active sessions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions
 */
router.get('/sessions',
  authenticate,
  requireSession,
  AuthController.getActiveSessions
);

/**
 * @swagger
 * /api/auth/sessions/{sessionId}:
 *   delete:
 *     tags: [Authentication]
 *     summary: Terminate a specific session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Session terminated
 */
router.delete('/sessions/:sessionId',
  authenticate,
  requireSession,
  AuthController.terminateSession
);

/**
 * @swagger
 * /api/auth/sessions:
 *   delete:
 *     tags: [Authentication]
 *     summary: Terminate all sessions except current
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: All other sessions terminated
 */
router.delete('/sessions',
  authenticate,
  requireSession,
  AuthController.terminateAllSessions
);

/**
 * @swagger
 * /api/webhooks/stripe:
 *   post:
 *     tags: [Billing]
 *     summary: Handle Stripe webhooks
 *     responses:
 *       200:
 *         description: Webhook handled successfully
 */
router.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  AuthController.handleStripeWebhook
);

export default router;
