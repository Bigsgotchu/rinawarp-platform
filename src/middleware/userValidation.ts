import { Request, Response, NextFunction } from 'express';
import { UserStatus } from '../types/auth';
import { AppError } from './errorHandler';
import { validateEmail } from '../utils/validation';

export const validateUser = {
  updateProfile: (req: Request, res: Response, next: NextFunction) => {
    const { name, email, preferences } = req.body;

    if (email && !validateEmail(email)) {
      return next(new AppError('Invalid email format', 'INVALID_INPUT', 400));
    }

    if (name && (typeof name !== 'string' || name.length < 2)) {
      return next(new AppError('Name must be at least 2 characters', 'INVALID_INPUT', 400));
    }

    if (preferences) {
      const validPreferences = [
        'emailNotifications',
        'theme',
        'commandSuggestions',
        'aiAssistance',
      ];

      const invalidKeys = Object.keys(preferences).filter(
        key => !validPreferences.includes(key)
      );

      if (invalidKeys.length > 0) {
        return next(
          new AppError(
            `Invalid preferences: ${invalidKeys.join(', ')}`,
            'INVALID_INPUT',
            400
          )
        );
      }

      if (preferences.theme && !['light', 'dark'].includes(preferences.theme)) {
        return next(new AppError('Invalid theme value', 'INVALID_INPUT', 400));
      }

      Object.entries(preferences).forEach(([key, value]) => {
        if (key !== 'theme' && typeof value !== 'boolean') {
          return next(
            new AppError(
              `Preference ${key} must be a boolean`,
              'INVALID_INPUT',
              400
            )
          );
        }
      });
    }

    next();
  },

  deleteAccount: (req: Request, res: Response, next: NextFunction) => {
    // Add any specific validation for account deletion
    // For example, require password confirmation
    const { confirmation } = req.body;

    if (!confirmation || confirmation !== 'DELETE') {
      return next(
        new AppError(
          'Please type DELETE to confirm account deletion',
          'INVALID_INPUT',
          400
        )
      );
    }

    next();
  },

  updateStatus: (req: Request, res: Response, next: NextFunction) => {
    const { status } = req.body;

    if (!Object.values(UserStatus).includes(status)) {
      return next(new AppError('Invalid status value', 'INVALID_INPUT', 400));
    }

    next();
  },

  updatePreferences: (req: Request, res: Response, next: NextFunction) => {
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return next(new AppError('Invalid preferences', 'INVALID_INPUT', 400));
    }

    const validPreferences = [
      'emailNotifications',
      'theme',
      'commandSuggestions',
      'aiAssistance',
    ];

    const invalidKeys = Object.keys(preferences).filter(
      key => !validPreferences.includes(key)
    );

    if (invalidKeys.length > 0) {
      return next(
        new AppError(
          `Invalid preferences: ${invalidKeys.join(', ')}`,
          'INVALID_INPUT',
          400
        )
      );
    }

    if (preferences.theme && !['light', 'dark'].includes(preferences.theme)) {
      return next(new AppError('Invalid theme value', 'INVALID_INPUT', 400));
    }

    Object.entries(preferences).forEach(([key, value]) => {
      if (key !== 'theme' && typeof value !== 'boolean') {
        return next(
          new AppError(
            `Preference ${key} must be a boolean`,
            'INVALID_INPUT',
            400
          )
        );
      }
    });

    next();
  },
};
