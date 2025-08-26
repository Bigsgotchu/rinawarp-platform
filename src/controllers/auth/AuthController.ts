/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { Request, Response, NextFunction } from 'express';
import {
  AuthRequest,
  AuthResponse,
  SessionUser,
  SubscriptionPlan,
} from '../types/auth';
import { AuthService } from '../services/auth';
import { StripeService } from '../services/billing';
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
        },
        tokens: result.tokens,
      } as AuthResponse);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });

      res.json(result);
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
      await AuthService.logout();
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

  async createSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 401);
      }

      const { plan, paymentMethodId } = req.body;

      if (!plan) {
        throw new AppError('Invalid subscription plan', 'INVALID_PLAN', 400);
      }

      await StripeService.createSubscription(req.user.userId, plan);
      res.json({ message: 'Subscription created successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 401);
      }

      const { plan } = req.body;

      if (!plan) {
        throw new AppError('Invalid subscription plan', 'INVALID_PLAN', 400);
      }

      await StripeService.updateSubscription(req.user.userId, plan);
      res.json({ message: 'Subscription updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async cancelSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 401);
      }

      await StripeService.cancelSubscription(req.user.userId);
      res.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptionStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 401);
      }

      const user = await db.user.findUnique({
        where: { id: req.user.userId },
        include: {
          subscription: {
            select: {
              id: true,
              plan: true,
              status: true,
            },
          },
        },
      });

      if (!user?.subscription) {
        res.json({
          plan: user?.subscription?.plan ?? SubscriptionPlan.FREE,
          status: 'inactive',
        });
        return;
      }

      const status = await StripeService.getSubscriptionStatus(
        user.subscription.id
      );
      res.json({
        plan: user.subscription.plan ?? SubscriptionPlan.FREE,
        status: user.subscription.status,
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
  // 2FA and session management stubs to satisfy routes
  async initialize2FA(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(501).json({ error: '2FA not implemented' });
    } catch (error) {
      next(error);
    }
  }

  async verify2FA(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(501).json({ error: '2FA not implemented' });
    } catch (error) {
      next(error);
    }
  }

  async disable2FA(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(501).json({ error: '2FA not implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getActiveSessions(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(501).json({ error: 'Sessions not implemented' });
    } catch (error) {
      next(error);
    }
  }

  async terminateSession(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(501).json({ error: 'Sessions not implemented' });
    } catch (error) {
      next(error);
    }
  }

  async terminateAllSessions(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(501).json({ error: 'Sessions not implemented' });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
