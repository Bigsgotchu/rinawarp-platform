import { PrismaClient } from '@prisma/client';
import { trace, metrics, Counter, Histogram } from '@opentelemetry/api';
import { createNodeLogger } from '@opentelemetry/sdk-node';
import { Alert, AlertLevel, AlertChannel } from '../types/monitoring';
import { sendSlackNotification } from '../utils/slack';
import { sendWebhookNotification } from '../utils/webhook';
import config from '../config';
import logger from '../utils/logger';

class EmailMonitoringService {
  private readonly prisma: PrismaClient;
  private readonly tracer;
  private readonly emailCounter: Counter;
  private readonly deliveryTimeHistogram: Histogram;

  constructor() {
    this.prisma = new PrismaClient();

    // Initialize OpenTelemetry tracer
    this.tracer = trace.getTracer('email-monitoring');

    // Initialize metrics
    const meter = metrics.getMeter('email-monitoring');
    this.emailCounter = meter.createCounter('analytics_emails', {
      description: 'Number of analytics emails sent',
    });
    this.deliveryTimeHistogram = meter.createHistogram('email_delivery_time', {
      description: 'Email delivery time in milliseconds',
    });
  }

  /**
   * Track a successful email delivery
   */
  async trackDelivery(data: {
    type: 'daily' | 'weekly' | 'monthly';
    recipientCount: number;
    deliveryTimeMs: number;
    metadata?: Record<string, any>;
  }) {
    const span = this.tracer.startSpan('track_email_delivery');

    try {
      // Record metrics
      this.emailCounter.add(data.recipientCount, {
        type: data.type,
        status: 'success',
      });
      this.deliveryTimeHistogram.record(data.deliveryTimeMs, {
        type: data.type,
      });

      // Store delivery record
      await this.prisma.emailDelivery.create({
        data: {
          type: data.type,
          status: 'SUCCESS',
          recipientCount: data.recipientCount,
          deliveryTimeMs: data.deliveryTimeMs,
          metadata: data.metadata || {},
        },
      });

      // Check for slow delivery
      if (data.deliveryTimeMs > config.monitoring.thresholds.slowDeliveryMs) {
        await this.createAlert({
          level: 'WARNING',
          title: 'Slow Email Delivery Detected',
          message: `${data.type} report delivery took ${data.deliveryTimeMs}ms`,
          metadata: {
            type: data.type,
            deliveryTimeMs: data.deliveryTimeMs,
            recipientCount: data.recipientCount,
            ...data.metadata,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to track email delivery:', error);
      span.recordException(error as Error);
    } finally {
      span.end();
    }
  }

  /**
   * Track a failed email delivery
   */
  async trackFailure(data: {
    type: 'daily' | 'weekly' | 'monthly';
    error: Error;
    recipientCount: number;
    metadata?: Record<string, any>;
  }) {
    const span = this.tracer.startSpan('track_email_failure');

    try {
      // Record metrics
      this.emailCounter.add(data.recipientCount, {
        type: data.type,
        status: 'failure',
      });

      // Store failure record
      await this.prisma.emailDelivery.create({
        data: {
          type: data.type,
          status: 'FAILURE',
          recipientCount: data.recipientCount,
          error: data.error.message,
          metadata: data.metadata || {},
        },
      });

      // Create alert for failure
      await this.createAlert({
        level: 'ERROR',
        title: 'Email Delivery Failure',
        message: `Failed to send ${data.type} report: ${data.error.message}`,
        metadata: {
          type: data.type,
          error: data.error.message,
          recipientCount: data.recipientCount,
          ...data.metadata,
        },
      });
    } catch (error) {
      logger.error('Failed to track email failure:', error);
      span.recordException(error as Error);
    } finally {
      span.end();
    }
  }

  /**
   * Check for delivery issues over a time period
   */
  async checkDeliveryHealth(timeWindowMs: number = 24 * 60 * 60 * 1000) {
    // Default 24h
    const span = this.tracer.startSpan('check_delivery_health');

    try {
      const startTime = new Date(Date.now() - timeWindowMs);

      // Get delivery statistics
      const stats = await this.prisma.emailDelivery.groupBy({
        by: ['status'],
        where: {
          createdAt: {
            gte: startTime,
          },
        },
        _count: true,
        _avg: {
          deliveryTimeMs: true,
        },
      });

      // Calculate failure rate
      const totalDeliveries = stats.reduce((sum, stat) => sum + stat._count, 0);
      const failures =
        stats.find(stat => stat.status === 'FAILURE')?._count || 0;
      const failureRate = totalDeliveries > 0 ? failures / totalDeliveries : 0;

      // Check against thresholds
      if (failureRate > config.monitoring.thresholds.failureRate) {
        await this.createAlert({
          level: 'ERROR',
          title: 'High Email Failure Rate',
          message: `Failure rate of ${(failureRate * 100).toFixed(1)}% exceeds threshold`,
          metadata: {
            timeWindow: timeWindowMs,
            totalDeliveries,
            failures,
            failureRate,
          },
        });
      }

      // Return health status
      return {
        healthy: failureRate <= config.monitoring.thresholds.failureRate,
        stats: {
          totalDeliveries,
          failures,
          failureRate,
          averageDeliveryTime: stats.find(stat => stat.status === 'SUCCESS')
            ?._avg.deliveryTimeMs,
        },
      };
    } catch (error) {
      logger.error('Failed to check delivery health:', error);
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create and send an alert through configured channels
   */
  private async createAlert(alert: Omit<Alert, 'id' | 'createdAt'>) {
    const span = this.tracer.startSpan('create_alert');

    try {
      // Store alert in database
      const storedAlert = await this.prisma.alert.create({
        data: {
          level: alert.level,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata || {},
        },
      });

      // Send notifications through configured channels
      await Promise.all([
        // Slack notifications
        config.monitoring.alerts.slack.enabled &&
          sendSlackNotification({
            channel: config.monitoring.alerts.slack.channel,
            title: alert.title,
            message: alert.message,
            level: alert.level,
            metadata: alert.metadata,
          }),

        // Email notifications
        config.monitoring.alerts.email.enabled &&
          this.sendAlertEmail({
            to: config.monitoring.alerts.email.recipients,
            alert: storedAlert,
          }),

        // Webhook notifications
        config.monitoring.alerts.webhook.enabled &&
          sendWebhookNotification({
            url: config.monitoring.alerts.webhook.url,
            alert: storedAlert,
          }),
      ]);
    } catch (error) {
      logger.error('Failed to create alert:', error);
      span.recordException(error as Error);
    } finally {
      span.end();
    }
  }

  /**
   * Send an alert email
   */
  private async sendAlertEmail(params: { to: string[]; alert: Alert }) {
    // Implementation will use the existing email service
    // but with a different template for alerts
    // This keeps monitoring alerts separate from analytics emails
  }
}

export default new EmailMonitoringService();
