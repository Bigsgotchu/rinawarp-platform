import { PrismaClient } from '@prisma/client';
import { EmailType } from './unsubscribe-token';

const prisma = new PrismaClient();

interface UnsubscribeResult {
  success: boolean;
  message: string;
}

export class UnsubscribeHandler {
  /**
   * Process an unsubscribe request
   */
  async handleUnsubscribe(userId: string, type: EmailType): Promise<UnsubscribeResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { emailPreferences: true }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Update or create email preferences
      const updates: any = this.getPreferenceUpdates(type);
      
      await prisma.emailPreferences.upsert({
        where: { userId },
        create: {
          userId,
          ...updates
        },
        update: updates
      });

      // Add to suppression list if unsubscribing from all
      if (type === 'all') {
        await this.addToSuppressionList(user.email);
      }

      return {
        success: true,
        message: `Successfully unsubscribed from ${type} emails`
      };
    } catch (error) {
      console.error('Unsubscribe error:', error);
      return {
        success: false,
        message: 'Failed to process unsubscribe request'
      };
    }
  }

  /**
   * Add email to suppression list
   */
  private async addToSuppressionList(email: string): Promise<void> {
    try {
      // Call SendGrid API to add to global suppression list
      const response = await fetch('https://api.sendgrid.com/v3/asm/suppressions/global', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient_emails: [email]
        })
      });

      if (!response.ok) {
        throw new Error(`SendGrid API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to add to suppression list:', error);
      // Don't throw - we don't want to break the unsubscribe flow
    }
  }

  /**
   * Get preference updates based on unsubscribe type
   */
  private getPreferenceUpdates(type: EmailType): Record<string, boolean> {
    switch (type) {
      case 'weekly':
        return { weeklyReports: false };
      case 'monthly':
        return { monthlyReports: false };
      case 'alerts':
        return { usageAlerts: false };
      case 'marketing':
        return { marketingEmails: false };
      case 'all':
        return {
          weeklyReports: false,
          monthlyReports: false,
          usageAlerts: false,
          marketingEmails: false,
          securityAlerts: false
        };
      default:
        return {};
    }
  }

  /**
   * Handle email bounce
   */
  async handleBounce(email: string, reason: string): Promise<void> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        include: { emailPreferences: true }
      });

      if (!user) return;

      // Update email preferences
      await prisma.emailPreferences.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          weeklyReports: false,
          monthlyReports: false,
          usageAlerts: false,
          marketingEmails: false
        },
        update: {
          weeklyReports: false,
          monthlyReports: false,
          usageAlerts: false,
          marketingEmails: false
        }
      });

      // Add to suppression list
      await this.addToSuppressionList(email);

      // Log bounce for analytics
      await prisma.emailEvent.create({
        data: {
          userId: user.id,
          type: 'BOUNCE',
          email,
          metadata: {
            reason,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      console.error('Failed to handle bounce:', error);
    }
  }
}

// Export singleton instance
export const unsubscribeHandler = new UnsubscribeHandler();
