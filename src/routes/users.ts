import express from 'express';
import UserController from '../controllers/UserController';
import { authenticate } from '../middleware/authenticate';
import { validateUser } from '../middleware/userValidation';
import { checkRole } from '../middleware/roleCheck';

const router = express.Router();

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 */
router.get('/profile',
  authenticate,
  UserController.getProfile
);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     tags: [Users]
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile',
  authenticate,
  validateUser.updateProfile,
  UserController.updateProfile
);

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     tags: [Users]
 *     summary: Delete user account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Account deleted successfully
 */
router.delete('/account',
  authenticate,
  validateUser.deleteAccount,
  UserController.deleteAccount
);

/**
 * @swagger
 * /api/users/metrics:
 *   get:
 *     tags: [Users]
 *     summary: Get user usage metrics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, monthly]
 *         description: Metrics period
 *     responses:
 *       200:
 *         description: Usage metrics data
 */
router.get('/metrics',
  authenticate,
  UserController.getUsageMetrics
);

/**
 * @swagger
 * /api/users/billing:
 *   get:
 *     tags: [Users]
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
 *         description: Billing history data
 */
router.get('/billing',
  authenticate,
  UserController.getBillingHistory
);

/**
 * @swagger
 * /api/users/subscriptions:
 *   get:
 *     tags: [Users]
 *     summary: Get subscription history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription history data
 */
router.get('/subscriptions',
  authenticate,
  UserController.getSubscriptionHistory
);

/**
 * @swagger
 * /api/users/preferences:
 *   put:
 *     tags: [Users]
 *     summary: Update user preferences
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailNotifications:
 *                 type: boolean
 *               theme:
 *                 type: string
 *                 enum: [light, dark]
 *               commandSuggestions:
 *                 type: boolean
 *               aiAssistance:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 */
router.put('/preferences',
  authenticate,
  validateUser.updatePreferences,
  UserController.updatePreferences
);

// Admin routes
/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Admin]
 *     summary: Get all users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 */
router.get('/',
  authenticate,
  checkRole('ADMIN'),
  UserController.getAllUsers
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User data
 */
router.get('/:id',
  authenticate,
  checkRole('ADMIN'),
  UserController.getUserById
);

/**
 * @swagger
 * /api/users/{id}/status:
 *   put:
 *     tags: [Admin]
 *     summary: Update user status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, SUSPENDED]
 *     responses:
 *       200:
 *         description: User status updated
 */
router.put('/:id/status',
  authenticate,
  checkRole('ADMIN'),
  validateUser.updateStatus,
  UserController.updateUserStatus
);

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get user statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics data
 */
router.get('/stats',
  authenticate,
  checkRole('ADMIN'),
  UserController.getUserStats
);

export default router;
