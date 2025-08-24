import Stripe from 'stripe';
import { User, SubscriptionPlan } from '../types/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import db from '../utils/db';

class StripeService {
  private stripe: Stripe;
  private readonly PLAN_PRICES: Record<SubscriptionPlan, string> = {
    [SubscriptionPlan.FREE]: 'price_free',
    [SubscriptionPlan.BASIC]: process.env.STRIPE_BASIC_PRICE_ID!,
    [SubscriptionPlan.PRO]: process.env.STRIPE_PRO_PRICE_ID!,
    [SubscriptionPlan.ENTERPRISE]: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
  };

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
  }

  async createCustomer(data: {
    email: string;
    name: string;
    paymentMethod?: string;
  }): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email: data.email,
        name: data.name,
        payment_method: data.paymentMethod,
        invoice_settings: data.paymentMethod
          ? { default_payment_method: data.paymentMethod }
          : undefined,
      });

      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer:', error);
      throw new AppError('Payment setup failed', 'PAYMENT_ERROR', 500);
    }
  }

  async createSubscription(userId: string, plan: SubscriptionPlan): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
      });

      if (!user?.stripeCustomerId) {
        throw new AppError('User not found or no payment setup', 'INVALID_USER', 400);
      }

      const priceId = this.PLAN_PRICES[plan];
      if (!priceId) {
        throw new AppError('Invalid subscription plan', 'INVALID_PLAN', 400);
      }

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      // Update user's plan
      await db.user.update({
        where: { id: userId },
        data: {
          currentPlan: plan,
          subscriptionId: subscription.id,
        },
      });

      // Record subscription event
      await db.subscriptionEvent.create({
        data: {
          userId,
          type: 'subscription_created',
          plan,
          stripeSubscriptionId: subscription.id,
        },
      });
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw new AppError('Subscription creation failed', 'SUBSCRIPTION_ERROR', 500);
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
          stripeCustomerId: true,
          subscriptionId: true,
          currentPlan: true,
        },
      });

      if (!user?.subscriptionId) {
        throw new AppError('No active subscription', 'NO_SUBSCRIPTION', 400);
      }

      const subscription = await this.stripe.subscriptions.retrieve(
        user.subscriptionId
      );

      // Update subscription items
      await this.stripe.subscriptions.update(subscription.id, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: this.PLAN_PRICES[newPlan],
          },
        ],
        proration_behavior: 'create_prorations',
      });

      // Update user's plan
      await db.user.update({
        where: { id: userId },
        data: { currentPlan: newPlan },
      });

      // Record plan change
      await db.subscriptionEvent.create({
        data: {
          userId,
          type: 'plan_changed',
          plan: newPlan,
          previousPlan: user.currentPlan,
          stripeSubscriptionId: subscription.id,
        },
      });
    } catch (error) {
      logger.error('Failed to update subscription:', error);
      throw new AppError('Subscription update failed', 'SUBSCRIPTION_ERROR', 500);
    }
  }

  async cancelSubscription(userId: string): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionId: true,
          currentPlan: true,
        },
      });

      if (!user?.subscriptionId) {
        throw new AppError('No active subscription', 'NO_SUBSCRIPTION', 400);
      }

      // Cancel at period end
      await this.stripe.subscriptions.update(user.subscriptionId, {
        cancel_at_period_end: true,
      });

      // Record cancellation
      await db.subscriptionEvent.create({
        data: {
          userId,
          type: 'subscription_cancelled',
          plan: user.currentPlan,
          stripeSubscriptionId: user.subscriptionId,
        },
      });
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      throw new AppError('Subscription cancellation failed', 'SUBSCRIPTION_ERROR', 500);
    }
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<{
    status: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  }> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      return {
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    } catch (error) {
      logger.error('Failed to get subscription status:', error);
      throw new AppError('Subscription status check failed', 'SUBSCRIPTION_ERROR', 500);
    }
  }

  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoiceFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          logger.info(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Failed to handle Stripe webhook:', error);
      throw error;
    }
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    // Update user subscription status
    const user = await db.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: subscription.status,
          subscriptionId: subscription.id,
        },
      });
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const user = await db.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      });
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const user = await db.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: {
          currentPlan: SubscriptionPlan.FREE,
          subscriptionId: null,
          subscriptionStatus: 'inactive',
        },
      });
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const user = await db.user.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });

    if (user) {
      await db.paymentHistory.create({
        data: {
          userId: user.id,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          stripeInvoiceId: invoice.id,
          status: 'paid',
        },
      });
    }
  }

  private async handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
    const user = await db.user.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });

    if (user) {
      await db.paymentHistory.create({
        data: {
          userId: user.id,
          amount: invoice.amount_due,
          currency: invoice.currency,
          stripeInvoiceId: invoice.id,
          status: 'failed',
        },
      });

      // Send failed payment notification
      // TODO: Implement notification service
    }
  }
}

export default new StripeService();
