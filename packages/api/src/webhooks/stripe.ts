import { Request, Response } from 'express';
import { logger } from '@rinawarp/shared';
import { StripeService } from '../services/stripe.service';
import { RevenueService } from '../services/revenue.service';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

const stripeService = new StripeService();
const revenueService = new RevenueService();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function stripeWebhookHandler(req: Request, res: Response): Promise<Response> {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    if (!sig) {
      logger.warn('Missing Stripe signature');
      return res.status(400).send('Missing signature');
    }

    // With express.raw middleware, req.body contains the raw body
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

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
        await Promise.all([
          stripeService.handleInvoiceSucceeded(event),
          revenueService.recordPayment(event.data.object as Stripe.Invoice)
        ]);
        break;

      case 'invoice.payment_failed':
        await stripeService.handleInvoiceFailed(event);
        break;

      case 'payment_intent.succeeded':
        // Handle payment success
        logger.info('Payment succeeded:', event.data.object);
        break;

      case 'payment_intent.payment_failed':
        // Handle payment failure
        logger.error('Payment failed:', event.data.object);
        break;

      case 'product.created':
      case 'product.updated':
      case 'product.deleted':
        // Just log these during test - in production we might want to sync product data
        logger.debug(`Received product event: ${event.type}`, {
          productId: (event.data.object as Stripe.Product).id
        });
        break;

      default:
        logger.warn(`Unhandled event type: ${event.type}`, {
          eventId: event.id,
          object: event.data.object.object,
          created: new Date(event.created * 1000).toISOString()
        });
    }

    return res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook error:', err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }
}
