import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { logger } from '@rinawarp/shared';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-07-30.basil',
});

async function syncProducts() {
  try {
    // Get all subscription tiers from database
    const tiers = await prisma.subscriptionTier.findMany({
      where: { active: true },
    });

    for (const tier of tiers) {
      // Create or update product
      let stripeProduct;
      if (tier.stripePriceId) {
        // Get existing price
        const price = await stripe.prices.retrieve(tier.stripePriceId);
        stripeProduct = await stripe.products.retrieve(price.product as string);
        
        // Update product
        await stripe.products.update(stripeProduct.id, {
          name: tier.name,
          description: tier.description,
          metadata: {
            tierId: tier.id,
            features: JSON.stringify(tier.features),
          },
        });
      } else {
        // Create new product and price
        stripeProduct = await stripe.products.create({
          name: tier.name,
          description: tier.description,
          metadata: {
            tierId: tier.id,
            features: JSON.stringify(tier.features),
          },
        });

        const price = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: Math.round(tier.price * 100),
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

        logger.info(`Created new price for tier ${tier.name}:`, {
          tierId: tier.id,
          priceId: price.id,
        });
      }
    }

    logger.info('Successfully synced all products with Stripe');
  } catch (error) {
    logger.error('Failed to sync products:', error);
    throw error;
  }
}

// Run sync
syncProducts()
  .catch((error) => {
    logger.error('Sync failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
