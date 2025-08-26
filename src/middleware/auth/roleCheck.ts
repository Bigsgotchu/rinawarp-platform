import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth';
import { UserRole } from '../types/auth';
import { AppError } from './errorHandler';

export function checkRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('User not authenticated', 'UNAUTHORIZED', 401));
    }

    if (req.user.role !== role) {
      return next(new AppError('Unauthorized access', 'FORBIDDEN', 403));
    }

    next();
  };
}

export function checkPermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 'UNAUTHORIZED', 401);
      }

      // For now, only admins have all permissions
      if (req.user.role !== UserRole.ADMIN) {
        throw new AppError('Unauthorized access', 'FORBIDDEN', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
