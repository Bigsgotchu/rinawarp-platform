import { PrismaClient, SubscriptionTier, UserSubscription, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { logger } from '@rinawarp/shared';

interface StripeSubscription extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

interface StripeInvoice extends Stripe.Invoice {
  subscription?: string;
}

export class StripeService {
  private stripe: Stripe;
  private prisma: PrismaClient;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-08-27.basil',
    });
    this.prisma = new PrismaClient();
  }

  /**
   * Create or update a price in Stripe for a subscription tier
   */
  async createOrUpdatePrice(tier: SubscriptionTier): Promise<string> {
    try {
      // Create or get product
      let product: Stripe.Product;
      
      if (tier.stripePriceId) {
        // Get existing price to find product
        const price = await this.stripe.prices.retrieve(tier.stripePriceId);
        product = await this.stripe.products.retrieve(price.product as string);
        
        // Update product details
        await this.stripe.products.update(product.id, {
          name: tier.name,
          description: tier.description,
          metadata: {
            tierId: tier.id,
            features: JSON.stringify(tier.features),
          },
        });
      } else {
        // Create new product
        product = await this.stripe.products.create({
          name: tier.name,
          description: tier.description,
          metadata: {
            tierId: tier.id,
            features: JSON.stringify(tier.features),
          },
        });
      }

      // Create new price with non-null unit amount
      const unitAmount = tier.price ? Math.round(tier.price * 100) : 0;
      const price = await this.stripe.prices.create({
        product: product.id,
        unit_amount: unitAmount,
        currency: tier.currency,
        recurring: {
          interval: tier.interval.toLowerCase() as 'month' | 'year',
        },
        metadata: {
          tierId: tier.id,
        },
      });

      return price.id;
    } catch (error) {
      logger.error('Error creating/updating Stripe price:', error);
      throw error;
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(userId: string, tierId: string): Promise<UserSubscription> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user?.stripeCustomerId) {
        throw new Error('User has no Stripe customer ID');
      }

      const tier = await this.prisma.subscriptionTier.findUnique({
        where: { id: tierId },
      });

      if (!tier?.stripePriceId) {
        throw new Error('Tier has no Stripe price ID');
      }

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{ price: tier.stripePriceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      }) as unknown as StripeSubscription;

      // Create subscription record
      const userSubscription = await this.prisma.userSubscription.create({
        data: {
          userId: user.id,
          tierId: tier.id,
          status: SubscriptionStatus.ACTIVE,
          stripeSubscriptionId: subscription.id,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      });

      return userSubscription;
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription tier
   */
  async updateSubscriptionTier(
    subscriptionId: string,
    tierId: string
  ): Promise<UserSubscription> {
    try {
      // Get tier
      const tier = await this.prisma.subscriptionTier.findUnique({
        where: { id: tierId },
      });

      if (!tier?.stripePriceId) {
        throw new Error('Tier has no Stripe price ID');
      }

      // Update subscription in Stripe
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
        proration_behavior: 'create_prorations',
        items: [
          {
            id: subscription.items.data[0].id,
            price: tier.stripePriceId,
          },
        ],
      }) as unknown as StripeSubscription;

      // Update subscription in database
      const userSubscription = await this.prisma.userSubscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
          tierId: tier.id,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      return userSubscription;
    } catch (error) {
      logger.error('Error updating subscription tier:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<UserSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId) as unknown as StripeSubscription;

      const userSubscription = await this.prisma.userSubscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELED,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      });

      return userSubscription;
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription status
   */
  async updateSubscriptionStatus(
    subscriptionId: string,
    status: SubscriptionStatus
  ): Promise<UserSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(
        subscriptionId
      ) as unknown as StripeSubscription;

      const userSubscription = await this.prisma.userSubscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
          status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      });

      return userSubscription;
    } catch (error) {
      logger.error('Error updating subscription status:', error);
      throw error;
    }
  }

  /**
   * Handle subscription updated webhook
   */
  async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as StripeSubscription;
    const status = this.mapStripeStatus(subscription.status);

    // Check if subscription exists
    const existing = await this.prisma.userSubscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!existing) {
      logger.warn(`No userSubscription found for ID: ${subscription.id}`);
      return;
    }

    await this.prisma.userSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: { status },
    });
  }

  /**
   * Handle invoice payment succeeded webhook
   */
  async handleInvoiceSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as StripeInvoice;
    if (invoice.subscription) {
      // Verify subscription exists before updating status
      await this.stripe.subscriptions.retrieve(invoice.subscription);
      
      // Check if subscription exists in our database
      const existing = await this.prisma.userSubscription.findUnique({
        where: { stripeSubscriptionId: invoice.subscription },
      });

      if (!existing) {
        logger.warn(`No userSubscription found for ID: ${invoice.subscription}`);
        return;
      }

      await this.prisma.userSubscription.update({
        where: { stripeSubscriptionId: invoice.subscription },
        data: { status: SubscriptionStatus.ACTIVE },
      });
    }
  }

  /**
   * Handle invoice payment failed webhook
   */
  async handleInvoiceFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as StripeInvoice;
    if (invoice.subscription) {
      // Verify subscription exists before updating status
      await this.stripe.subscriptions.retrieve(invoice.subscription);
      
      // Check if subscription exists in our database
      const existing = await this.prisma.userSubscription.findUnique({
        where: { stripeSubscriptionId: invoice.subscription },
      });

      if (!existing) {
        logger.warn(`No userSubscription found for ID: ${invoice.subscription}`);
        return;
      }

      await this.prisma.userSubscription.update({
        where: { stripeSubscriptionId: invoice.subscription },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
    }
  }

  /**
   * Handle subscription deleted webhook
   */
  async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as StripeSubscription;
    
    // Check if subscription exists in our database
    const existing = await this.prisma.userSubscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!existing) {
      logger.warn(`No userSubscription found for ID: ${subscription.id}`);
      return;
    }

    await this.prisma.userSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: SubscriptionStatus.CANCELED },
    });
  }

  /**
   * Map Stripe subscription status to our status enum
   */
  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'incomplete':
        return SubscriptionStatus.INCOMPLETE;
      case 'incomplete_expired':
        return SubscriptionStatus.INCOMPLETE_EXPIRED;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      default:
        return SubscriptionStatus.FREE;
    }
  }
}
