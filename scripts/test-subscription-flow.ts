import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import Stripe from 'stripe';
import { logger } from '@rinawarp/shared';

type StripeSubscriptionWithTimestamps = Stripe.Response<Stripe.Subscription> & {
  current_period_start: number;
  current_period_end: number;
};

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-07-30.basil',
});

async function cleanup() {
  logger.info('Cleaning up test data...');
  // Delete in order of dependencies
  await prisma.userSubscription.deleteMany();
  await prisma.licenseKey.deleteMany();
  await prisma.emailEvent.deleteMany();
  await prisma.emailPreferences.deleteMany();
  await prisma.usageRecord.deleteMany();
  await prisma.user.deleteMany();
  await prisma.subscriptionTier.deleteMany();
}

async function createTestUser() {
  const hashedPassword = await hash('testpassword', 10);
  
  // Create a Stripe customer
  const customer = await stripe.customers.create({
    email: 'test@example.com',
    name: 'Test User',
    metadata: {
      test: 'true'
    }
  });

  logger.info('Created test Stripe customer:', customer.id);

  // Create user in our database
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      hashedPassword,
      role: UserRole.USER,
      stripeCustomerId: customer.id
    }
  });

  logger.info('Created test user:', user.id);
  return user;
}

async function createTestTier() {
  // Create a product in Stripe
  const product = await stripe.products.create({
    name: 'Test Pro Plan',
    description: 'Test subscription tier',
    metadata: {
      test: 'true'
    }
  });

  // Create a price for the product
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1000, // $10.00
    currency: 'usd',
    recurring: {
      interval: 'month'
    },
    metadata: {
      test: 'true'
    }
  });

  logger.info('Created test Stripe product and price:', { 
    productId: product.id,
    priceId: price.id
  });

  // Create subscription tier in our database
  const tier = await prisma.subscriptionTier.create({
    data: {
      name: 'Test Pro Plan',
      description: 'Test subscription tier',
      price: 10,
      currency: 'usd',
      interval: 'MONTHLY',
      features: ['test-feature-1', 'test-feature-2'],
      stripePriceId: price.id,
      active: true
    }
  });

  logger.info('Created test subscription tier:', tier.id);
  return tier;
}

async function createTestSubscription(userId: string, tierId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user?.stripeCustomerId) {
    throw new Error('User has no Stripe customer ID');
  }

  const tier = await prisma.subscriptionTier.findUnique({
    where: { id: tierId }
  });

  if (!tier?.stripePriceId) {
    throw new Error('Tier has no Stripe price ID');
  }

  // Create subscription in Stripe
  const subscription = await stripe.subscriptions.retrieve(
    (await stripe.subscriptions.create({
      customer: user.stripeCustomerId,
      items: [{ price: tier.stripePriceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    })).id
  ) as StripeSubscriptionWithTimestamps;

  logger.info('Created test Stripe subscription:', subscription.id);

  // Create subscription in our database
  const userSubscription = await prisma.userSubscription.create({
    data: {
      userId: user.id,
      tierId: tier.id,
      stripeSubscriptionId: subscription.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000)
    }
  });

  logger.info('Created test user subscription:', userSubscription.id);
  return userSubscription;
}

async function main() {
  try {
    logger.info('Starting test subscription flow...');

    // Clean up any existing test data
    await cleanup();

    // Create test user and subscription tier
    const user = await createTestUser();
    const tier = await createTestTier();

    // Create test subscription
    const subscription = await createTestSubscription(user.id, tier.id);

    logger.info('Test subscription flow completed successfully!', {
      userId: user.id,
      tierId: tier.id,
      subscriptionId: subscription.id
    });
  } catch (error) {
    logger.error('Test subscription flow failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
