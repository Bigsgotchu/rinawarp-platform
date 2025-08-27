import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil' as Stripe.LatestApiVersion,
});

async function createProducts() {
  try {
    // Create Pro product
    const proProduct = await stripe.products.create({
      name: 'RinaWarp Pro',
      description: 'Professional plan with unlimited AI requests and advanced features',
      default_price_data: {
        currency: 'usd',
        unit_amount: 1900, // $19.00
        recurring: {
          interval: 'month',
        },
      },
      metadata: {
        plan: 'pro',
        features: JSON.stringify([
          'Unlimited AI requests',
          'Priority support',
          'All terminal features',
          'Custom themes',
          'API access',
          'Up to 5 team members',
        ]),
      },
    });

    // Create annual Pro price
    const proAnnualPrice = await stripe.prices.create({
      product: proProduct.id,
      currency: 'usd',
      unit_amount: 19000, // $190.00
      recurring: {
        interval: 'year',
      },
      metadata: {
        plan: 'pro',
        billing: 'annual',
      },
    });

    // Create Team product
    const teamProduct = await stripe.products.create({
      name: 'RinaWarp Team',
      description: 'Team plan with enterprise features and dedicated support',
      default_price_data: {
        currency: 'usd',
        unit_amount: 4900, // $49.00
        recurring: {
          interval: 'month',
        },
      },
      metadata: {
        plan: 'team',
        features: JSON.stringify([
          'Everything in Pro',
          'SSO integration',
          'Advanced analytics',
          'Custom integrations',
          'SLA guarantee',
          'Dedicated support manager',
          'Custom feature development',
          'Minimum 5 users',
        ]),
      },
    });

    // Create annual Team price
    const teamAnnualPrice = await stripe.prices.create({
      product: teamProduct.id,
      currency: 'usd',
      unit_amount: 49000, // $490.00
      recurring: {
        interval: 'year',
      },
      metadata: {
        plan: 'team',
        billing: 'annual',
      },
    });

    console.log('Created products and prices:', {
      pro: {
        product: proProduct,
        monthlyPrice: proProduct.default_price,
        annualPrice: proAnnualPrice,
      },
      team: {
        product: teamProduct,
        monthlyPrice: teamProduct.default_price,
        annualPrice: teamAnnualPrice,
      },
    });

    // Create webhook endpoint
    const webhook = await stripe.webhookEndpoints.create({
      url: `${process.env.API_URL}/stripe/webhook`,
      enabled_events: [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'customer.updated',
        'invoice.paid',
        'invoice.payment_failed',
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
      ],
    });

    console.log('Created webhook endpoint:', webhook);

  } catch (error) {
    console.error('Error creating Stripe products:', error);
    process.exit(1);
  }
}

createProducts();
