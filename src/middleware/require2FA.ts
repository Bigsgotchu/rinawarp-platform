import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { logger } from '../utils/logger';

export interface TwoFactorRequest extends Request {
  twoFactorVerified?: boolean;
}

export const require2FA = async (req: TwoFactorRequest, res: Response, next: NextFunction) => {
  try {
    // Skip 2FA check if already verified in this session
    if (req.twoFactorVerified) {
      return next();
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has 2FA enabled
    const authService = AuthService.getInstance();
    const has2FA = await authService.has2FAEnabled(user.id);
    
    if (!has2FA) {
      return next();
    }

    // Check for 2FA token in headers
    const token = req.headers['x-2fa-token'];
    if (!token || typeof token !== 'string') {
      return res.status(401).json({
        error: '2FA required',
        requiresTwoFactor: true
      });
    }

    // Verify 2FA token
    const isValid = await authService.verify2FAToken(user.id, token);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid 2FA token',
        requiresTwoFactor: true
      });
    }

    // Mark as verified
    req.twoFactorVerified = true;
    next();
  } catch (error) {
    logger.error('2FA middleware error:', error);
    next(error);
  }
};

export const optional2FA = async (req: TwoFactorRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return next();
    }

    const token = req.headers['x-2fa-token'];
    if (token && typeof token === 'string') {
      const authService = AuthService.getInstance();
      const isValid = await authService.verify2FAToken(user.id, token);
      if (isValid) {
        req.twoFactorVerified = true;
      }
    }

    next();
  } catch (error) {
    logger.error('Optional 2FA middleware error:', error);
    next(error);
  }
};
