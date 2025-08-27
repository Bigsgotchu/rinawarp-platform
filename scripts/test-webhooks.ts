import Stripe from 'stripe';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import { logger } from '@rinawarp/shared';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-07-30.basil',
});

const webhookUrl = process.env.STRIPE_WEBHOOK_URL || 'http://localhost:3000/api/webhooks/stripe';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

async function testWebhook() {
  try {
    // Test event types to verify
    const testEvents = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'customer.created',
      'payment_intent.succeeded',
    ];

    for (const eventType of testEvents) {
      logger.info(`Testing webhook event: ${eventType}`);

      // Create a test event
      const eventId = `evt_${crypto.randomBytes(16).toString('hex')}`;
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        id: eventId,
        object: 'event',
        api_version: '2025-07-30.basil',
        created: timestamp,
        type: eventType,
        data: {
          object: {
            id: `obj_${crypto.randomBytes(16).toString('hex')}`,
            object: eventType.split('.')[0],
            created: timestamp,
          },
        },
        livemode: false,
        pending_webhooks: 0,
        request: {
          id: null,
          idempotency_key: null,
        },
      };

      // Sign the payload
      const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      // Send test webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': `t=${timestamp},v1=${signature}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook test failed for ${eventType}: ${response.status} ${response.statusText}`);
      }

      logger.info(`Successfully tested ${eventType}`);
    }

    // Test with real data: Create a customer and subscription
    logger.info('Testing with real data...');

    // Create a customer
    const customer = await stripe.customers.create({
      email: 'webhook.test@example.com',
      source: 'tok_visa',  // Use a test token
      metadata: {
        test: 'true',
      },
    });

    // Create a product
    const product = await stripe.products.create({
      name: 'Webhook Test Product',
      type: 'service',
    });

    // Create a price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 999,  // $9.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    // Create a subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    logger.info('Created test subscription, check webhook logs');

    // Wait for webhook processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Clean up
    await Promise.all([
      stripe.subscriptions.del(subscription.id),
      stripe.customers.del(customer.id),
      stripe.products.del(product.id),
    ]);

    logger.info('Webhook tests completed successfully');
  } catch (error) {
    logger.error('Webhook test failed:', error);
    throw error;
  }
}

// Run tests
testWebhook()
  .then(() => {
    logger.info('All webhook tests completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Webhook tests failed:', error);
    process.exit(1);
  });
