import { SubscriptionPlan, PlanFeatures, PLAN_FEATURES } from '../types/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import db from '../utils/db';
import StripeService from './StripeService';
import BillingService from './BillingService';
import { sendEmail } from '../utils/email';

interface SubscriptionDetails {
  plan: SubscriptionPlan;
  features: PlanFeatures;
  price: number;
  billingPeriod: 'monthly' | 'yearly';
  status: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  usage: {
    commands: {
      used: number;
      limit: number;
    };
    workflows: {
      used: number;
      limit: number;
    };
  };
}

class SubscriptionService {
  private readonly TRIAL_DAYS = 14;
  private readonly GRACE_PERIOD_DAYS = 3;

  async createSubscription(
    userId: string,
    plan: SubscriptionPlan,
    paymentMethodId: string
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
          currentPlan: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      if (!user.stripeCustomerId) {
        throw new AppError('Invalid payment setup', 'PAYMENT_ERROR', 400);
      }

      // Validate plan upgrade/downgrade
      await this.validatePlanChange(user.currentPlan, plan);

      // Create subscription in Stripe
      const subscription = await StripeService.createSubscription({
        customerId: user.stripeCustomerId,
        plan,
        paymentMethodId,
        trialDays: this.TRIAL_DAYS,
      });

      // Update user's plan
      await db.user.update({
        where: { id: userId },
        data: {
          currentPlan: plan,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          trialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null,
        },
      });

      // Record subscription event
      await db.subscriptionEvent.create({
        data: {
          userId,
          type: 'subscription_created',
          plan,
          previousPlan: user.currentPlan,
          stripeSubscriptionId: subscription.id,
        },
      });

      // Send welcome email for the new plan
      await this.sendPlanWelcomeEmail(userId, plan);
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw error;
    }
  }

  async updateSubscription(
    userId: string,
    newPlan: SubscriptionPlan
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          currentPlan: true,
          subscriptionId: true,
          stripeCustomerId: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      // Validate plan change
      await this.validatePlanChange(user.currentPlan, newPlan);

      if (newPlan === SubscriptionPlan.FREE) {
        // Handle downgrade to free plan
        await this.cancelSubscription(userId, true);
        return;
      }

      // Update subscription in Stripe
      await StripeService.updateSubscription(user.subscriptionId!, newPlan);

      // Update user's plan
      await db.user.update({
        where: { id: userId },
        data: {
          currentPlan: newPlan,
        },
      });

      // Record plan change
      await db.subscriptionEvent.create({
        data: {
          userId,
          type: 'plan_changed',
          plan: newPlan,
          previousPlan: user.currentPlan,
          stripeSubscriptionId: user.subscriptionId!,
        },
      });

      // Send plan change email
      await this.sendPlanChangeEmail(userId, newPlan);
    } catch (error) {
      logger.error('Failed to update subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(
    userId: string,
    immediate: boolean = false
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          currentPlan: true,
          subscriptionId: true,
          email: true,
        },
      });

      if (!user?.subscriptionId) {
        throw new AppError('No active subscription', 'NO_SUBSCRIPTION', 400);
      }

      if (immediate) {
        // Cancel immediately
        await StripeService.cancelSubscription(user.subscriptionId);

        await db.user.update({
          where: { id: userId },
          data: {
            currentPlan: SubscriptionPlan.FREE,
            subscriptionId: null,
            subscriptionStatus: 'cancelled',
          },
        });
      } else {
        // Cancel at period end
        await StripeService.updateSubscription(user.subscriptionId, {
          cancelAtPeriodEnd: true,
        });

        await db.user.update({
          where: { id: userId },
          data: {
            cancelAtPeriodEnd: true,
          },
        });
      }

      // Record cancellation
      await db.subscriptionEvent.create({
        data: {
          userId,
          type: 'subscription_cancelled',
          plan: user.currentPlan,
          stripeSubscriptionId: user.subscriptionId,
        },
      });

      // Send cancellation email
      await this.sendCancellationEmail(user.email, immediate);
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  async getSubscriptionDetails(userId: string): Promise<SubscriptionDetails> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          currentPlan: true,
          subscriptionId: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      // Get current billing period
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get usage metrics
      const metrics = await db.usageMetrics.findMany({
        where: {
          userId,
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      // Calculate usage
      const usage = {
        commands: {
          used: metrics.find(m => m.metricType === 'commands_executed')?.count || 0,
          limit: PLAN_FEATURES[user.currentPlan].maxCommands,
        },
        workflows: {
          used: metrics.find(m => m.metricType === 'workflows_created')?.count || 0,
          limit: PLAN_FEATURES[user.currentPlan].maxWorkflows,
        },
      };

      let stripeSubscription;
      if (user.subscriptionId) {
        stripeSubscription = await StripeService.getSubscription(user.subscriptionId);
      }

      return {
        plan: user.currentPlan,
        features: PLAN_FEATURES[user.currentPlan],
        price: BillingService.PLAN_PRICES[user.currentPlan],
        billingPeriod: 'monthly', // TODO: Support yearly billing
        status: user.subscriptionStatus || 'inactive',
        currentPeriodEnd: user.currentPeriodEnd,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
        usage,
      };
    } catch (error) {
      logger.error('Failed to get subscription details:', error);
      throw error;
    }
  }

  async checkUsageLimit(
    userId: string,
    metricType: 'commands' | 'workflows'
  ): Promise<boolean> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          currentPlan: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      const limits = PLAN_FEATURES[user.currentPlan];
      const limit = metricType === 'commands' ? limits.maxCommands : limits.maxWorkflows;

      // If limit is -1, it means unlimited
      if (limit === -1) return true;

      // Get current month's usage
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const usage = await db.usageMetrics.findFirst({
        where: {
          userId,
          metricType: metricType === 'commands' ? 'commands_executed' : 'workflows_created',
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        select: {
          count: true,
        },
      });

      return (usage?.count || 0) < limit;
    } catch (error) {
      logger.error('Failed to check usage limit:', error);
      throw error;
    }
  }

  private async validatePlanChange(
    currentPlan: SubscriptionPlan,
    newPlan: SubscriptionPlan
  ): Promise<void> {
    // Add any business logic for validating plan changes
    // For example, preventing downgrades if there are active resources
    // that would exceed the new plan's limits
  }

  private async sendPlanWelcomeEmail(
    userId: string,
    plan: SubscriptionPlan
  ): Promise<void> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) return;

    await sendEmail({
      to: user.email,
      subject: `Welcome to Rinawarp ${plan}!`,
      template: 'plan-welcome',
      data: {
        plan,
        features: PLAN_FEATURES[plan],
      },
    });
  }

  private async sendPlanChangeEmail(
    userId: string,
    newPlan: SubscriptionPlan
  ): Promise<void> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) return;

    await sendEmail({
      to: user.email,
      subject: `Your Rinawarp Plan Has Changed`,
      template: 'plan-change',
      data: {
        plan: newPlan,
        features: PLAN_FEATURES[newPlan],
      },
    });
  }

  private async sendCancellationEmail(
    email: string,
    immediate: boolean
  ): Promise<void> {
    await sendEmail({
      to: email,
      subject: 'Subscription Cancellation Confirmation',
      template: 'subscription-cancelled',
      data: {
        immediate,
        reactivateUrl: `${process.env.FRONTEND_URL}/billing/reactivate`,
      },
    });
  }
}

export default new SubscriptionService();
