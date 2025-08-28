import Stripe from 'stripe';
import { PrismaClient, SubscriptionTier } from '@prisma/client';
import { logger } from '@rinawarp/shared';
import { APIError } from '../middleware/error-handler';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

const prisma = new PrismaClient();

export class StripeCheckoutService {
  private static instance: StripeCheckoutService;

  private constructor() {}

  public static getInstance(): StripeCheckoutService {
    if (!StripeCheckoutService.instance) {
      StripeCheckoutService.instance = new StripeCheckoutService();
    }
    return StripeCheckoutService.instance;
  }

  async createCheckoutSession(
    userId: string,
    tierId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new APIError(404, 'User not found');
    }

    const tier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
    });
    if (!tier) {
      throw new APIError(404, 'Subscription tier not found');
    }

    // Get or create Stripe price
    const priceId = await this.getOrCreatePrice(tier);

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      billing_address_collection: 'auto',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          userId,
          tierId,
        },
      },
      metadata: {
        userId,
        tierId,
      },
    });

    return session;
  }

  async createCustomerPortalSession(
    userId: string,
    returnUrl: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
      throw new APIError(404, 'No Stripe customer found');
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return portalSession;
  }

  private async getOrCreatePrice(tier: SubscriptionTier): Promise<string> {
    if (tier.stripePriceId) {
      return tier.stripePriceId;
    }

    // Create Stripe product if it doesn't exist
    const product = await stripe.products.create({
      name: tier.name,
      description: tier.description,
      metadata: {
        tierId: tier.id,
      },
    });

    // Create price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(tier.price * 100), // Convert to cents
      currency: tier.currency,
      recurring: {
        interval: tier.interval.toLowerCase() as 'month' | 'year',
      },
      metadata: {
        tierId: tier.id,
      },
    });

    // Update tier with Stripe price ID
    await prisma.subscriptionTier.update({
      where: { id: tier.id },
      data: { stripePriceId: price.id },
    });

    return price.id;
  }
}
