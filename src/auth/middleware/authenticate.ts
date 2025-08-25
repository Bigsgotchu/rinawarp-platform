import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../api/client';
import AuthService from '../services/auth';
import logger from '../../utils/logger';

import { type AuthRequest, type AuthPayload } from '../../types/auth';

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isValid = await AuthService.getInstance().validateAuth();
    
    if (!isValid) {
      throw new ApiError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const user = AuthService.getInstance().getUser();
    if (!user) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Attach user to request
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.subscription?.planId || 'free',
      subscription: user.subscription
    };

    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}

export function requireSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.subscription) {
    res.status(403).json({
      error: 'Subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
    });
    return;
  }

  if (req.user.subscription.status !== 'active') {
    res.status(403).json({
      error: 'Subscription inactive',
      code: 'SUBSCRIPTION_INACTIVE',
    });
    return;
  }

  next();
}

export function requireFeature(feature: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const features = req.user?.subscription?.features || [];
    
    if (!features.includes(feature)) {
      res.status(403).json({
        error: 'Feature not available',
        code: 'FEATURE_NOT_AVAILABLE',
        meta: { feature },
      });
      return;
    }

    next();
  };
}
