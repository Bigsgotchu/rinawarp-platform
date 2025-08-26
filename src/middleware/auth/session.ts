import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth';
import { AuthService } from '../services/command';
import { logger } from '../utils/logger';

export interface SessionRequest extends Request {
  session?: any;
  sessionId?: string;
}

export const session = async (
  req: SessionRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.cookies['sessionId'];
    if (!sessionId) {
      return next();
    }

    const authService = AuthService.getInstance();
    const session = await authService.getSession(sessionId);

    if (session) {
      // Update last activity
      await authService.updateSessionActivity(sessionId);

      // Attach session to request
      req.session = session;
      req.sessionId = sessionId;
    }

    next();
  } catch (error) {
    logger.error('Session middleware error:', error);
    next(error);
  }
};

export const requireSession = async (
  req: SessionRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.session) {
    return res.status(401).json({ error: 'Session required' });
  }
  next();
};
