import { Request, Response, NextFunction } from 'express';
import AuthService from '../services/AuthService';
import { ApiError } from '../services/api/ApiClient';
import logger from '../utils/logger';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const isValid = await AuthService.validateAuth();
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

    // Attach user to request
    const user = AuthService.getCurrentUser();
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

export async function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    if (!user?.subscription) {
      return res.status(403).json({
        error: 'Subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }

    if (user.subscription.status !== 'active') {
      return res.status(403).json({
        error: 'Subscription inactive',
        code: 'SUBSCRIPTION_INACTIVE',
      });
    }

    next();
  } catch (error) {
    logger.error('Subscription check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}
