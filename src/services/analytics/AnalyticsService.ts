import { Prisma } from '@prisma/client';
import { SubscriptionPlan } from '../types/auth';
import logger from '../utils/logger';
import db from '../utils/db';

interface DateRange {
  start: Date;
  end: Date;
}

interface RevenueMetrics {
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  refunds: number;
  netRevenue: number;
  periodOverPeriod: {
    change: number;
    percentage: number;
  };
}

interface SubscriptionMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  churnRate: number;
  planDistribution: Record<SubscriptionPlan, number>;
  mrr: number;
  arr: number;
}

interface UsageMetrics {
  totalCommands: number;
  totalWorkflows: number;
  averageCommandsPerUser: number;
  averageWorkflowsPerUser: number;
  usageByPlan: Record<
    SubscriptionPlan,
    {
      commands: number;
      workflows: number;
      averagePerUser: number;
    }
  >;
}

interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  customerLifetimeValue: number;
}

class AnalyticsService {
  async getRevenueMetrics(range: DateRange): Promise<RevenueMetrics> {
    try {
      const [currentPeriodPayments, previousPeriodPayments, refunds] =
        await Promise.all([
          // Current period revenue
          db.paymentHistory.aggregate({
            where: {
              createdAt: {
                gte: range.start,
                lte: range.end,
              },
              status: 'PAID',
            },
            _sum: {
              amount: true,
            },
          }),

          // Previous period revenue (for comparison)
          db.paymentHistory.aggregate({
            where: {
              createdAt: {
                gte: new Date(
                  range.start.getTime() -
                    (range.end.getTime() - range.start.getTime())
                ),
                lt: range.start,
              },
              status: 'PAID',
            },
            _sum: {
              amount: true,
            },
          }),

          // Refunds
          db.paymentHistory.aggregate({
            where: {
              createdAt: {
                gte: range.start,
                lte: range.end,
              },
              status: 'REFUNDED',
            },
            _sum: {
              amount: true,
            },
          }),
        ]);

      const recurringRevenue = await this.calculateRecurringRevenue(range);
      const totalRevenue = currentPeriodPayments._sum.amount || 0;
      const oneTimeRevenue = totalRevenue - recurringRevenue;
      const refundAmount = refunds._sum.amount || 0;
      const netRevenue = totalRevenue - refundAmount;
      const previousRevenue = previousPeriodPayments._sum.amount || 0;

      const revenueChange = netRevenue - previousRevenue;
      const revenueChangePercentage = previousRevenue
        ? (revenueChange / previousRevenue) * 100
        : 0;

      return {
        totalRevenue,
        recurringRevenue,
        oneTimeRevenue,
        refunds: refundAmount,
        netRevenue,
        periodOverPeriod: {
          change: revenueChange,
          percentage: revenueChangePercentage,
        },
      };
    } catch (error) {
      logger.error('Failed to get revenue metrics:', error);
      throw error;
    }
  }

  async getSubscriptionMetrics(
    date: Date = new Date()
  ): Promise<SubscriptionMetrics> {
    try {
      const [subscriptionCounts, planDistribution, churnData] =
        await Promise.all([
          // Total and active subscriptions
          db.user.groupBy({
            by: ['subscriptionStatus'],
            _count: true,
          }),

          // Distribution by plan
          db.user.groupBy({
            by: ['currentPlan'],
            _count: true,
          }),

          // Churn data
          this.calculateChurnRate(date),
        ]);

      const totalSubscriptions = subscriptionCounts.reduce(
        (sum, group) => sum + group._count,
        0
      );

      const activeSubscriptions =
        subscriptionCounts.find(group => group.subscriptionStatus === 'active')
          ?._count || 0;

      const planDist = planDistribution.reduce(
        (acc, group) => {
          acc[group.currentPlan as SubscriptionPlan] = group._count;
          return acc;
        },
        {} as Record<SubscriptionPlan, number>
      );

      const { mrr, arr } = await this.calculateRecurringRevenue(date);

      return {
        totalSubscriptions,
        activeSubscriptions,
        churnRate: churnData.churnRate,
        planDistribution: planDist,
        mrr,
        arr,
      };
    } catch (error) {
      logger.error('Failed to get subscription metrics:', error);
      throw error;
    }
  }

