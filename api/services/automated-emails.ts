import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { emailService, EmailTemplate } from './email';

const prisma = new PrismaClient();

export class AutomatedEmailService {
  constructor() {
    this.initializeSchedulers();
  }

  private initializeSchedulers() {
    // Daily usage check at 9 AM
    cron.schedule('0 9 * * *', () => {
      this.checkUsageLimits();
    });

    // Weekly reports every Monday at 8 AM
    cron.schedule('0 8 * * 1', () => {
      this.sendWeeklyReports();
    });

    // Monthly summaries on 1st of each month at 7 AM
    cron.schedule('0 7 1 * *', () => {
      this.sendMonthlySummaries();
    });
  }

  public async checkUsageLimits() {
    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          subscription: {
            isNot: null
          }
        },
        include: {
          subscription: true,
          apiUsage: {
            where: {
              timestamp: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
              }
            }
          }
        }
      });

      for (const user of users) {
        const usage = user.apiUsage.length;
        const limit = user.subscription?.requestLimit || 0;
        const usagePercent = Math.round((usage / limit) * 100);

        // Send warning at 80% and 90% usage
        if (usagePercent >= 80) {
          await emailService.sendTemplateEmail(
            user.email,
            EmailTemplate.USAGE_WARNING,
            {
              name: user.name,
              usagePercent,
              used: usage,
              limit,
              resetDate: new Date(user.subscription?.currentPeriodEnd || '').toLocaleDateString(),
              upgradeUrl: 'https://rinawarptech.com/pricing'
            }
          );
        }
      }
    } catch (error) {
      console.error('Failed to check usage limits:', error);
    }
  }

  public async sendWeeklyReports() {
    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          emailPreferences: {
            weeklyReports: true
          }
        },
        include: {
          subscription: true,
          apiUsage: {
            where: {
              timestamp: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
              }
            }
          }
        }
      });

      for (const user of users) {
        const weeklyStats = this.calculateWeeklyStats(user.apiUsage);

        await emailService.sendTemplateEmail(
          user.email,
          EmailTemplate.WEEKLY_REPORT,
          {
            name: user.name,
            stats: {
              totalRequests: weeklyStats.totalRequests,
              successRate: weeklyStats.successRate,
              avgResponseTime: weeklyStats.avgResponseTime,
              topEndpoints: weeklyStats.topEndpoints
            },
            period: {
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
              end: new Date().toLocaleDateString()
            },
            dashboardUrl: 'https://rinawarptech.com/dashboard'
          }
        );
      }
    } catch (error) {
      console.error('Failed to send weekly reports:', error);
    }
  }

  public async sendMonthlySummaries() {
    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          emailPreferences: {
            monthlyReports: true
          }
        },
        include: {
          subscription: true,
          apiUsage: {
            where: {
              timestamp: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
              }
            }
          }
        }
      });

      for (const user of users) {
        const monthlyStats = this.calculateMonthlyStats(user.apiUsage);

        await emailService.sendTemplateEmail(
          user.email,
          EmailTemplate.MONTHLY_SUMMARY,
          {
            name: user.name,
            stats: {
              totalRequests: monthlyStats.totalRequests,
              successRate: monthlyStats.successRate,
              avgResponseTime: monthlyStats.avgResponseTime,
              costSavings: monthlyStats.costSavings,
              topEndpoints: monthlyStats.topEndpoints
            },
            trends: {
              requestGrowth: monthlyStats.requestGrowth,
              performanceImprovement: monthlyStats.performanceImprovement
            },
            recommendations: this.generateRecommendations(monthlyStats),
            dashboardUrl: 'https://rinawarptech.com/dashboard'
          }
        );
      }
    } catch (error) {
      console.error('Failed to send monthly summaries:', error);
    }
  }

  private calculateWeeklyStats(usage: any[]) {
    return {
      totalRequests: usage.length,
      successRate: this.calculateSuccessRate(usage),
      avgResponseTime: this.calculateAverageResponseTime(usage),
      topEndpoints: this.getTopEndpoints(usage)
    };
  }

  private calculateMonthlyStats(usage: any[]) {
    const basic = this.calculateWeeklyStats(usage);
    return {
      ...basic,
      costSavings: this.calculateCostSavings(usage),
      requestGrowth: this.calculateRequestGrowth(usage),
      performanceImprovement: this.calculatePerformanceImprovement(usage)
    };
  }

  private calculateSuccessRate(usage: any[]) {
    const successful = usage.filter(u => u.statusCode >= 200 && u.statusCode < 300).length;
    return (successful / usage.length * 100).toFixed(1) + '%';
  }

  private calculateAverageResponseTime(usage: any[]) {
    const total = usage.reduce((sum, u) => sum + u.responseTime, 0);
    return Math.round(total / usage.length);
  }

  private getTopEndpoints(usage: any[]) {
    const endpoints = usage.reduce((acc, u) => {
      acc[u.endpoint] = (acc[u.endpoint] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(endpoints)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([endpoint, count]) => ({
        endpoint,
        count,
        percentage: ((count as number) / usage.length * 100).toFixed(1) + '%'
      }));
  }

  private calculateCostSavings(usage: any[]) {
    // Implement your cost savings calculation logic
    return {
      amount: 150, // Example value
      percentage: '15%'
    };
  }

  private calculateRequestGrowth(usage: any[]) {
    // Implement your request growth calculation logic
    return {
      percentage: '25%',
      trend: 'increasing'
    };
  }

  private calculatePerformanceImprovement(usage: any[]) {
    // Implement your performance improvement calculation logic
    return {
      percentage: '10%',
      trend: 'improving'
    };
  }

  private generateRecommendations(stats: any) {
    const recommendations = [];

    // Add recommendations based on usage patterns
    if (stats.totalRequests > 10000) {
      recommendations.push({
        title: 'Consider Caching',
        description: 'Your high request volume suggests implementing caching could improve performance and reduce costs.',
        actionUrl: 'https://rinawarptech.com/docs/caching'
      });
    }

    if (stats.avgResponseTime > 500) {
      recommendations.push({
        title: 'Optimize Response Times',
        description: 'Your average response time is higher than recommended. Consider optimizing your queries.',
        actionUrl: 'https://rinawarptech.com/docs/optimization'
      });
    }

    // Add generic recommendations if specific ones don't apply
    if (recommendations.length === 0) {
      recommendations.push({
        title: 'Explore New Features',
        description: 'Check out our latest features to get more value from your subscription.',
        actionUrl: 'https://rinawarptech.com/features'
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const automatedEmailService = new AutomatedEmailService();
