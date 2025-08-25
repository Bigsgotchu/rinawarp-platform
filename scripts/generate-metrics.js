#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/var/log/rinawarp-metrics/metrics.log' })
  ]
});

// Initialize Prisma client
const prisma = new PrismaClient();

async function generateUserMetrics() {
  try {
    // Total users
    const totalUsers = await prisma.user.count();
    
    // Active users in last 30 days
    const activeUsers = await prisma.user.count({
      where: {
        lastLoginAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });
    
    // Users by subscription tier
    const usersByTier = await prisma.subscription.groupBy({
      by: ['tier'],
      _count: {
        userId: true
      }
    });
    
    return {
      totalUsers,
      activeUsers,
      usersByTier
    };
  } catch (error) {
    logger.error('Error generating user metrics:', error);
    throw error;
  }
}

async function generateUsageMetrics() {
  try {
    // Commands executed in last 30 days
    const commandCount = await prisma.commandHistory.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });
    
    // Average commands per user
    const avgCommandsPerUser = await prisma.commandHistory.groupBy({
      by: ['userId'],
      _count: {
        id: true
      }
    }).then(groups => {
      const total = groups.reduce((sum, g) => sum + g._count.id, 0);
      return total / groups.length;
    });
    
    // Most used commands
    const popularCommands = await prisma.commandHistory.groupBy({
      by: ['command'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });
    
    return {
      commandCount,
      avgCommandsPerUser,
      popularCommands
    };
  } catch (error) {
    logger.error('Error generating usage metrics:', error);
    throw error;
  }
}

async function generatePerformanceMetrics() {
  try {
    // Average response time
    const avgResponseTime = await prisma.commandHistory.aggregate({
      _avg: {
        executionTime: true
      }
    });
    
    // Error rate
    const totalCommands = await prisma.commandHistory.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    
    const errorCommands = await prisma.commandHistory.count({
      where: {
        error: {
          not: null
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    
    const errorRate = (errorCommands / totalCommands) * 100;
    
    return {
      avgResponseTime: avgResponseTime._avg.executionTime,
      errorRate
    };
  } catch (error) {
    logger.error('Error generating performance metrics:', error);
    throw error;
  }
}

async function generateReport() {
  try {
    const userMetrics = await generateUserMetrics();
    const usageMetrics = await generateUsageMetrics();
    const performanceMetrics = await generatePerformanceMetrics();
    
    const report = {
      timestamp: new Date(),
      metrics: {
        user: userMetrics,
        usage: usageMetrics,
        performance: performanceMetrics
      }
    };
    
    logger.info('Monthly metrics report generated:', report);
    
    // Write report to file
    require('fs').writeFileSync(
      '/var/log/rinawarp-metrics/monthly-report.json',
      JSON.stringify(report, null, 2)
    );
    
    return report;
  } catch (error) {
    logger.error('Error generating monthly report:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  generateReport()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = {
  generateReport,
  generateUserMetrics,
  generateUsageMetrics,
  generatePerformanceMetrics
};
