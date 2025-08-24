/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { PrismaClient } from '@prisma/client';
import { EmailTemplate, emailService } from './email';

const prisma = new PrismaClient();

export interface UsageAlert {
  userId: string;
  type: 'USAGE_WARNING' | 'LIMIT_EXCEEDED' | 'UPGRADE_RECOMMENDED';
  message: string;
  usagePercent: number;
  metadata?: Record<string, any>;
}

export interface NotificationChannel {
  send(alert: UsageAlert): Promise<void>;
}

// Email notifications (can be implemented with your preferred email service)
class EmailNotifier implements NotificationChannel {
  async send(alert: UsageAlert) {
    const user = await prisma.user.findUnique({
      where: { id: alert.userId },
      include: {
        subscription: {
          include: {
            tier: true
          }
        }
      }
    });

    if (!user) return;

    // Calculate reset date
    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Prepare template data
    const templateData = {
      name: user.name,
      usagePercent: alert.usagePercent,
      planName: user.subscription?.tier?.name || 'Free',
      used: alert.metadata?.used || 0,
      limit: alert.metadata?.limit || 'unlimited',
      resetDate: resetDate.toLocaleDateString(),
      upgradeUrl: `${process.env.FRONTEND_URL}/dashboard/upgrade`,
      usageUrl: `${process.env.FRONTEND_URL}/dashboard/usage`
    };

    let template;
    switch (alert.type) {
      case 'USAGE_WARNING':
        template = EmailTemplate.USAGE_WARNING;
        break;
      case 'LIMIT_EXCEEDED':
        template = EmailTemplate.LIMIT_EXCEEDED;
        break;
      case 'UPGRADE_RECOMMENDED':
        template = EmailTemplate.UPGRADE_RECOMMENDED;
        break;
      default:
        return;
    }

    await emailService.sendTemplateEmail(
      user.email,
      template,
      templateData
    );
  }

  private formatEmailContent(alert: UsageAlert, user: any): string {
    const planName = user.subscription?.tier?.name || 'Free';
    
    let content = `Hi ${user.name},\n\n`;
    
    switch (alert.type) {
      case 'USAGE_WARNING':
        content += `You have used ${alert.usagePercent.toFixed(1)}% of your monthly API requests on your ${planName} plan.\n\n`;
        content += `To ensure uninterrupted service, consider upgrading your plan or managing your usage.\n`;
        break;
      
      case 'LIMIT_EXCEEDED':
        content += `You have exceeded your monthly API request limit on your ${planName} plan.\n\n`;
        content += `To restore full access, please upgrade your plan or wait for your limit to reset next month.\n`;
        break;
      
      case 'UPGRADE_RECOMMENDED':
        content += `Based on your usage patterns, we recommend upgrading to a higher tier.\n\n`;
        content += `You're consistently using ${alert.usagePercent.toFixed(1)}% of your monthly limit.\n`;
        content += `Upgrading will give you more requests and additional features.\n`;
        break;
    }

    content += `\nView your usage details: https://rinawarptech.com/dashboard/usage\n`;
    content += `Upgrade your plan: https://rinawarptech.com/dashboard/upgrade\n\n`;
    content += `Best regards,\nThe RinaWarp Team`;

    return content;
  }
}

// Webhook notifications
class WebhookNotifier implements NotificationChannel {
  async send(alert: UsageAlert) {
    const user = await prisma.user.findUnique({
      where: { id: alert.userId },
      select: {
        subscription: {
          select: {
            tier: {
              select: {
                features: true
              }
            }
          }
        }
      }
    });

    // Only send webhooks for Professional and Enterprise tiers
    const features = user?.subscription?.tier?.features as any;
    if (!features?.development?.usageAnalytics) return;

    // Get user's webhook configuration
    const webhookUrl = await this.getUserWebhookUrl(alert.userId);
    if (!webhookUrl) return;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RinaWarp-Signature': this.generateSignature(alert)
        },
        body: JSON.stringify({
          type: 'usage_alert',
          data: {
            alert_type: alert.type,
            message: alert.message,
            usage_percent: alert.usagePercent,
            timestamp: new Date().toISOString(),
            ...alert.metadata
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to send webhook:', await response.text());
      }
    } catch (error) {
      console.error('Webhook notification failed:', error);
    }
  }

  private async getUserWebhookUrl(userId: string): Promise<string | null> {
    // TODO: Implement webhook URL storage and retrieval
    return null;
  }

  private generateSignature(alert: UsageAlert): string {
    // TODO: Implement webhook signature generation
    return 'signature';
  }
}

// Notification service that handles all channels
export class NotificationService {
  private channels: NotificationChannel[] = [
    new EmailNotifier(),
    new WebhookNotifier()
  ];

  async sendAlert(alert: UsageAlert) {
    await Promise.all(
      this.channels.map(channel => 
        channel.send(alert).catch(error => {
          console.error('Notification failed:', error);
        })
      )
    );

    // Record the notification
    await prisma.usageRecord.create({
      data: {
        userId: alert.userId,
        type: 'API_REQUEST',
        quantity: 1,
        metadata: {
          type: 'notification',
          alertType: alert.type,
          usagePercent: alert.usagePercent,
          message: alert.message
        }
      }
    });
  }
}

// Export singleton instance
export const notifications = new NotificationService();
