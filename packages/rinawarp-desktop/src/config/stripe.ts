/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { loadStripe } from '@stripe/stripe-js';
import { logger } from '../utils/logger';

export class StripeService {
  private static instance: StripeService;
  private stripe: any = null;

  private constructor() {}

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      this.stripe = await loadStripe(process.env.STRIPE_PUBLIC_KEY!);
    } catch (error) {
      logger.error('Failed to initialize Stripe:', error);
      throw error;
    }
  }

  public async createSubscription(priceId: string): Promise<any> {
    try {
      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
        }),
      });

      const session = await response.json();
      return this.stripe.redirectToCheckout({ sessionId: session.id });
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw error;
    }
  }

  public async manageSubscription(): Promise<void> {
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
      });
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      logger.error('Failed to manage subscription:', error);
      throw error;
    }
  }
}
