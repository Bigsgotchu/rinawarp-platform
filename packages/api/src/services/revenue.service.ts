import { PrismaClient } from '@prisma/client';
import { logger } from '@rinawarp/shared';
import Stripe from 'stripe';

const prisma = new PrismaClient();

export class RevenueService {
  async recordPayment(invoice: Stripe.Invoice) {
    try {
      if (!invoice.customer) {
        throw new Error('Invalid customer ID in invoice');
      }
      
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
      
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId }
      });

      if (!user) {
        throw new Error(`No user found for Stripe customer ${customerId}`);
      }

      const amount = invoice.amount_paid;
      const currency = invoice.currency.toUpperCase();
      const status = invoice.status;
      const invoiceId = invoice.id;

      // Record the revenue
      await prisma.revenue.create({
        data: {
          userId: user.id,
          amount,
          currency,
          status,
          stripeInvoiceId: invoiceId,
          paidAt: invoice.status_transitions?.paid_at 
            ? new Date(invoice.status_transitions.paid_at * 1000)
            : new Date(),
          metadata: {
            subscription: (invoice as any).subscription || null,
            payment_intent: (invoice as any).payment_intent || null,
            invoice_pdf: invoice.invoice_pdf || null,
            hosted_invoice_url: invoice.hosted_invoice_url || null
          }
        }
      });

      logger.info('Revenue recorded successfully', {
        userId: user.id,
        amount,
        currency,
        invoiceId
      });
    } catch (error) {
      logger.error('Failed to record revenue:', error);
      throw error;
    }
  }

  async getRevenueSummary(startDate: Date, endDate: Date) {
    try {
      const revenue = await prisma.revenue.groupBy({
        by: ['currency'],
        where: {
          status: 'paid',
          paidAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        }
      });

      return revenue;
    } catch (error) {
      logger.error('Failed to get revenue summary:', error);
      throw error;
    }
  }
}
