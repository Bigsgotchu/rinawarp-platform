import { PrismaClient, BillingInterval } from '@prisma/client';
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY environment variable is not set');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const prisma = new PrismaClient();

const tiers = [
  {
    name: 'Free',
    description: 'Perfect for trying out and hobbyists',
    price: 0,
    interval: BillingInterval.MONTHLY,
    features: {
      apiRequestsPerMonth: 100,
      maxTokensPerRequest: 1000,
      supportLevel: 'community',
      customInstructions: false,
      priorityProcessing: false,
      issueTracking: 'public',
    },
  },
  {
    name: 'Basic',
    description: 'Perfect for individual developers',
    price: 12,
    interval: BillingInterval.MONTHLY,
    features: {
      apiRequestsPerMonth: 1000,
      maxTokensPerRequest: 2000,
      supportLevel: 'community',
      customInstructions: false,
      priorityProcessing: false,
      issueTracking: 'private',
    },
  },
  {
    name: 'Pro',
    description: 'Perfect for power users',
    price: 29,
    interval: BillingInterval.MONTHLY,
    features: {
      apiRequestsPerMonth: 5000,
      maxTokensPerRequest: 4000,
      supportLevel: 'email',
      customInstructions: true,
      priorityProcessing: true,
      issueTracking: 'private',
      priorityQueue: true,
    },
  },
  {
    name: 'Team',
    description: 'Great for small teams',
    price: 99,
    interval: BillingInterval.MONTHLY,
    features: {
      apiRequestsPerMonth: 20000,
      maxTokensPerRequest: 8000,
      supportLevel: 'priority',
      customInstructions: true,
      priorityProcessing: true,
      issueTracking: 'private',
      priorityQueue: true,
      teamCollaboration: true,
      sharedSnippets: true,
      usageAnalytics: true,
    },
  },
];

async function main() {
  console.log('Creating subscription tiers in Stripe...');

  for (const tier of tiers) {
    // Create product in Stripe
    const product = await stripe.products.create({
      name: tier.name,
      description: tier.description,
    });

    // Create price in Stripe
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.price * 100, // Convert to cents
      currency: 'usd',
      recurring: {
        interval: tier.interval === BillingInterval.MONTHLY ? 'month' : 'year',
      },
    });

    // Create tier in database
    await prisma.subscriptionTier.create({
      data: {
        name: tier.name,
        description: tier.description,
        price: tier.price,
        interval: tier.interval,
        features: tier.features,
        stripePriceId: price.id,
        active: true,
      },
    });

    console.log(`✅ Created ${tier.name} tier`);
  }

  console.log('\nAll subscription tiers have been created!');
}

main()
  .catch((error) => {
    console.error('Error setting up subscription tiers:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
