import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import StripeService from '../services/stripe';
import logger from '../minimal/logger';

const prisma = new PrismaClient();
const stripeService = StripeService.getInstance();

export const getSubscriptionTiers = async (req: Request, res: Response) => {
  try {
    const tiers = await prisma.subscriptionTier.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });

    res.json(tiers);
  } catch (error) {
    logger.error('Failed to fetch subscription tiers:', error);
    res.status(500).json({ error: 'Failed to fetch subscription tiers' });
  }
};

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const { tierId, paymentMethodId } = req.body;
    const userId = (req as any).user.id; // Auth middleware attaches user

    const [user, tier] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.subscriptionTier.findUnique({ where: { id: tierId } }),
    ]);

    if (!user || !tier) {
      return res.status(404).json({ error: 'User or subscription tier not found' });
    }

    const subscription = await stripeService.createSubscription(
      user,
      tier,
      paymentMethodId
    );

    res.json(subscription);
  } catch (error) {
    logger.error('Failed to create subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id; // Auth middleware attaches user

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    await stripeService.cancelSubscription(subscription.stripeSubscriptionId);
    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    logger.error('Failed to cancel subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

export const getCurrentSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id; // Auth middleware attaches user

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      include: {
        tier: true,
      },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    res.json(subscription);
  } catch (error) {
    logger.error('Failed to fetch subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
};

export const getUsageStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id; // Auth middleware attaches user

    const usage = await prisma.usageRecord.groupBy({
      by: ['type'],
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      _sum: {
        quantity: true,
      },
    });

    res.json(usage);
  } catch (error) {
    logger.error('Failed to fetch usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
};
