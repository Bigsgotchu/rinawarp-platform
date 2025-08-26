import { Request, Response, NextFunction } from 'express';
import UserService from '../services/command';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../types/auth';

const db = new PrismaClient();

class UserController {
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const profile = await UserService.getUserProfile(userId);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const { name, email, preferences } = req.body;

      const updatedProfile = await UserService.updateProfile(userId, {
        name,
        email,
        preferences,
      });

      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      await UserService.deleteAccount(userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async getUsageMetrics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const { period } = req.query;

      if (period && !['daily', 'monthly'].includes(period as string)) {
        throw new AppError('Invalid period', 'INVALID_PARAMS', 400);
      }

      const metrics = await UserService.getUsageMetrics(
        userId,
        (period as 'daily' | 'monthly') || 'monthly'
      );

      res.json(metrics);
    } catch (error) {
      next(error);
    }
  }

  async getBillingHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await UserService.getBillingHistory(
        userId,
        limit,
        offset
      );
      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptionHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { userId } = req.user;
      const history = await UserService.getSubscriptionHistory(userId);
      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const { preferences } = req.body;

      await UserService.updatePreferences(userId, preferences);
      res.json({ message: 'Preferences updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Admin-only endpoints
  async getAllUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'ADMIN') {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 403);
      }

      const users = await db.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          currentPlan: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'ADMIN') {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 403);
      }

      const { id } = req.params;
      const user = await db.user.findUnique({
        where: { id },
        include: {
          subscriptionEvents: true,
          paymentHistory: true,
          usageMetrics: {
            where: {
              date: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          },
        },
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'ADMIN') {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 403);
      }

      const { id } = req.params;
      const { status } = req.body;

      const user = await db.user.update({
        where: { id },
        data: { status },
        select: {
          id: true,
          email: true,
          status: true,
        },
      });

      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  async getUserStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user.role !== 'ADMIN') {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 403);
      }

      const [totalUsers, activeUsers, premiumUsers, newUsers, totalRevenue] =
        await Promise.all([
          db.user.count(),
          db.user.count({
            where: { status: 'ACTIVE' },
          }),
          db.user.count({
            where: {
              currentPlan: {
                in: ['BASIC', 'PRO', 'ENTERPRISE'],
              },
            },
          }),
          db.user.count({
            where: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          }),
          db.paymentHistory.aggregate({
            where: {
              status: 'PAID',
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
            _sum: {
              amount: true,
            },
          }),
        ]);

      res.json({
        totalUsers,
        activeUsers,
        premiumUsers,
        newUsers,
        monthlyRevenue: totalRevenue._sum.amount || 0,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
