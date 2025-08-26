import { Request, Response, NextFunction } from 'express';
import AuthService from '../services/auth';
import { logger } from '../../utils/logger';
import {
  AuthRequest,
  AuthPayload,
  UserRole,
  SubscriptionPlan,
} from '../../types/auth';

// Re-export AuthRequest for modules importing from here
export type { AuthRequest };

const authService = AuthService;

/**
 * Authentication middleware
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    // Get user from token
    await authService.validateAuth();
    const user = authService.getCurrentUser();
    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Attach user to request (normalize to AuthPayload)
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: UserRole.USER,
      plan: SubscriptionPlan.FREE,
    } as AuthPayload;

    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require authentication
 */
export async function optionalAuthenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      next();
      return;
    }

    // Get user from token
    await authService.validateAuth();
    const user = authService.getCurrentUser();
    if (user) {
      // Attach user to request (normalize to AuthPayload)
      req.user = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: UserRole.USER,
        plan: SubscriptionPlan.FREE,
      } as AuthPayload;
    }

    next();
  } catch (error) {
    logger.error('Optional authentication failed:', error);
    next();
  }
}
