// Example client-side code for Stripe integration

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_PUBLIC_KEY!);

// Example: Redirect to Stripe Checkout
async function redirectToCheckout(tierId: string) {
  try {
    const response = await fetch('/api/checkout/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, // Your JWT token
      },
      body: JSON.stringify({
        tierId,
        successUrl: `${window.location.origin}/subscription/success`,
        cancelUrl: `${window.location.origin}/subscription/canceled`,
      }),
    });

    const { url } = await response.json();
    window.location.href = url;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example: Redirect to Customer Portal
async function redirectToCustomerPortal() {
  try {
    const response = await fetch('/api/checkout/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, // Your JWT token
      },
      body: JSON.stringify({
        returnUrl: `${window.location.origin}/account`,
      }),
    });

    const { url } = await response.json();
    window.location.href = url;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example React component for subscription page
/*
import React from 'react';

export function SubscriptionPage() {
  const handleSubscribe = async (tierId: string) => {
    await redirectToCheckout(tierId);
  };

  const handleManageSubscription = async () => {
    await redirectToCustomerPortal();
  };

  return (
    <div>
      <h1>Choose Your Plan</h1>
      <div className="pricing-tiers">
        {tiers.map((tier) => (
          <div key={tier.id} className="tier">
            <h2>{tier.name}</h2>
            <p>{tier.description}</p>
            <p>${tier.price}/month</p>
            <button onClick={() => handleSubscribe(tier.id)}>
              Subscribe
            </button>
          </div>
        ))}
      </div>
      
      <div className="account-section">
        <button onClick={handleManageSubscription}>
          Manage Subscription
        </button>
      </div>
    </div>
  );
}
*/

// Example success page
/*
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function SubscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      // Optionally verify the session on your backend
      fetch('/api/checkout/verify-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });
    }
  }, [sessionId]);

  return (
    <div>
      <h1>Thanks for subscribing!</h1>
      <p>Your subscription is now active.</p>
    </div>
  );
}
*/
