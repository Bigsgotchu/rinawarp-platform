/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, body } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import UnsubscribeTokenService from '../services/command';

const prisma = new PrismaClient();

class AnalyticsSubscriptionController {
  /**
   * Get user's current analytics subscription preferences
   */
  async getSubscriptionPreferences(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          emailPreferences: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user.emailPreferences);
    } catch (error) {
      logger.error('Failed to get subscription preferences:', error);
      next(error);
    }
  }

  /**
   * Update user's analytics subscription preferences
   */
  async updateSubscriptionPreferences(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const { dailyAnalytics, weeklyAnalytics, monthlyAnalytics } = req.body;

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          emailPreferences: {
            dailyAnalytics,
            weeklyAnalytics,
            monthlyAnalytics,
          },
        },
        select: {
          emailPreferences: true,
        },
      });

      res.json({
        message: 'Subscription preferences updated successfully',
        preferences: user.emailPreferences,
      });
    } catch (error) {
      logger.error('Failed to update subscription preferences:', error);
      next(error);
    }
  }

  /**
   * Unsubscribe from a specific report type
   * This endpoint is publicly accessible via email unsubscribe links
   */
  async unsubscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, type, token } = req.query;

      // Verify unsubscribe token
      const isValidToken = await this.verifyUnsubscribeToken(
        userId as string,
        type as string,
        token as string
      );

      if (!isValidToken) {
        return res.status(400).json({ error: 'Invalid unsubscribe token' });
      }

      // Update user preferences
      const user = await prisma.user.findUnique({
        where: { id: userId as string },
        select: {
          emailPreferences: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const preferences = user.emailPreferences as any;
      switch (type) {
        case 'daily':
          preferences.dailyAnalytics = false;
          break;
        case 'weekly':
          preferences.weeklyAnalytics = false;
          break;
        case 'monthly':
          preferences.monthlyAnalytics = false;
          break;
        default:
          return res.status(400).json({ error: 'Invalid report type' });
      }

      await prisma.user.update({
        where: { id: userId as string },
        data: {
          emailPreferences: preferences,
        },
      });

      res.json({
        message: `Successfully unsubscribed from ${type} analytics reports`,
      });
    } catch (error) {
      logger.error('Failed to process unsubscribe request:', error);
      next(error);
    }
  }

  /**
   * Verify an unsubscribe token
   */
  private async verifyUnsubscribeToken(
    userId: string,
    type: string,
    token: string
  ): Promise<boolean> {
    try {
      return UnsubscribeTokenService.verifyToken(token, userId, type);
    } catch (error) {
      logger.error('Failed to verify unsubscribe token:', error);
      return false;
    }
  }

  /**
   * Generate an unsubscribe token
   */
  static async generateUnsubscribeToken(
    userId: string,
    type: string
  ): Promise<string> {
    try {
      return UnsubscribeTokenService.generateToken(userId, type);
    } catch (error) {
      logger.error('Failed to generate unsubscribe token:', error);
      throw error;
    }
  }
}

// Request validation middleware
export const validateUpdatePreferences = [
  body('dailyAnalytics').isBoolean(),
  body('weeklyAnalytics').isBoolean(),
  body('monthlyAnalytics').isBoolean(),
];

export default new AnalyticsSubscriptionController();
