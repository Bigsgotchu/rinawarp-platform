/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();
let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe not configured');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }
  return stripeClient;
}

function mapStripeStatus(status: string): SubscriptionStatus {
  const map: Record<string, SubscriptionStatus> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    trialing: 'TRIALING',
    unpaid: 'UNPAID'
  };
  return map[status] ?? 'INCOMPLETE';
}

async function handleCustomerSubscriptionUpdated(subscription: Stripe.Subscription) {
  const { customer, status } = subscription;
  const current_period_start = (subscription as any).current_period_start as number | undefined;
  const current_period_end = (subscription as any).current_period_end as number | undefined;
  
  if (typeof customer !== 'string') {
    throw new Error('Unexpected customer format');
  }

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customer }
  });

  if (!user) {
    throw new Error(`No user found for Stripe customer ${customer}`);
  }

  // Get the price ID to match with our subscription tier
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    throw new Error('No price ID found in subscription');
  }

  // Find the matching subscription tier
  const tier = await prisma.subscriptionTier.findFirst({
    where: { stripePriceId: priceId }
  });

  if (!tier) {
    throw new Error(`No subscription tier found for price ${priceId}`);
  }

  // Upsert user's subscription record
  await prisma.userSubscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      tierId: tier.id,
      status: mapStripeStatus(status),
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date((current_period_start || 0) * 1000),
      currentPeriodEnd: new Date((current_period_end || 0) * 1000)
    },
    update: {
      tierId: tier.id,
      status: mapStripeStatus(status),
      currentPeriodStart: new Date((current_period_start || 0) * 1000),
      currentPeriodEnd: new Date((current_period_end || 0) * 1000)
    }
  });
}

async function handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { customer } = subscription;
  
  if (typeof customer !== 'string') {
    throw new Error('Unexpected customer format');
  }

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customer }
  });

  if (!user) {
    throw new Error(`No user found for Stripe customer ${customer}`);
  }

  // Find the free tier
  const freeTier = await prisma.subscriptionTier.findFirst({
    where: { price: 0 }
  });

  if (!freeTier) {
    throw new Error('No free tier found');
  }

  // Downgrade user's subscription to free/canceled
  await prisma.userSubscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      tierId: freeTier.id,
      status: 'CANCELED',
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date()
    },
    update: {
      tierId: freeTier.id,
      status: 'CANCELED',
      cancelAtPeriodEnd: true
    }
  });
}

async function handleSubscriptionUpdateEvent(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.created':
      await handleCustomerSubscriptionUpdated(subscription);
      break;
    case 'customer.subscription.deleted':
      await handleCustomerSubscriptionDeleted(subscription);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Webhook processing not configured' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  
  if (!sig) {
    return res.status(400).json({ error: 'No signature header' });
  }

  try {
    const event = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpdateEvent(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    if (err instanceof Error) {
      console.error('Webhook error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    console.error('Unknown webhook error:', err);
    return res.status(500).json({ error: 'Unknown error occurred' });
  }
}
