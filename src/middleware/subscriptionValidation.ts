import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { SubscriptionPlan } from '../types/auth';

export const validateSubscription = {
  create: (req: Request, res: Response, next: NextFunction) => {
    const { plan, paymentMethodId } = req.body;

    if (!plan || !Object.values(SubscriptionPlan).includes(plan)) {
      return next(new AppError('Invalid subscription plan', 'INVALID_INPUT', 400));
    }

    if (plan === SubscriptionPlan.FREE) {
      return next(new AppError('Cannot create subscription for free plan', 'INVALID_INPUT', 400));
    }

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      return next(new AppError('Payment method ID is required', 'INVALID_INPUT', 400));
    }

    next();
  },

  update: (req: Request, res: Response, next: NextFunction) => {
    const { plan } = req.body;

    if (!plan || !Object.values(SubscriptionPlan).includes(plan)) {
      return next(new AppError('Invalid subscription plan', 'INVALID_INPUT', 400));
    }

    next();
  },

  validateUsage: (req: Request, res: Response, next: NextFunction) => {
    const { metricType, count } = req.body;

    const validMetricTypes = ['commands', 'workflows'];
    if (!metricType || !validMetricTypes.includes(metricType)) {
      return next(new AppError('Invalid metric type', 'INVALID_INPUT', 400));
    }

    if (typeof count !== 'number' || count < 0) {
      return next(new AppError('Invalid usage count', 'INVALID_INPUT', 400));
    }

    next();
  },

  validateFeatureAccess: (req: Request, res: Response, next: NextFunction) => {
    const { feature } = req.body;

    const validFeatures = [
      'aiAssistance',
      'customWorkflows',
      'priority',
      'teamMembers',
    ];

    if (!feature || !validFeatures.includes(feature)) {
      return next(new AppError('Invalid feature', 'INVALID_INPUT', 400));
    }

    next();
  },

  validateBillingCycle: (req: Request, res: Response, next: NextFunction) => {
    const { startDate, endDate } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new AppError('Invalid date format', 'INVALID_INPUT', 400));
    }

    if (start >= end) {
      return next(new AppError('Start date must be before end date', 'INVALID_INPUT', 400));
    }

    if (start < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) {
      return next(new AppError('Start date too far in the past', 'INVALID_INPUT', 400));
    }

    if (end > new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)) {
      return next(new AppError('End date too far in the future', 'INVALID_INPUT', 400));
    }

    next();
  },

  validateTrialPeriod: (req: Request, res: Response, next: NextFunction) => {
    const { trialDays } = req.body;

    if (!trialDays || typeof trialDays !== 'number') {
      return next(new AppError('Trial period is required', 'INVALID_INPUT', 400));
    }

    const maxTrialDays = 30;
    if (trialDays < 0 || trialDays > maxTrialDays) {
      return next(
        new AppError(
          `Trial period must be between 0 and ${maxTrialDays} days`,
          'INVALID_INPUT',
          400
        )
      );
    }

    next();
  },

  validateCancellation: (req: Request, res: Response, next: NextFunction) => {
    const { reason, feedback } = req.body;

    const validReasons = [
      'too_expensive',
      'missing_features',
      'not_using',
      'switched_to_competitor',
      'other',
    ];

    if (!reason || !validReasons.includes(reason)) {
      return next(new AppError('Invalid cancellation reason', 'INVALID_INPUT', 400));
    }

    if (reason === 'other' && (!feedback || typeof feedback !== 'string')) {
      return next(new AppError('Feedback required for other reason', 'INVALID_INPUT', 400));
    }

    if (feedback && typeof feedback !== 'string') {
      return next(new AppError('Invalid feedback format', 'INVALID_INPUT', 400));
    }

    next();
  },

  validateProrationMode: (req: Request, res: Response, next: NextFunction) => {
    const { prorationMode } = req.body;

    const validModes = [
      'create_prorations',
      'none',
      'always_invoice',
    ];

    if (!prorationMode || !validModes.includes(prorationMode)) {
      return next(new AppError('Invalid proration mode', 'INVALID_INPUT', 400));
    }

    next();
  },
};
