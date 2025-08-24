import { createTransport } from 'nodemailer';
import { compile } from 'handlebars';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { format } from 'date-fns';
import AnalyticsService from './AnalyticsService';
import { SubscriptionPlan } from '../types/auth';
import logger from '../utils/logger';
import EmailMonitoringService from './EmailMonitoringService';
import config from '../config';

interface EmailTemplate {
  subject: string;
  template: HandlebarsTemplateDelegate;
}

type ReportType = 'daily' | 'weekly' | 'monthly';

interface ReportConfig {
  type: ReportType;
  recipientEmails: string[];
  startDate: Date;
  endDate: Date;
}

class AnalyticsEmailService {
  private emailTransport;
  private templates: Map<string, EmailTemplate> = new Map();
  
  constructor() {
    this.emailTransport = createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.password
      }
    });
  }

  /**
   * Initialize email templates
   */
  async initialize() {
    try {
      const templatePath = join(__dirname, '../templates/emails/analytics-report.html');
      const templateContent = await readFile(templatePath, 'utf-8');
      
      this.templates.set('analytics-report', {
        subject: '{{type}} Analytics Report - {{date}}',
        template: compile(templateContent)
      });

      // Register helper for formatting numbers
      Handlebars.registerHelper('formatNumber', (number: number) => {
        return new Intl.NumberFormat('en-US').format(number);
      });

      // Register helper for currency formatting
      Handlebars.registerHelper('formatCurrency', (amount: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(amount);
      });

      // Register helper for percentage formatting
      Handlebars.registerHelper('formatPercentage', (value: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }).format(value);
      });

      // Register helper for checking positive numbers
      Handlebars.registerHelper('isPositive', (value: number) => {
        return value > 0;
      });

      // Register helper for capitalizing text
      Handlebars.registerHelper('capitalize', (text: string) => {
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
      });

    } catch (error) {
      logger.error('Failed to initialize email templates:', error);
      throw error;
    }
  }

  /**
   * Generate report data for email
   */
  private async generateReportData(startDate: Date, endDate: Date) {
    try {
      const [
        revenue,
        subscriptions,
        usage,
        customers
      ] = await Promise.all([
        AnalyticsService.getRevenueMetrics({ start: startDate, end: endDate }),
        AnalyticsService.getSubscriptionMetrics(endDate),
        AnalyticsService.getUsageMetrics({ start: startDate, end: endDate }),
        AnalyticsService.getCustomerMetrics({ start: startDate, end: endDate })
      ]);

      return {
        revenue,
        subscriptions,
        usage,
        customers
      };
    } catch (error) {
      logger.error('Failed to generate report data:', error);
      throw error;
    }
  }

  /**
   * Send email report to specified recipients
   */
  private async sendEmail(recipients: string[], subject: string, html: string) {
    try {
      const mailOptions = {
        from: config.email.from,
        to: recipients.join(', '),
        subject,
        html
      };

      await this.emailTransport.sendMail(mailOptions);
      logger.info('Analytics report email sent successfully');
    } catch (error) {
      logger.error('Failed to send analytics report email:', error);
      throw error;
    }
  }

  /**
   * Generate and send an analytics report email
   */
  async sendAnalyticsReport(reportConfig: ReportConfig) {
    const startTime = Date.now();
    try {
      const { type, recipientEmails, startDate, endDate } = reportConfig;

      // Get report template
      const template = this.templates.get('analytics-report');
      if (!template) {
        throw new Error('Analytics report template not found');
      }

      // Generate report data
      const reportData = await this.generateReportData(startDate, endDate);

      // Prepare template data
      const templateData = {
        type,
        date: format(endDate, 'MMMM d, yyyy'),
        report: reportData,
        logoUrl: config.email.assets.logoUrl,
        dashboardUrl: `${config.appUrl}/dashboard/analytics`,
        unsubscribeUrl: `${config.appUrl}/settings/notifications`
      };

      // Generate email content
      const subject = compile(template.subject)(templateData);
      const html = template.template(templateData);

      // Send email
      await this.sendEmail(recipientEmails, subject, html);

      // Log success and track metrics
      logger.info(`${type} analytics report sent to ${recipientEmails.length} recipients`);
      
      const deliveryTime = Date.now() - startTime;
      await EmailMonitoringService.trackDelivery({
        type,
        recipientCount: recipientEmails.length,
        deliveryTimeMs: deliveryTime,
        metadata: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          reportPeriod: {
            start: startDate,
            end: endDate
          }
        }
      });

      // Store report in database for historical tracking
      await db.analyticsReport.create({
        data: {
          type,
          date: endDate,
          recipientCount: recipientEmails.length,
          reportData: reportData as any // Type cast for Prisma JSON field
        }
      });

    } catch (error) {
      logger.error('Failed to send analytics report:', error);
      
      // Track failure
      await EmailMonitoringService.trackFailure({
        type,
        error: error as Error,
        recipientCount: recipientEmails.length,
        metadata: {
          startTime: new Date(startTime).toISOString(),
          errorTime: new Date().toISOString(),
          reportPeriod: {
            start: startDate,
            end: endDate
          }
        }
      });
      
      throw error;
    }
  }

  /**
   * Schedule and send daily analytics report
   */
  async sendDailyReport() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Get subscribed users
    const subscribers = await db.user.findMany({
      where: {
        emailPreferences: {
          dailyAnalytics: true
        },
        status: 'ACTIVE'
      },
      select: {
        email: true
      }
    });

    if (subscribers.length === 0) {
      logger.info('No subscribers for daily analytics report');
      return;
    }

    await this.sendAnalyticsReport({
      type: 'daily',
      recipientEmails: subscribers.map(user => user.email),
      startDate: yesterday,
      endDate: today
    });
  }

  /**
   * Schedule and send weekly analytics report
   */
  async sendWeeklyReport() {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    // Get subscribed users
    const subscribers = await db.user.findMany({
      where: {
        emailPreferences: {
          weeklyAnalytics: true
        },
        status: 'ACTIVE'
      },
      select: {
        email: true
      }
    });

    if (subscribers.length === 0) {
      logger.info('No subscribers for weekly analytics report');
      return;
    }

    await this.sendAnalyticsReport({
      type: 'weekly',
      recipientEmails: subscribers.map(user => user.email),
      startDate: lastWeek,
      endDate: today
    });
  }

  /**
   * Schedule and send monthly analytics report
   */
  async sendMonthlyReport() {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Get subscribed users
    const subscribers = await db.user.findMany({
      where: {
        emailPreferences: {
          monthlyAnalytics: true
        },
        status: 'ACTIVE'
      },
      select: {
        email: true
      }
    });

    if (subscribers.length === 0) {
      logger.info('No subscribers for monthly analytics report');
      return;
    }

    await this.sendAnalyticsReport({
      type: 'monthly',
      recipientEmails: subscribers.map(user => user.email),
      startDate: lastMonth,
      endDate: today
    });
  }

  /**
   * Send a test analytics report to specified email
   */
  async sendTestReport(email: string) {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    await this.sendAnalyticsReport({
      type: 'test',
      recipientEmails: [email],
      startDate: lastWeek,
      endDate: today
    });
  }
}

export default new AnalyticsEmailService();
