import { EventEmitter } from 'events';
import { db } from '../database';
import { StripeService } from './stripe';
import { logger } from '../../utils/logger';
import { LicenseService } from './license';
import { CacheService } from './cache';

export interface Subscription {
  id: string;
  userId: string;
  tier: string;
  status: string;
  seats?: number;
  trialEnd?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  prices: {
    monthly: number;
    annual: number;
  };
  limits: {
    minSeats?: number;
    maxSeats?: number;
  };
}

export class SubscriptionService extends EventEmitter {
  private stripe: StripeService;
  private license: LicenseService;
  private cache: CacheService;
  
  private readonly cacheTTL = 3600; // 1 hour
  private readonly subscriptionCachePrefix = 'subscription:';

  constructor() {
    super();
    this.stripe = new StripeService();
    this.license = new LicenseService();
    this.cache = new CacheService();
  }

  /**
   * Get user's subscription
   */
  public async getSubscription(userId: string): Promise<Subscription | null> {
    const cacheKey = `${this.subscriptionCachePrefix}${userId}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      return db.subscriptions.findOne({
        userId,
        status: 'active'
      });
    }, this.cacheTTL);
  }

  /**
   * Create subscription
   */
  public async createSubscription(
    userId: string,
    plan: string,
    options: {
      seats?: number;
      annual?: boolean;
      trial?: boolean;
    } = {}
  ): Promise<{
    subscriptionId: string;
    clientSecret: string;
  }> {
    try {
      // Get user
      const user = await db.users.findOne({ id: userId });
      if (!user) {
        throw new Error('User not found');
      }

      // Get or create Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        stripeCustomerId = await this.stripe.createCustomer(
          user.email,
          user.name,
          { userId }
        );

        await db.users.update(userId, { stripeCustomerId });
        
        // Invalidate user cache
        await this.cache.delete(`user:${userId}`);
      }

      // Get price ID
      const priceId = this.getPriceId(plan, options.annual);
      if (!priceId) {
        throw new Error('Invalid plan');
      }

      // Create subscription
      const result = await this.stripe.createSubscription(
        stripeCustomerId,
        priceId,
        {
          seats: options.seats,
          trialDays: options.trial ? 14 : undefined,
          metadata: {
            userId,
            plan
          }
        }
      );

      return result;
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription
   */
  public async updateSubscription(
    subscriptionId: string,
    updates: {
      plan?: string;
      seats?: number;
      annual?: boolean;
    }
  ): Promise<void> {
    try {
      const subscription = await db.subscriptions.findOne({
        id: subscriptionId
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const stripeUpdates: {
        priceId?: string;
        seats?: number;
      } = {};

      if (updates.plan || updates.annual !== undefined) {
        const priceId = this.getPriceId(
          updates.plan || subscription.tier,
          updates.annual
        );
        if (!priceId) {
          throw new Error('Invalid plan');
        }
        stripeUpdates.priceId = priceId;
      }

      if (updates.seats !== undefined) {
        stripeUpdates.seats = updates.seats;
      }

      await this.stripe.updateSubscription(
        subscription.stripeSubscriptionId!,
        stripeUpdates
      );
      
      // Invalidate subscription cache
      await this.cache.delete(`${this.subscriptionCachePrefix}${subscription.userId}`);
    } catch (error) {
      logger.error('Failed to update subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  public async cancelSubscription(
    subscriptionId: string,
    immediate: boolean = false
  ): Promise<void> {
    try {
      const subscription = await db.subscriptions.findOne({
        id: subscriptionId
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      await this.stripe.cancelSubscription(
        subscription.stripeSubscriptionId!,
        immediate
      );

      if (immediate) {
        await this.license.deactivateLicense(subscription.userId);
        
        // Invalidate subscription and license caches
        await this.cache.mdelete([
          `${this.subscriptionCachePrefix}${subscription.userId}`,
          `license:${subscription.userId}`
        ]);
      }
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  /**
   * Get available plans
   */
  public async getPlans(): Promise<SubscriptionPlan[]> {
    const cacheKey = 'subscription:plans';
    
    return this.cache.getOrSet(cacheKey, async () => {
      return [
        {
          id: 'pro',
          name: 'Pro',
          description: 'For professional developers who want to boost their productivity.',
          features: [
            'AI-powered assistance',
            'Advanced autocomplete',
            'Smart automation',
            'Code intelligence',
            'Enhanced Git features',
            'Priority support'
          ],
          prices: {
            monthly: 49,
            annual: 39 * 12
          },
          limits: {}
        },
        {
          id: 'team',
          name: 'Team',
          description: 'For development teams that want to collaborate effectively.',
          features: [
            'Everything in Pro',
            'Team sharing',
            'Shared context',
            'Custom workflows',
            'Usage analytics',
            'Role management',
            'Dedicated support'
          ],
          prices: {
            monthly: 99,
            annual: 89 * 12
          },
          limits: {
            minSeats: 5,
            maxSeats: 50
          }
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          description: 'Custom solutions for large organizations.',
          features: [
            'Everything in Team',
            'Custom integrations',
            'Advanced security',
            'Audit logging',
            'SSO support',
            'SLA guarantees',
            '24/7 support'
          ],
          prices: {
            monthly: 149,
            annual: 139 * 12
          },
          limits: {
            minSeats: 50
          }
        }
      ];
    }, 24 * 3600); // Cache plans for 24 hours
  }

  /**
   * Get price ID for plan
   */
  private getPriceId(plan: string, annual?: boolean): string | null {
    const prices: Record<string, string> = {
      'pro-monthly': process.env.STRIPE_PRICE_PRO_MONTHLY!,
      'pro-annual': process.env.STRIPE_PRICE_PRO_ANNUAL!,
      'team-monthly': process.env.STRIPE_PRICE_TEAM_MONTHLY!,
      'team-annual': process.env.STRIPE_PRICE_TEAM_ANNUAL!,
      'enterprise-monthly': process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY!,
      'enterprise-annual': process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL!
    };

    const key = `${plan}-${annual ? 'annual' : 'monthly'}`;
    return prices[key] || null;
  }
}
