import { Router } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import Stripe from 'stripe';
import { logger } from '@rinawarp/shared';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-07-30.basil',
});

const subscriptionService = new SubscriptionService();

// Stripe webhook handler
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ error: 'No signature provided' });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    logger.info('Processing Stripe webhook event:', { type: event.type, id: event.id });
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await subscriptionService.handleWebhookEvent(event);
        break;

      case 'customer.subscription.deleted':
        await subscriptionService.handleWebhookEvent(event);
        break;

      case 'invoice.payment_succeeded':
        await subscriptionService.handleWebhookEvent(event);
        break;

      case 'invoice.payment_failed':
        await subscriptionService.handleWebhookEvent(event);
        break;

      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook error:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }
});

export default router;
