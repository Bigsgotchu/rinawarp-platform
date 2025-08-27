import { SubscriptionTier, UserSubscription, SubscriptionStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { APIError } from '../middleware/error-handler';
import Stripe from 'stripe';
import { logger } from '@rinawarp/shared';

export class SubscriptionService {
  async createSubscription(userId: string, tierId: string): Promise<UserSubscription> {
    const tier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
    });

    if (!tier) {
      throw new APIError(404, 'Subscription tier not found');
    }

    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (existingSubscription) {
      throw new APIError(400, 'User already has a subscription');
    }

    return prisma.userSubscription.create({
      data: {
        userId,
        tierId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculatePeriodEnd(new Date(), tier.interval),
        stripeSubscriptionId: 'pending', // This should be updated after Stripe integration
      },
    });
  }

  async updateSubscription(
    userId: string,
    tierId: string
  ): Promise<UserSubscription> {
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new APIError(404, 'Subscription not found');
    }

    const tier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
    });

    if (!tier) {
      throw new APIError(404, 'Subscription tier not found');
    }

    return prisma.userSubscription.update({
      where: { userId },
      data: {
        tierId,
        currentPeriodEnd: this.calculatePeriodEnd(subscription.currentPeriodStart, tier.interval),
      },
    });
  }

  async cancelSubscription(userId: string): Promise<UserSubscription> {
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new APIError(404, 'Subscription not found');
    }

    return prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: true,
      },
    });
  }

  async getSubscription(userId: string): Promise<UserSubscription | null> {
    return prisma.userSubscription.findUnique({
      where: { userId },
      include: {
        tier: true,
      },
    });
  }

  async listTiers(): Promise<SubscriptionTier[]> {
    return prisma.subscriptionTier.findMany({
      where: { active: true },
    });
  }

  private calculatePeriodEnd(startDate: Date, interval: string): Date {
    const end = new Date(startDate);
    if (interval === 'MONTHLY') {
      end.setMonth(end.getMonth() + 1);
    } else if (interval === 'YEARLY') {
      end.setFullYear(end.getFullYear() + 1);
    }
    return end;
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    const eventObject = event.data.object;
    
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(eventObject as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeletion(eventObject as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await this.handleSuccessfulPayment(eventObject as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleFailedPayment(eventObject as Stripe.Invoice);
        break;
      default:
        logger.info(`Unhandled subscription event type: ${event.type}`);
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (!user) {
      throw new Error(`No user found for Stripe customer ${customerId}`);
    }

    await prisma.userSubscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        tierId: 'default', // You'll need to map this from the price ID
        status: this.mapStripeStatus(subscription.status),
        stripeSubscriptionId: subscription.id,
        currentPeriodStart: new Date(((subscription as any).current_period_start || 0) * 1000),
        currentPeriodEnd: new Date(((subscription as any).current_period_end || 0) * 1000)
      },
      update: {
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(((subscription as any).current_period_start || 0) * 1000),
        currentPeriodEnd: new Date(((subscription as any).current_period_end || 0) * 1000)
      }
    });
  }

  private async handleSubscriptionDeletion(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (!user) {
      throw new Error(`No user found for Stripe customer ${customerId}`);
    }

    await prisma.userSubscription.update({
      where: { userId: user.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: true
      }
    });
  }

  private async handleSuccessfulPayment(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.customer) return;

    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
    
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (!user) {
      throw new Error(`No user found for Stripe customer ${customerId}`);
    }

    await prisma.userSubscription.updateMany({
      where: { userId: user.id },
      data: {
        status: SubscriptionStatus.ACTIVE
      }
    });
  }

  private async handleFailedPayment(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.customer) return;

    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
    
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (!user) {
      throw new Error(`No user found for Stripe customer ${customerId}`);
    }

    await prisma.userSubscription.updateMany({
      where: { userId: user.id },
      data: {
        status: SubscriptionStatus.PAST_DUE
      }
    });
  }

  private mapStripeStatus(status: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      'active': SubscriptionStatus.ACTIVE,
      'past_due': SubscriptionStatus.PAST_DUE,
      'canceled': SubscriptionStatus.CANCELED,
      'incomplete': SubscriptionStatus.INCOMPLETE,
      'incomplete_expired': SubscriptionStatus.INCOMPLETE_EXPIRED,
      'trialing': SubscriptionStatus.TRIALING,
      'unpaid': SubscriptionStatus.UNPAID
    };
    return statusMap[status] || SubscriptionStatus.INCOMPLETE;
  }
}
