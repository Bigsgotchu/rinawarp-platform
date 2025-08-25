import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthPayload, UserStatus, SubscriptionPlan } from '../types/auth';
import { AppError } from './errorHandler';
import db from '../utils/db';
import redis from '../utils/redis';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('No token provided', 'UNAUTHORIZED', 401);
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as AuthPayload;

    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new AppError('Token is invalid', 'UNAUTHORIZED', 401);
    }

    // Check if user exists and is active
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        status: true,
        currentPlan: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError('User account is not active', 'INACTIVE_ACCOUNT', 403);
    }

    // Add user to request
    req.user = {
      ...payload,
      plan: user.currentPlan || SubscriptionPlan.FREE,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 'UNAUTHORIZED', 401));
    } else {
      next(error);
    }
  }
}
