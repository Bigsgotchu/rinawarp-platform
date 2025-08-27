import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil' as Stripe.LatestApiVersion,
});

async function testSubscription() {
  try {
    // Create a test customer
    const customer = await stripe.customers.create({
      email: 'test@rinawarptech.com',
      source: 'tok_visa', // Test card token
    });

    console.log('Created test customer:', customer);

    // Create a subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: 'price_H5ggYwtDq4fbrJ', // Use the Pro plan price ID
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    console.log('Created subscription:', subscription);

    // Simulate webhook events
    await stripe.testHelpers.testClock.create({
      frozen_time: Math.floor(Date.now() / 1000),
      name: 'Monthly Subscription',
    });

  } catch (error) {
    console.error('Error testing subscription:', error);
    process.exit(1);
  }
}

testSubscription();
