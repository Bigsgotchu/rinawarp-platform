/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { Router } from 'express';
import { PrismaClient, UsageType } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get current usage summary
router.get('/api/usage/summary', async (req: any, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get current month's boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get user's subscription and tier
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        subscription: {
          include: {
            tier: true
          }
        }
      }
    });

    if (!user || !user.subscription) {
      return res.status(403).json({ error: 'No active subscription' });
    }

    const features = user.subscription.tier.features as any;

    // Get usage metrics
    const [apiRequests, tokenUsage] = await Promise.all([
      prisma.usageRecord.count({
        where: {
          userId: req.user.id,
          type: UsageType.API_REQUEST,
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      }),
      prisma.usageRecord.aggregate({
        where: {
          userId: req.user.id,
          type: {
            in: [UsageType.COMPLETION_TOKENS, UsageType.PROMPT_TOKENS]
          },
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        _sum: {
          quantity: true
        }
      })
    ]);

    // Calculate limits and usage
    const apiLimit = features.aiAssistance.requestsPerMonth;
    const tokenLimit = features.aiAssistance.maxTokensPerRequest;
    const apiUsagePercent = apiLimit ? (apiRequests / apiLimit) * 100 : 0;
    
    res.json({
      period: {
        start: startOfMonth,
        end: endOfMonth,
        daysLeft: Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      },
      api_requests: {
        used: apiRequests,
        limit: apiLimit || 'unlimited',
        usage_percent: apiLimit ? apiUsagePercent : null
      },
      tokens: {
        used: tokenUsage._sum.quantity || 0,
        limit_per_request: tokenLimit,
        average_per_request: apiRequests ? Math.round((tokenUsage._sum.quantity || 0) / apiRequests) : 0
      },
      subscription: {
        plan: user.subscription.tier.name,
        status: user.subscription.status
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch usage summary',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get detailed usage history
router.get('/api/usage/history', async (req: any, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { period = '7d', type } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return res.status(400).json({ error: 'Invalid period. Use 24h, 7d, or 30d' });
    }

    // Build where clause
    const where: any = {
      userId: req.user.id,
      createdAt: {
        gte: startDate,
        lte: now
      }
    };

    if (type && Object.values(UsageType).includes(type as UsageType)) {
      where.type = type;
    }

    // Get usage records
    const records = await prisma.usageRecord.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: 1000 // Limit to prevent overwhelming response
    });

    // Group by hour/day based on period
    const groupBy = period === '24h' ? 'hour' : 'day';
    const grouped = records.reduce((acc: any, record) => {
      const date = new Date(record.createdAt);
      const key = groupBy === 'hour' 
        ? date.toISOString().slice(0, 13) // YYYY-MM-DDTHH
        : date.toISOString().slice(0, 10); // YYYY-MM-DD

      if (!acc[key]) {
        acc[key] = {
          timestamp: date,
          api_requests: 0,
          completion_tokens: 0,
          prompt_tokens: 0
        };
      }

      switch (record.type) {
        case UsageType.API_REQUEST:
          acc[key].api_requests += record.quantity;
          break;
        case UsageType.COMPLETION_TOKENS:
          acc[key].completion_tokens += record.quantity;
          break;
        case UsageType.PROMPT_TOKENS:
          acc[key].prompt_tokens += record.quantity;
          break;
      }

      return acc;
    }, {});

    res.json({
      period,
      interval: groupBy,
      data: Object.values(grouped)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch usage history',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get usage analytics (for Professional and Enterprise tiers)
router.get('/api/usage/analytics', async (req: any, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get user's subscription and tier
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        subscription: {
          include: {
            tier: true
          }
        }
      }
    });

    if (!user?.subscription?.tier?.features) {
      return res.status(403).json({ error: 'No active subscription' });
    }

    const features = user.subscription.tier.features as any;
    if (!features.development.usageAnalytics) {
      return res.status(403).json({ error: 'Feature not available in your plan' });
    }

    // Get analytics for the last 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const records = await prisma.usageRecord.findMany({
      where: {
        userId: req.user.id,
        createdAt: {
          gte: startDate
        }
      },
      include: {
        user: {
          select: {
            subscription: {
              select: {
                tier: {
                  select: {
                    name: true,
                    price: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Calculate analytics
    const analytics = {
      total_requests: records.filter(r => r.type === UsageType.API_REQUEST).length,
      total_tokens: records.reduce((sum, r) => {
        if (r.type === UsageType.COMPLETION_TOKENS || r.type === UsageType.PROMPT_TOKENS) {
          return sum + r.quantity;
        }
        return sum;
      }, 0),
      average_response_time: records
        .filter(r => r.type === UsageType.API_REQUEST)
        .reduce((sum, r) => {
          const metadata = r.metadata as any;
          return sum + (metadata.responseTime || 0);
        }, 0) / records.filter(r => r.type === UsageType.API_REQUEST).length,
      endpoint_usage: records
        .filter(r => r.type === UsageType.API_REQUEST)
        .reduce((acc: any, r) => {
          const metadata = r.metadata as any;
          const endpoint = metadata.endpoint;
          if (!acc[endpoint]) {
            acc[endpoint] = 0;
          }
          acc[endpoint]++;
          return acc;
        }, {}),
      error_rate: records
        .filter(r => r.type === UsageType.API_REQUEST)
        .reduce((acc, r) => {
          const metadata = r.metadata as any;
          return acc + (metadata.statusCode >= 400 ? 1 : 0);
        }, 0) / records.filter(r => r.type === UsageType.API_REQUEST).length * 100
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch usage analytics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
