/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import express from 'express';
import cors from 'cors';
import emailPreferencesRouter from './routes/user/email-preferences';
import unsubscribeRouter from './routes/unsubscribe';
import sendgridWebhookRouter from './routes/webhooks/sendgrid';
import { PrismaClient, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { stripeWebhookHandler } from './handlers/stripe-webhook';
import { trackApiUsage, checkUsageLimits } from './middleware/usage-tracking';
import { EmailService, EmailTemplate } from './services/email';
import { initializeAutomatedEmails } from './startup/init-automated-emails';
import usageRoutes from './routes/usage';
import adminRoutes from './routes/admin';

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Configure email service
const emailService = new EmailService({
  provider: process.env.EMAIL_PROVIDER as 'sendgrid' || 'sendgrid',
  apiKey: process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY,
  defaultFrom: process.env.EMAIL_FROM || 'notifications@rinawarptech.com'
});

app.use(cors());

// Stripe webhook endpoint needs raw body
app.post('/api/subscriptions/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// Other routes use JSON parsing
app.use(express.json());

// Apply usage tracking middleware
app.use(trackApiUsage);

// Configure routes
app.use(usageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user/email-preferences', emailPreferencesRouter);
app.use('/unsubscribe', unsubscribeRouter);
app.use('/api/webhooks/sendgrid', sendgridWebhookRouter);

// List subscription tiers with optional filtering
app.get('/api/subscription-tiers', async (req, res) => {
  try {
    const { includeInactive, sortBy } = req.query;
    
    // Build where clause
    const where = includeInactive === 'true' ? {} : { active: true };
    
    // Build sort order
    const orderBy: Prisma.SubscriptionTierOrderByWithRelationInput = { price: (sortBy === 'desc' ? 'desc' : 'asc') };

    const tiers = await prisma.subscriptionTier.findMany({
      where,
      orderBy,
    });

    res.json(tiers);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch subscription tiers',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get detailed feature comparison
app.get('/api/subscription-tiers/compare', async (_req, res) => {
  try {
    const tiers = await prisma.subscriptionTier.findMany({
      where: { active: true },
      orderBy: { price: 'asc' }
    });

    // Transform features into comparison matrix
    const comparison = {
      aiAssistance: {
        title: 'AI Assistance',
        features: {
          'Monthly Requests': tiers.map(t => {
            const f = t.features as any;
            return f.aiAssistance.requestsPerMonth === null ? 'Custom' : f.aiAssistance.requestsPerMonth;
          }),
          'Max Tokens/Request': tiers.map(t => {
            const f = t.features as any;
            return f.aiAssistance.maxTokensPerRequest;
          }),
          'Context History': tiers.map(t => {
            const f = t.features as any;
            return f.aiAssistance.contextHistory === null ? 'Unlimited' : f.aiAssistance.contextHistory;
          }),
          'Response Speed': tiers.map(t => {
            const f = t.features as any;
            return f.aiAssistance.responseSpeed;
          }),
          'Available Models': tiers.map(t => {
            const f = t.features as any;
            return f.aiAssistance.modelAccess.join(', ');
          }),
        }
      },
      terminal: {
        title: 'Terminal Features',
        features: {
          'Custom Prompts': tiers.map(t => {
            const f = t.features as any;
            return f.terminal.customPrompts ? '✓' : '×';
          }),
          'Saved Workflows': tiers.map(t => {
            const f = t.features as any;
            return f.terminal.savedWorkflows === null ? 'Unlimited' : f.terminal.savedWorkflows;
          }),
          'Shell History': tiers.map(t => {
            const f = t.features as any;
            return f.terminal.shellHistory === null ? 'Unlimited' : f.terminal.shellHistory;
          }),
          'Multiple Shells': tiers.map(t => {
            const f = t.features as any;
            return f.terminal.multipleShells ? '✓' : '×';
          }),
        }
      },
      support: {
        title: 'Support',
        features: {
          'Type': tiers.map(t => {
            const f = t.features as any;
            return f.support.type;
          }),
          'Response Time': tiers.map(t => {
            const f = t.features as any;
            return f.support.responseTime;
          }),
          'Support Channels': tiers.map(t => {
            const f = t.features as any;
            return f.support.channels.join(', ');
          }),
        }
      },
      development: {
        title: 'Development Tools',
        features: {
          'Version Control': tiers.map(t => {
            const f = t.features as any;
            return f.development.versionControl ? '✓' : '×';
          }),
          'Project Templates': tiers.map(t => {
            const f = t.features as any;
            return f.development.projectTemplates === null ? 'Unlimited' : f.development.projectTemplates;
          }),
          'Code Snippets': tiers.map(t => {
            const f = t.features as any;
            return f.development.codeSnippets === null ? 'Unlimited' : f.development.codeSnippets;
          }),
          'Code Review': tiers.map(t => {
            const f = t.features as any;
            return f.development.codeReview ? '✓' : '×';
          }),
          'CI/CD Integration': tiers.map(t => {
            const f = t.features as any;
            return f.development.cicdIntegration ? '✓' : '×';
          }),
        }
      },
    };

    res.json({
      tiers: tiers.map(t => ({
        id: t.id,
        name: t.name,
        price: t.price,
        description: t.description
      })),
      comparison
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to generate feature comparison',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get details for a specific tier
app.get('/api/subscription-tiers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const tier = await prisma.subscriptionTier.findUnique({
      where: { id },
      include: {
        subscriptions: {
          select: {
            id: true,
            status: true,
            currentPeriodEnd: true
          }
        }
      }
    });

    if (!tier) {
      return res.status(404).json({ error: 'Subscription tier not found' });
    }

    res.json(tier);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch subscription tier',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Subscribe to a tier
app.post('/api/subscribe', async (req, res) => {
  try {
    const { tierId, paymentMethodId, userId } = req.body;
    
    // Validate input
    if (!tierId || !paymentMethodId || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['tierId', 'paymentMethodId', 'userId']
      });
    }

    // Get user and tier
    const [user, tier] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.subscriptionTier.findUnique({ where: { id: tierId } })
    ]);

    if (!user || !tier) {
      return res.status(404).json({ 
        error: 'User or subscription tier not found' 
      });
    }

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id }
      });
      customerId = customer.id;
      
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id }
      });
    }

    // Attach payment method
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Create subscription
    const subscription: any = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: tier.stripePriceId || undefined }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent']
    });

    // Create subscription record
    const userSubscription = await prisma.userSubscription.create({
      data: {
        userId: user.id,
        tierId: tier.id,
        status: mapStripeStatus(subscription.status),
        stripeSubscriptionId: subscription.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      }
    });

    res.json(userSubscription);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to create subscription',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

function mapStripeStatus(status: string): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'TRIALING' | 'UNPAID' {
  const statusMap: Record<string, any> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    trialing: 'TRIALING',
    unpaid: 'UNPAID'
  };
  return statusMap[status] || 'INCOMPLETE';
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Initialize automated email service
initializeAutomatedEmails();

app.listen(port, '0.0.0.0', () => {
  console.log(`
🚀 Server running successfully
   
   • HTTP server: http://localhost:${port}
   • Email service: initialized
   • Automated emails: configured
   • Usage tracking: enabled
   • Stripe webhooks: ready
  `);
});
