import { Router } from 'express';
import { StripeService } from '../services/stripe.service';
import { PrismaClient } from '@prisma/client';
import { logger } from '@rinawarp/shared';
import { requireAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const stripeService = new StripeService();

/**
 * Get subscription tiers
 */
router.get('/tiers', async (req, res) => {
  try {
    const tiers = await prisma.subscriptionTier.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });
    res.json(tiers);
  } catch (error) {
    logger.error('Error fetching subscription tiers:', error);
    res.status(500).json({ error: 'Failed to fetch subscription tiers' });
  }
});

/**
 * Get user's active subscription
 */
router.get('/active', requireAuth, async (req: any, res) => {
  try {
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId: req.user.id },
      include: { tier: true },
    });
    res.json(subscription);
  } catch (error) {
    logger.error('Error fetching active subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * Create new subscription
 */
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const { tierId } = req.body;

    if (!tierId) {
      return res.status(400).json({ error: 'Subscription tier ID is required' });
    }

    // Check if user already has a subscription
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { userId: req.user.id },
    });

    if (existingSubscription) {
      return res.status(400).json({ error: 'User already has an active subscription' });
    }

    // Create subscription
    const subscription = await stripeService.createSubscription(
      req.user.id,
      tierId
    );

    res.json(subscription);
  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * Cancel subscription
 */
router.delete('/:subscriptionId', requireAuth, async (req: any, res) => {
  try {
    const { subscriptionId } = req.params;

    // Verify subscription belongs to user
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        stripeSubscriptionId: subscriptionId,
        userId: req.user.id,
      },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Cancel subscription
    const canceledSubscription = await stripeService.cancelSubscription(
      subscriptionId
    );

    res.json(canceledSubscription);
  } catch (error) {
    logger.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * Update subscription
 */
router.patch('/:subscriptionId', requireAuth, async (req: any, res) => {
  try {
    const { subscriptionId } = req.params;
    const { tierId } = req.body;

    if (!tierId) {
      return res.status(400).json({ error: 'New subscription tier ID is required' });
    }

    // Verify subscription belongs to user
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        stripeSubscriptionId: subscriptionId,
        userId: req.user.id,
      },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Update subscription
    const updatedSubscription = await stripeService.updateSubscriptionTier(
      subscriptionId,
      tierId
    );

    res.json(updatedSubscription);
  } catch (error) {
    logger.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

export default router;
