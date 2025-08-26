import { PaymentStatus, SubscriptionPlan } from '../types/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import db from '../utils/db';
import StripeService from './StripeService';
import { sendEmail } from '../utils/email';

interface BillingCycle {
  startDate: Date;
  endDate: Date;
  amount: number;
  items: BillingItem[];
}

interface BillingItem {
  description: string;
  amount: number;
  quantity?: number;
  metadata?: Record<string, any>;
}

class BillingService {
  private readonly PLAN_PRICES = {
    [SubscriptionPlan.FREE]: 0,
    [SubscriptionPlan.BASIC]: 1000, // $10.00
    [SubscriptionPlan.PRO]: 5000, // $50.00
    [SubscriptionPlan.ENTERPRISE]: 20000, // $200.00
  };

  private readonly USAGE_RATES = {
    [SubscriptionPlan.BASIC]: {
      additionalCommands: 0.01, // $0.01 per command
      additionalWorkflows: 1.0, // $1.00 per workflow
    },
    [SubscriptionPlan.PRO]: {
      additionalCommands: 0.005, // $0.005 per command
      additionalWorkflows: 0.5, // $0.50 per workflow
    },
    [SubscriptionPlan.ENTERPRISE]: {
      additionalCommands: 0.002, // $0.002 per command
      additionalWorkflows: 0.25, // $0.25 per workflow
    },
  };

