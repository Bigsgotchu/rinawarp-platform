import { Router } from 'express';
import AnalyticsSubscriptionController, {
  validateUpdatePreferences
} from '../controllers/AnalyticsSubscriptionController';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/analytics/subscriptions:
 *   get:
 *     summary: Get user's analytics subscription preferences
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's subscription preferences
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/subscriptions',
  requireAuth,
  AnalyticsSubscriptionController.getSubscriptionPreferences
);

/**
 * @swagger
 * /api/analytics/subscriptions:
 *   put:
 *     summary: Update user's analytics subscription preferences
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dailyAnalytics
 *               - weeklyAnalytics
 *               - monthlyAnalytics
 *             properties:
 *               dailyAnalytics:
 *                 type: boolean
 *               weeklyAnalytics:
 *                 type: boolean
 *               monthlyAnalytics:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/subscriptions',
  requireAuth,
  validateUpdatePreferences,
  AnalyticsSubscriptionController.updateSubscriptionPreferences
);

/**
 * @swagger
 * /api/analytics/unsubscribe:
 *   get:
 *     summary: Unsubscribe from analytics reports
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully unsubscribed
 *       400:
 *         description: Invalid input or token
 */
router.get(
  '/unsubscribe',
  AnalyticsSubscriptionController.unsubscribe
);

export default router;