  async getUsageMetrics(range: DateRange): Promise<UsageMetrics> {
    try {
      const [commandMetrics, workflowMetrics, userCounts] = await Promise.all([
        // Command usage
        db.usageMetrics.groupBy({
          by: ['userId'],
          where: {
            metricType: 'commands_executed',
            date: {
              gte: range.start,
              lte: range.end,
            },
          },
          _sum: {
            count: true,
          },
        }),

        // Workflow usage
        db.usageMetrics.groupBy({
          by: ['userId'],
          where: {
            metricType: 'workflows_created',
            date: {
              gte: range.start,
              lte: range.end,
            },
          },
          _sum: {
            count: true,
          },
        }),

        // User counts by plan
        db.user.groupBy({
          by: ['currentPlan'],
          _count: true,
        }),
      ]);

      const totalCommands = commandMetrics.reduce(
        (sum, metric) => sum + (metric._sum.count || 0),
        0
      );

      const totalWorkflows = workflowMetrics.reduce(
        (sum, metric) => sum + (metric._sum.count || 0),
        0
      );

      const totalUsers = userCounts.reduce(
        (sum, count) => sum + count._count,
        0
      );

      const usageByPlan = await this.calculateUsageByPlan(range);

      return {
        totalCommands,
        totalWorkflows,
        averageCommandsPerUser: totalUsers ? totalCommands / totalUsers : 0,
        averageWorkflowsPerUser: totalUsers ? totalWorkflows / totalUsers : 0,
        usageByPlan,
      };
    } catch (error) {
      logger.error('Failed to get usage metrics:', error);
      throw error;
    }
  }

  async getCustomerMetrics(range: DateRange): Promise<CustomerMetrics> {
    try {
      const [totalCustomers, newCustomers, churnedCustomers, lifetimeValue] =
        await Promise.all([
          // Total customers
          db.user.count({
            where: {
              status: 'ACTIVE',
            },
          }),

          // New customers in period
          db.user.count({
            where: {
              createdAt: {
                gte: range.start,
                lte: range.end,
              },
            },
          }),

          // Churned customers
          db.user.count({
            where: {
              status: 'INACTIVE',
              updatedAt: {
                gte: range.start,
                lte: range.end,
              },
            },
          }),

          // Calculate LTV
          this.calculateCustomerLifetimeValue(),
        ]);

      return {
        totalCustomers,
        activeCustomers: totalCustomers - churnedCustomers,
        newCustomers,
        churnedCustomers,
        customerLifetimeValue: lifetimeValue,
      };
    } catch (error) {
      logger.error('Failed to get customer metrics:', error);
      throw error;
    }
  }

  private async calculateRecurringRevenue(date: Date): Promise<{
    mrr: number;
    arr: number;
  }> {
    const subscriptions = await db.user.groupBy({
      by: ['currentPlan'],
      where: {
        status: 'ACTIVE',
        currentPlan: {
          not: SubscriptionPlan.FREE,
        },
      },
      _count: true,
    });

    const planPrices = {
      [SubscriptionPlan.BASIC]: 1000, // $10/month
      [SubscriptionPlan.PRO]: 5000, // $50/month
      [SubscriptionPlan.ENTERPRISE]: 20000, // $200/month
    };

    const mrr = subscriptions.reduce((total, sub) => {
      return (
        total + sub._count * planPrices[sub.currentPlan as SubscriptionPlan]
      );
    }, 0);

    return {
      mrr,
      arr: mrr * 12,
    };
  }

