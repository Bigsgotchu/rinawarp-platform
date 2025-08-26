import cron from 'node-cron';
import AnalyticsService from '../services/command';
import { sendEmail } from '../utils/email';
import logger from '../utils/logger';
import db from '../utils/db';

interface ReportRecipient {
  email: string;
  reportTypes: string[];
}

class AnalyticsJobs {
  private readonly DAILY_REPORT_TIME = '0 1 * * *'; // 1 AM every day
  private readonly WEEKLY_REPORT_TIME = '0 2 * * 1'; // 2 AM every Monday
  private readonly MONTHLY_REPORT_TIME = '0 3 1 * *'; // 3 AM on 1st of each month

  private readonly reportRecipients: ReportRecipient[] = [
    {
      email: process.env.ANALYTICS_ADMIN_EMAIL!,
      reportTypes: ['daily', 'weekly', 'monthly'],
    },
    // Add more recipients as needed
  ];

  initialize(): void {
    // Schedule daily report
    cron.schedule(this.DAILY_REPORT_TIME, () => {
      this.generateDailyReport().catch(error => {
        logger.error('Failed to generate daily report:', error);
      });
    });

    // Schedule weekly report
    cron.schedule(this.WEEKLY_REPORT_TIME, () => {
      this.generateWeeklyReport().catch(error => {
        logger.error('Failed to generate weekly report:', error);
      });
    });

    // Schedule monthly report
    cron.schedule(this.MONTHLY_REPORT_TIME, () => {
      this.generateMonthlyReport().catch(error => {
        logger.error('Failed to generate monthly report:', error);
      });
    });

    logger.info('Analytics jobs initialized');
  }

  private async generateDailyReport(): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 1);

      const report = await AnalyticsService.generatePeriodicReport({
        start: startDate,
        end: endDate,
      });

      await this.sendAnalyticsReport('daily', report);
      logger.info('Daily analytics report generated and sent');
    } catch (error) {
      logger.error('Failed to generate daily report:', error);
      throw error;
    }
  }

  private async generateWeeklyReport(): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);

      const report = await AnalyticsService.generatePeriodicReport({
        start: startDate,
        end: endDate,
      });

      await this.sendAnalyticsReport('weekly', report);
      logger.info('Weekly analytics report generated and sent');
    } catch (error) {
      logger.error('Failed to generate weekly report:', error);
      throw error;
    }
  }

  private async generateMonthlyReport(): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 1);

      const report = await AnalyticsService.generatePeriodicReport({
        start: startDate,
        end: endDate,
      });

      await this.sendAnalyticsReport('monthly', report);
      logger.info('Monthly analytics report generated and sent');
    } catch (error) {
      logger.error('Failed to generate monthly report:', error);
      throw error;
    }
  }

  private async sendAnalyticsReport(
    type: 'daily' | 'weekly' | 'monthly',
    report: any
  ): Promise<void> {
    const recipients = this.reportRecipients.filter(r =>
      r.reportTypes.includes(type)
    );

    const subject = `Rinawarp ${type.charAt(0).toUpperCase() + type.slice(1)} Analytics Report`;
    const date = new Date().toLocaleDateString();

    for (const recipient of recipients) {
      await sendEmail({
        to: recipient.email,
        subject,
        template: 'analytics-report',
        data: {
          type,
          date,
          report: {
            revenue: this.formatRevenueMetrics(report.revenue),
            subscriptions: this.formatSubscriptionMetrics(report.subscriptions),
            usage: this.formatUsageMetrics(report.usage),
            customers: this.formatCustomerMetrics(report.customers),
          },
        },
      });
    }
  }

  private formatRevenueMetrics(revenue: any) {
    return {
      totalRevenue: this.formatMoney(revenue.totalRevenue),
      recurringRevenue: this.formatMoney(revenue.recurringRevenue),
      oneTimeRevenue: this.formatMoney(revenue.oneTimeRevenue),
      refunds: this.formatMoney(revenue.refunds),
      netRevenue: this.formatMoney(revenue.netRevenue),
      change: {
        amount: this.formatMoney(revenue.periodOverPeriod.change),
        percentage: revenue.periodOverPeriod.percentage.toFixed(1) + '%',
      },
    };
  }

  private formatSubscriptionMetrics(subscriptions: any) {
    return {
      total: subscriptions.totalSubscriptions,
      active: subscriptions.activeSubscriptions,
      churnRate: subscriptions.churnRate.toFixed(1) + '%',
      planDistribution: Object.entries(subscriptions.planDistribution).map(
        ([plan, count]) => ({
          plan,
          count,
          percentage:
            (
              ((count as number) / subscriptions.totalSubscriptions) *
              100
            ).toFixed(1) + '%',
        })
      ),
      mrr: this.formatMoney(subscriptions.mrr),
      arr: this.formatMoney(subscriptions.arr),
    };
  }

  private formatUsageMetrics(usage: any) {
    return {
      commands: {
        total: usage.totalCommands.toLocaleString(),
        average: usage.averageCommandsPerUser.toFixed(1),
      },
      workflows: {
        total: usage.totalWorkflows.toLocaleString(),
        average: usage.averageWorkflowsPerUser.toFixed(1),
      },
      byPlan: Object.entries(usage.usageByPlan).map(([plan, data]) => ({
        plan,
        commands: (data as any).commands.toLocaleString(),
        workflows: (data as any).workflows.toLocaleString(),
        averagePerUser: (data as any).averagePerUser.toFixed(1),
      })),
    };
  }

  private formatCustomerMetrics(customers: any) {
    return {
      total: customers.totalCustomers.toLocaleString(),
      active: customers.activeCustomers.toLocaleString(),
      new: customers.newCustomers.toLocaleString(),
      churned: customers.churnedCustomers.toLocaleString(),
      ltv: this.formatMoney(customers.customerLifetimeValue),
    };
  }

  private formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100); // Convert cents to dollars
  }
}

export default new AnalyticsJobs();
