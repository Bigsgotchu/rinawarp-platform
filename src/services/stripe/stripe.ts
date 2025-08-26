import Stripe from 'stripe';
import {
  PrismaClient,
  SubscriptionTier,
  User,
  UserSubscription,
} from '@prisma/client';
import logger from '../utils/logger';

class StripeService {
  private static instance: StripeService;
  private stripe: Stripe;
  private prisma: PrismaClient;

  private constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    this.prisma = new PrismaClient();
  }

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  public async createCustomer(user: User): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user.id,
        },
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      });

      return customer.id;
    } catch (error) {
      logger.error('Failed to create Stripe customer:', error);
      throw error;
    }
  }

  public async createSubscription(
    user: User,
    tier: SubscriptionTier,
    paymentMethodId: string
  ): Promise<UserSubscription> {
    try {
      let customerId = user.stripeCustomerId;

      if (!customerId) {
        customerId = await this.createCustomer(user);
      }

      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Set as default payment method
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create subscription
      const subscription: any = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: tier.stripePriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });

      // Create subscription record in database
      const userSubscription = await this.prisma.userSubscription.create({
        data: {
          userId: user.id,
          tierId: tier.id,
          status: this.mapStripeStatusToPrisma(subscription.status),
          stripeSubscriptionId: subscription.id,
          currentPeriodStart: new Date(
            (subscription as any).current_period_start * 1000
          ),
          currentPeriodEnd: new Date(
            (subscription as any).current_period_end * 1000
          ),
        },
      });

      return userSubscription;
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw error;
    }
  }

  public async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      await this.prisma.userSubscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: { cancelAtPeriodEnd: true },
      });
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  public async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription: any = event.data.object as any;

    await this.prisma.userSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: this.mapStripeStatusToPrisma(subscription.status),
        currentPeriodStart: new Date(
          (subscription as any).current_period_start * 1000
        ),
        currentPeriodEnd: new Date(
          (subscription as any).current_period_end * 1000
        ),
      },
    });
  }

  public async reportUsage(
    subscriptionItemId: string,
    quantity: number
  ): Promise<void> {
    try {
      await this.stripe.subscriptionItems.createUsageRecord(
        subscriptionItemId,
        {
          quantity,
          timestamp: 'now',
          action: 'increment',
        }
      );
    } catch (error) {
      logger.error('Failed to report usage:', error);
      throw error;
    }
  }

  private mapStripeStatusToPrisma(
    status: string
  ):
    | 'ACTIVE'
    | 'PAST_DUE'
    | 'CANCELED'
    | 'INCOMPLETE'
    | 'INCOMPLETE_EXPIRED'
    | 'TRIALING'
    | 'UNPAID' {
    const statusMap: Record<string, any> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      incomplete: 'INCOMPLETE',
      incomplete_expired: 'INCOMPLETE_EXPIRED',
      trialing: 'TRIALING',
      unpaid: 'UNPAID',
    };

    return statusMap[status] || 'INCOMPLETE';
  }
}

export default StripeService;