  async generateInvoice(
    userId: string,
    billingCycle: BillingCycle
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          stripeCustomerId: true,
          currentPlan: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      // Calculate total amount
      const total = billingCycle.items.reduce(
        (sum, item) => sum + item.amount,
        0
      );

      // Create Stripe invoice
      const invoice = await StripeService.createInvoice({
        customerId: user.stripeCustomerId!,
        amount: total,
        items: billingCycle.items,
        metadata: {
          billingCycleStart: billingCycle.startDate.toISOString(),
          billingCycleEnd: billingCycle.endDate.toISOString(),
        },
      });

      // Record invoice in our database
      await db.paymentHistory.create({
        data: {
          userId,
          amount: total,
          currency: 'usd',
          stripeInvoiceId: invoice.id,
          status: PaymentStatus.PENDING,
          metadata: {
            items: billingCycle.items,
            cycle: {
              start: billingCycle.startDate,
              end: billingCycle.endDate,
            },
          },
        },
      });

      // Send invoice email
      await this.sendInvoiceEmail(user.email, invoice);
    } catch (error) {
      logger.error('Failed to generate invoice:', error);
      throw error;
    }
  }

  async calculateUsageCharges(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BillingItem[]> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          currentPlan: true,
        },
      });

      if (!user || user.currentPlan === SubscriptionPlan.FREE) {
        return [];
      }

      // Get usage metrics for the period
      const metrics = await db.usageMetrics.findMany({
        where: {
          userId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const planLimits = {
        [SubscriptionPlan.BASIC]: {
          commands: 1000,
          workflows: 10,
        },
        [SubscriptionPlan.PRO]: {
          commands: 10000,
          workflows: 50,
        },
        [SubscriptionPlan.ENTERPRISE]: {
          commands: Infinity,
          workflows: Infinity,
        },
      };

      const limits = planLimits[user.currentPlan];
      const rates = this.USAGE_RATES[user.currentPlan];

      // Calculate overage charges
      const charges: BillingItem[] = [];

      // Group metrics by type
      const usage = metrics.reduce(
        (acc, metric) => {
          if (!acc[metric.metricType]) {
            acc[metric.metricType] = 0;
          }
          acc[metric.metricType] += metric.count;
          return acc;
        },
        {} as Record<string, number>
      );

      // Calculate command overage
      const commandOverage = Math.max(
        0,
        usage['commands_executed'] - limits.commands
      );
      if (commandOverage > 0) {
        charges.push({
          description: 'Additional Command Executions',
          amount: Math.round(commandOverage * rates.additionalCommands * 100),
          quantity: commandOverage,
          metadata: {
            type: 'command_overage',
            rate: rates.additionalCommands,
          },
        });
      }

      // Calculate workflow overage
      const workflowOverage = Math.max(
        0,
        usage['workflows_created'] - limits.workflows
      );
      if (workflowOverage > 0) {
        charges.push({
          description: 'Additional Workflow Creations',
          amount: Math.round(workflowOverage * rates.additionalWorkflows * 100),
          quantity: workflowOverage,
          metadata: {
            type: 'workflow_overage',
            rate: rates.additionalWorkflows,
          },
        });
      }

      return charges;
    } catch (error) {
      logger.error('Failed to calculate usage charges:', error);
      throw error;
    }
  }

  async processPayment(
    userId: string,
    paymentMethodId: string,
    amount: number
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
        },
      });

      if (!user?.stripeCustomerId) {
        throw new AppError('Invalid user payment setup', 'PAYMENT_ERROR', 400);
      }

      // Process payment through Stripe
      const payment = await StripeService.processPayment({
        customerId: user.stripeCustomerId,
        paymentMethodId,
        amount,
      });

      // Record payment in our database
      await db.paymentHistory.create({
        data: {
          userId,
          amount,
          currency: 'usd',
          stripePaymentId: payment.id,
          status: PaymentStatus.PAID,
        },
      });
    } catch (error) {
      logger.error('Failed to process payment:', error);
      throw error;
    }
  }

  async updatePaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
        },
      });

      if (!user?.stripeCustomerId) {
        throw new AppError('Invalid user payment setup', 'PAYMENT_ERROR', 400);
      }

      // Update payment method in Stripe
      await StripeService.updateDefaultPaymentMethod(
        user.stripeCustomerId,
        paymentMethodId
      );
    } catch (error) {
      logger.error('Failed to update payment method:', error);
      throw error;
    }
  }

  async getPaymentMethods(userId: string): Promise<any[]> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
        },
      });

      if (!user?.stripeCustomerId) {
        return [];
      }

      return await StripeService.getPaymentMethods(user.stripeCustomerId);
    } catch (error) {
      logger.error('Failed to get payment methods:', error);
      throw error;
    }
  }

  async handleFailedPayment(userId: string, invoiceId: string): Promise<void> {
    try {
      // Update payment status
      await db.paymentHistory.update({
        where: {
          stripeInvoiceId: invoiceId,
        },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      // Get user details
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          currentPlan: true,
        },
      });

      if (!user) return;

      // Send failed payment notification
      await this.sendPaymentFailedEmail(user.email, invoiceId);

      // If payment fails for premium plans, schedule downgrade
      if (user.currentPlan !== SubscriptionPlan.FREE) {
        await this.scheduleDowngrade(userId);
      }
    } catch (error) {
      logger.error('Failed to handle failed payment:', error);
      throw error;
    }
  }

  private async scheduleDowngrade(userId: string): Promise<void> {
    const gracePeriod = 3; // 3 days grace period

    await db.user.update({
      where: { id: userId },
      data: {
        scheduledDowngrade: {
          targetPlan: SubscriptionPlan.FREE,
          effectiveDate: new Date(
            Date.now() + gracePeriod * 24 * 60 * 60 * 1000
          ),
        },
      },
    });
  }

  private async sendInvoiceEmail(email: string, invoice: any): Promise<void> {
    await sendEmail({
      to: email,
      subject: 'Your Rinawarp Invoice',
      template: 'invoice',
      data: {
        invoiceId: invoice.id,
        amount: invoice.amount,
        dueDate: invoice.due_date,
        items: invoice.lines.data,
        viewUrl: invoice.hosted_invoice_url,
      },
    });
  }

  private async sendPaymentFailedEmail(
    email: string,
    invoiceId: string
  ): Promise<void> {
    await sendEmail({
      to: email,
      subject: 'Payment Failed - Action Required',
      template: 'payment-failed',
      data: {
        invoiceId,
        updatePaymentUrl: `${process.env.FRONTEND_URL}/billing/payment-methods`,
      },
    });
  }
}

export default new BillingService();
