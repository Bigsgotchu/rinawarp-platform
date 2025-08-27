import { Router } from 'express';
import { StripeService } from '../../services/stripe.service';
import { logger } from '@rinawarp/shared';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-07-30.basil',
});
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripeService = new StripeService();

router.post('/', async (req: any, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    logger.warn('Missing stripe-signature header');
    return res.status(400).send('Missing stripe-signature header');
  }

  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      req.body, // Buffer provided by express.raw
      sig,
      stripeWebhookSecret
    );

    logger.info(`Processing Stripe event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await stripeService.handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await stripeService.handleSubscriptionDeleted(event);
        break;
      case 'invoice.payment_succeeded':
        await stripeService.handleInvoiceSucceeded(event);
        break;
      case 'invoice.payment_failed':
        await stripeService.handleInvoiceFailed(event);
        break;
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
