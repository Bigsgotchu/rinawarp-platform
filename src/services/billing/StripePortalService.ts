import Stripe from 'stripe';
import { PLAN_FEATURES } from '../types/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import db from '../utils/db';

class StripePortalService {
  private stripe: Stripe;
  private readonly returnUrl: string;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
    this.returnUrl = process.env.FRONTEND_URL! + '/settings/billing';

    // Initialize the customer portal configuration
    this.initializePortalConfig().catch(error => {
      logger.error('Failed to initialize customer portal config:', error);
    });
  }

  async createPortalSession(userId: string): Promise<string> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
        },
      });

      if (!user?.stripeCustomerId) {
        throw new AppError(
          'User not found or no billing setup',
          'INVALID_USER',
          400
        );
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: this.returnUrl,
        configuration: process.env.STRIPE_PORTAL_CONFIG_ID,
      });

      return session.url;
    } catch (error) {
      logger.error('Failed to create portal session:', error);
      throw new AppError(
        'Could not create billing portal session',
        'PORTAL_ERROR',
        500
      );
    }
  }

  private async initializePortalConfig(): Promise<void> {
    try {
      // Check if configuration already exists
      const configs = await this.stripe.billingPortal.configurations.list();
      if (configs.data.length > 0) {
        // Use existing config
        process.env.STRIPE_PORTAL_CONFIG_ID = configs.data[0].id;
        return;
      }

      // Create business information
      const businessProfile =
        await this.stripe.billingPortal.configurations.create({
          business_profile: {
            headline: 'Rinawarp Terminal Billing',
            privacy_policy_url: `${process.env.FRONTEND_URL}/privacy`,
            terms_of_service_url: `${process.env.FRONTEND_URL}/terms`,
          },
          features: {
            payment_method_update: {
              enabled: true,
            },
            customer_update: {
              allowed_updates: ['email', 'tax_id'],
              enabled: true,
            },
            subscription_cancel: {
              enabled: true,
              mode: 'at_period_end',
              proration_behavior: 'create_prorations',
              cancellation_reason: {
                enabled: true,
                options: [
                  'too_expensive',
                  'missing_features',
                  'switched_to_competitor',
                  'not_using',
                  'other',
                ],
              },
            },
            subscription_pause: {
              enabled: false,
            },
            invoice_history: {
              enabled: true,
            },
          },
          login_page: {
            enabled: true,
          },
        });

      process.env.STRIPE_PORTAL_CONFIG_ID = businessProfile.id;
    } catch (error) {
      logger.error('Failed to initialize portal configuration:', error);
      throw error;
    }
  }

  async getPortalFeatures(): Promise<any> {
    try {
      const config = await this.stripe.billingPortal.configurations.retrieve(
        process.env.STRIPE_PORTAL_CONFIG_ID!
      );

      return {
        canUpdatePaymentMethod: config.features.payment_method_update.enabled,
        canUpdateProfile: config.features.customer_update.enabled,
        canCancelSubscription: config.features.subscription_cancel.enabled,
        canPauseSubscription: config.features.subscription_pause.enabled,
        canViewInvoices: config.features.invoice_history.enabled,
      };
    } catch (error) {
      logger.error('Failed to get portal features:', error);
      throw error;
    }
  }

  async updatePortalConfig(features: {
    allowPaymentUpdate?: boolean;
    allowProfileUpdate?: boolean;
    allowCancel?: boolean;
    allowPause?: boolean;
    customRedirectUrls?: {
      return_url?: string;
      cancel_url?: string;
    };
  }): Promise<void> {
    try {
      await this.stripe.billingPortal.configurations.update(
        process.env.STRIPE_PORTAL_CONFIG_ID!,
        {
          features: {
            payment_method_update: {
              enabled: features.allowPaymentUpdate,
            },
            customer_update: {
              enabled: features.allowProfileUpdate,
              allowed_updates: ['email', 'tax_id'],
            },
            subscription_cancel: {
              enabled: features.allowCancel,
              mode: 'at_period_end',
              proration_behavior: 'create_prorations',
            },
            subscription_pause: {
              enabled: features.allowPause,
            },
          },
          ...features.customRedirectUrls,
        }
      );
    } catch (error) {
      logger.error('Failed to update portal configuration:', error);
      throw error;
    }
  }

  async getCustomerPortalLink(userId: string): Promise<string> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
          email: true,
        },
      });

      if (!user?.stripeCustomerId) {
        throw new AppError(
          'User not found or no billing setup',
          'INVALID_USER',
          400
        );
      }

      // Create session with specific features enabled
      const session = await this.stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: this.returnUrl,
        configuration: process.env.STRIPE_PORTAL_CONFIG_ID,
        flow_data: {
          type: 'subscription_cancel',
          subscription_cancel: {
            subscription: user.stripeCustomerId,
          },
        },
      });

      return session.url;
    } catch (error) {
      logger.error('Failed to get customer portal link:', error);
      throw new AppError(
        'Could not generate customer portal link',
        'PORTAL_ERROR',
        500
      );
    }
  }

  async createCheckoutSession(
    userId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
          email: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 'INVALID_USER', 400);
      }

      const session = await this.stripe.checkout.sessions.create({
        customer: user.stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: user.email,
      });

      return session.url;
    } catch (error) {
      logger.error('Failed to create checkout session:', error);
      throw new AppError(
        'Could not create checkout session',
        'CHECKOUT_ERROR',
        500
      );
    }
  }

  async handlePortalEvent(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(
            event.data.object as Stripe.Subscription
          );
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancellation(
            event.data.object as Stripe.Subscription
          );
          break;

        case 'customer.updated':
          await this.handleCustomerUpdate(event.data.object as Stripe.Customer);
          break;

        case 'invoice.payment_succeeded':
          await this.handleSuccessfulPayment(
            event.data.object as Stripe.Invoice
          );
          break;

        case 'invoice.payment_failed':
          await this.handleFailedPayment(event.data.object as Stripe.Invoice);
          break;

        default:
          logger.info(`Unhandled portal event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Failed to handle portal event:', error);
      throw error;
    }
  }

  private async handleSubscriptionUpdate(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const user = await db.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (!user) return;

    await db.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  }

  private async handleSubscriptionCancellation(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const user = await db.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (!user) return;

    await db.user.update({
      where: { id: user.id },
      data: {
        currentPlan: 'FREE',
        subscriptionId: null,
        subscriptionStatus: 'cancelled',
      },
    });
  }

  private async handleCustomerUpdate(customer: Stripe.Customer): Promise<void> {
    const user = await db.user.findFirst({
      where: { stripeCustomerId: customer.id },
    });

    if (!user) return;

    await db.user.update({
      where: { id: user.id },
      data: {
        email: customer.email!,
      },
    });
  }

  private async handleSuccessfulPayment(
    invoice: Stripe.Invoice
  ): Promise<void> {
    const user = await db.user.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });

    if (!user) return;

    await db.paymentHistory.create({
      data: {
        userId: user.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        stripeInvoiceId: invoice.id,
        status: 'PAID',
        metadata: {
          items: invoice.lines.data,
          billing_reason: invoice.billing_reason,
        },
      },
    });
  }

  private async handleFailedPayment(invoice: Stripe.Invoice): Promise<void> {
    const user = await db.user.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });

    if (!user) return;

    await db.paymentHistory.create({
      data: {
        userId: user.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        stripeInvoiceId: invoice.id,
        status: 'FAILED',
        metadata: {
          items: invoice.lines.data,
          billing_reason: invoice.billing_reason,
          failure_reason: invoice.last_payment_error?.message,
        },
      },
    });
  }
}

export default new StripePortalService();
