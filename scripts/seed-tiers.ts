/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { PrismaClient, BillingInterval } from '@prisma/client';
import Stripe from 'stripe';

const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
const stripe = hasStripe ? new Stripe(process.env.STRIPE_SECRET_KEY as string) : (null as unknown as Stripe);
const prisma = new PrismaClient();

const tiers = [
  {
    name: 'Free',
    description: 'Basic terminal functionality',
    price: 0,
    interval: BillingInterval.MONTHLY,
    features: {
      aiAssistance: {
        requestsPerMonth: 100,
        maxTokensPerRequest: 1000,
        contextHistory: 5,
        responseSpeed: 'standard',
        modelAccess: ['claude-3-sonnet'],
      },
      terminal: {
        customPrompts: false,
        savedWorkflows: 3,
        shellHistory: 1000,
        multipleShells: false,
        autoSuggestions: true,
        syntaxHighlighting: true,
      },
      support: {
        type: 'community',
        responseTime: '48h',
        channels: ['github'],
      },
      development: {
        versionControl: true,
        projectTemplates: 3,
        codeSnippets: 10,
        codeReview: false,
        cicdIntegration: false,
      },
    },
  },
  {
    name: 'Professional',
    description: 'Advanced features for professional developers',
    price: 29,
    interval: BillingInterval.MONTHLY,
    features: {
      aiAssistance: {
        requestsPerMonth: 5000,
        maxTokensPerRequest: 4000,
        contextHistory: 20,
        responseSpeed: 'priority',
        modelAccess: ['claude-3-sonnet', 'claude-3-opus'],
      },
      terminal: {
        customPrompts: true,
        savedWorkflows: 50,
        shellHistory: 10000,
        multipleShells: true,
        autoSuggestions: true,
        syntaxHighlighting: true,
      },
      support: {
        type: 'email',
        responseTime: '24h',
        channels: ['github', 'email', 'slack'],
      },
      development: {
        versionControl: true,
        projectTemplates: 20,
        codeSnippets: 100,
        codeReview: true,
        cicdIntegration: true,
      },
    },
  },
  {
    name: 'Enterprise',
    description: 'Custom solutions for large teams',
    price: null, // Custom pricing
    interval: BillingInterval.MONTHLY,
    features: {
      aiAssistance: {
        requestsPerMonth: null, // Custom limit
        maxTokensPerRequest: 8000,
        contextHistory: null, // Unlimited
        responseSpeed: 'enterprise',
        modelAccess: ['claude-3-sonnet', 'claude-3-opus', 'claude-3-enterprise'],
      },
      terminal: {
        customPrompts: true,
        savedWorkflows: null, // Unlimited
        shellHistory: null, // Unlimited
        multipleShells: true,
        autoSuggestions: true,
        syntaxHighlighting: true,
      },
      support: {
        type: 'dedicated',
        responseTime: '1h',
        channels: ['github', 'email', 'slack', 'phone', 'video'],
      },
      development: {
        versionControl: true,
        projectTemplates: null, // Unlimited
        codeSnippets: null, // Unlimited
        codeReview: true,
        cicdIntegration: true,
        customWorkflows: true,
        teamManagement: true,
        auditLogs: true,
        ssoIntegration: true,
        customBranding: true,
      },
    },
  },
];

async function main() {
  console.log('Creating subscription tiers in Stripe and database...');

  // First, archive any existing products (if Stripe is configured)
  if (hasStripe) {
    const existingProducts = await stripe.products.list();
    for (const product of existingProducts.data) {
      await stripe.products.update(product.id, { active: false });
    }
  }

  // Then create new tiers
  for (const tier of tiers) {
    console.log(`\nCreating ${tier.name} tier...`);
    
    // Create product in Stripe (if configured)
    let productId: string | null = null;
    if (hasStripe) {
      const product = await stripe.products.create({
        name: tier.name,
        description: tier.description,
        active: true,
      });
      productId = product.id;
      console.log('Created Stripe product');
    } else {
      console.log('Stripe not configured: skipping product creation');
    }

    // Create price in Stripe (except for Enterprise which is custom priced)
    let priceId: string | null = null;
    if (hasStripe && tier.price !== null && productId) {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: tier.price * 100, // Convert to cents
        currency: 'usd',
        recurring: {
          interval: tier.interval === BillingInterval.MONTHLY ? 'month' : 'year',
        },
      });
      priceId = price.id;
      console.log('Created Stripe price');
    } else if (tier.price === null) {
      console.log('Skipping Stripe price creation for Enterprise tier');
    }

    // Create or update tier in database
    const existingTier = await prisma.subscriptionTier.findFirst({
      where: { name: tier.name }
    });

    if (existingTier) {
      await prisma.subscriptionTier.update({
        where: { id: existingTier.id },
        data: {
          description: tier.description,
          price: tier.price,
          interval: tier.interval,
          features: tier.features,
          stripePriceId: priceId,
          active: true,
        },
      });
      console.log('Updated existing tier in database');
    } else {
      await prisma.subscriptionTier.create({
        data: {
          name: tier.name,
          description: tier.description,
          price: tier.price,
          interval: tier.interval,
          features: tier.features,
          stripePriceId: priceId,
          active: true,
        },
      });
      console.log('Created new tier in database');
    }
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
