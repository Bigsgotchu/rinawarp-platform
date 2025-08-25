/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthRequest, SubscriptionPlan } from '../types/auth';
import AuthService from '../services/AuthService';
import StripeService from '../services/StripeService';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name } = req.body;
      const result = await AuthService.register({ email, password, name });

      res.status(201).json({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          plan: result.user.currentPlan,
        },
        tokens: result.tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });

      // Create session
      const session = await AuthService.createSession(result.user, req);

      res.json({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          plan: result.user.currentPlan,
        },
        tokens: result.tokens,
        sessionId: session.id,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const tokens = await AuthService.refreshToken(refreshToken);
      res.json(tokens);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const { refreshToken } = req.body;
      await AuthService.logout(userId, refreshToken);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      await AuthService.resetPassword(email);
      res.json({ message: 'Password reset email sent' });
    } catch (error) {
      next(error);
    }
  }

  async confirmResetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;
      await AuthService.confirmPasswordReset(token, newPassword);
      res.json({ message: 'Password reset successful' });
    } catch (error) {
      next(error);
    }
  }

  async createSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const { plan, paymentMethodId } = req.body;

      if (!Object.values(SubscriptionPlan).includes(plan)) {
        throw new AppError('Invalid subscription plan', 'INVALID_PLAN', 400);
      }

      await StripeService.createSubscription(userId, plan);
      res.json({ message: 'Subscription created successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const { plan } = req.body;

      if (!Object.values(SubscriptionPlan).includes(plan)) {
        throw new AppError('Invalid subscription plan', 'INVALID_PLAN', 400);
      }

      await StripeService.updateSubscription(userId, plan);
      res.json({ message: 'Subscription updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async cancelSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      await StripeService.cancelSubscription(userId);
      res.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptionStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user;
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionId: true,
          currentPlan: true,
          subscriptionStatus: true,
        },
      });

      if (!user?.subscriptionId) {
        res.json({
          plan: SubscriptionPlan.FREE,
          status: 'inactive',
        });
        return;
      }

      const status = await StripeService.getSubscriptionStatus(user.subscriptionId);
      res.json({
        plan: user.currentPlan,
        ...status,
      });
    } catch (error) {
      next(error);
    }
  }

  private stripe: any; // TODO: Add proper Stripe type

  async handleStripeWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const sig = req.headers['stripe-signature'];
      
      if (!sig) {
        throw new AppError('No Stripe signature found', 'INVALID_WEBHOOK', 400);
      }

      const event = this.stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      await StripeService.handleWebhook(event);
      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
