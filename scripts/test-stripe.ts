import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY environment variable is not set');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function testStripeConnection() {
  try {
    const balance = await stripe.balance.retrieve();
    console.log('✅ Successfully connected to Stripe!');
    console.log('Current balance:', balance);
  } catch (error: any) {
    console.error('❌ Failed to connect to Stripe:', error?.message || error);
    process.exit(1);
  }
}

testStripeConnection();