  private async calculateChurnRate(date: Date): Promise<{
    churnRate: number;
    churnedUsers: number;
  }> {
    const thirtyDaysAgo = new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [churnedUsers, totalUsersLastMonth] = await Promise.all([
      // Users who churned this month
      db.user.count({
        where: {
          status: 'INACTIVE',
          updatedAt: {
            gte: thirtyDaysAgo,
            lte: date,
          },
        },
      }),

      // Total users at start of month
      db.user.count({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      }),
    ]);

    return {
      churnRate: totalUsersLastMonth
        ? (churnedUsers / totalUsersLastMonth) * 100
        : 0,
      churnedUsers,
    };
  }

  private async calculateUsageByPlan(range: DateRange): Promise<
    Record<
      SubscriptionPlan,
      {
        commands: number;
        workflows: number;
        averagePerUser: number;
      }
    >
  > {
    const usageByPlan = await db.usageMetrics.groupBy({
      by: ['metricType', 'userId'],
      where: {
        date: {
          gte: range.start,
          lte: range.end,
        },
      },
      _sum: {
        count: true,
      },
    });

    const userPlans = await db.user.findMany({
      select: {
        id: true,
        currentPlan: true,
      },
    });

    const planUsage = {} as Record<
      SubscriptionPlan,
      {
        commands: number;
        workflows: number;
        users: Set<string>;
      }
    >;

    // Initialize plan usage
    Object.values(SubscriptionPlan).forEach(plan => {
      planUsage[plan] = {
        commands: 0,
        workflows: 0,
        users: new Set(),
      };
    });

    // Aggregate usage by plan
    usageByPlan.forEach(usage => {
      const user = userPlans.find(u => u.id === usage.userId);
      if (user) {
        const plan = planUsage[user.currentPlan];
        plan.users.add(user.id);
        if (usage.metricType === 'commands_executed') {
          plan.commands += usage._sum.count || 0;
        } else if (usage.metricType === 'workflows_created') {
          plan.workflows += usage._sum.count || 0;
        }
      }
    });

    // Calculate averages and format result
    return Object.entries(planUsage).reduce(
      (acc, [plan, data]) => {
        acc[plan as SubscriptionPlan] = {
          commands: data.commands,
          workflows: data.workflows,
          averagePerUser: data.users.size
            ? (data.commands + data.workflows) / data.users.size
            : 0,
        };
        return acc;
      },
      {} as Record<
        SubscriptionPlan,
        {
          commands: number;
          workflows: number;
          averagePerUser: number;
        }
      >
    );
  }

  private async calculateCustomerLifetimeValue(): Promise<number> {
    const [totalRevenue, totalCustomers] = await Promise.all([
      // Total revenue ever
      db.paymentHistory.aggregate({
        where: {
          status: 'PAID',
        },
        _sum: {
          amount: true,
        },
      }),

      // Total customers ever
      db.user.count(),
    ]);

    return totalCustomers
      ? (totalRevenue._sum.amount || 0) / totalCustomers
      : 0;
  }

  async generatePeriodicReport(range: DateRange): Promise<{
    revenue: RevenueMetrics;
    subscriptions: SubscriptionMetrics;
    usage: UsageMetrics;
    customers: CustomerMetrics;
  }> {
    try {
      const [revenue, subscriptions, usage, customers] = await Promise.all([
        this.getRevenueMetrics(range),
        this.getSubscriptionMetrics(range.end),
        this.getUsageMetrics(range),
        this.getCustomerMetrics(range),
      ]);

      // Store report in database for historical tracking
      await db.analyticsReport.create({
        data: {
          date: range.end,
          metrics: {
            revenue,
            subscriptions,
            usage,
            customers,
          },
        },
      });

      return {
        revenue,
        subscriptions,
        usage,
        customers,
      };
    } catch (error) {
      logger.error('Failed to generate periodic report:', error);
      throw error;
    }
  }
}

export default new AnalyticsService();
