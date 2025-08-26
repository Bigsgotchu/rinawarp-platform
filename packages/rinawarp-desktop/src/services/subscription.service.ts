/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { doc, getDoc, updateDoc } from '@firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { StripeService } from '../config/stripe';
import {
  SubscriptionDetails,
  SubscriptionPlan,
  BillingDetails,
  Invoice,
} from '../types/profile';

export class SubscriptionService {
  private static instance: SubscriptionService;
  private stripeService: StripeService;

  private constructor() {
    this.stripeService = StripeService.getInstance();
  }

  public static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  public async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const plansDoc = await getDoc(doc(db, 'config', 'subscription_plans'));
      return plansDoc.data()?.plans || [];
    } catch (error) {
      logger.error('Failed to fetch subscription plans:', error);
      throw error;
    }
  }

  public async getCurrentSubscription(userId: string): Promise<SubscriptionDetails> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      return userDoc.data()?.subscription;
    } catch (error) {
      logger.error('Failed to fetch current subscription:', error);
      throw error;
    }
  }

  public async subscribeToPlan(
    userId: string,
    planId: string
  ): Promise<SubscriptionDetails> {
    try {
      // Get plan details
      const plans = await this.getSubscriptionPlans();
      const plan = plans.find(p => p.id === planId);
      if (!plan) {
        throw new Error('Invalid plan selected');
      }

      // Create Stripe subscription
      const session = await this.stripeService.createSubscription(planId);

      // Update user's subscription in Firestore
      const userRef = doc(db, 'users', userId);
      const subscription: SubscriptionDetails = {
        plan: plan.name.toLowerCase() as 'free' | 'pro' | 'enterprise',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        cancelAtPeriodEnd: false,
        features: plan.features,
      };

      await updateDoc(userRef, { subscription });
      return subscription;
    } catch (error) {
      logger.error('Failed to subscribe to plan:', error);
      throw error;
    }
  }

  public async cancelSubscription(userId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        'subscription.cancelAtPeriodEnd': true,
        'subscription.status': 'cancelled',
      });
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  public async getBillingDetails(userId: string): Promise<BillingDetails> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      return userDoc.data()?.billing;
    } catch (error) {
      logger.error('Failed to fetch billing details:', error);
      throw error;
    }
  }

  public async getInvoices(userId: string): Promise<Invoice[]> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      return userDoc.data()?.billing?.invoices || [];
    } catch (error) {
      logger.error('Failed to fetch invoices:', error);
      throw error;
    }
  }

  public async updatePaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        'billing.defaultPaymentMethod': paymentMethodId,
      });
    } catch (error) {
      logger.error('Failed to update payment method:', error);
      throw error;
    }
  }

  public isFeatureAvailable(
    subscription: SubscriptionDetails,
    feature: string
  ): boolean {
    return subscription.features.includes(feature);
  }

  public async manageSubscription(userId: string): Promise<void> {
    try {
      await this.stripeService.manageSubscription();
    } catch (error) {
      logger.error('Failed to open subscription management:', error);
      throw error;
    }
  }
}
