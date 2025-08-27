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

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        {
          const subscription = event.data.object as Stripe.Subscription;
          await subscriptionService.handleSubscriptionUpdate(subscription);
        }
        break;

      case 'customer.subscription.deleted':
        {
          const subscription = event.data.object as Stripe.Subscription;
          await subscriptionService.handleSubscriptionCancellation(subscription);
        }
        break;

      case 'invoice.payment_succeeded':
        {
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.subscription) {
            await subscriptionService.handleSuccessfulPayment(invoice);
          }
        }
        break;

      case 'invoice.payment_failed':
        {
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.subscription) {
            await subscriptionService.handleFailedPayment(invoice);
          }
        }
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
