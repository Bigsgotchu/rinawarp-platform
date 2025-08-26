import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function validateErrorAnalysis(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { command, error, workspacePath } = req.body;

  if (!command) {
    return next(new AppError('Command is required', 'INVALID_INPUT', 400));
  }

  if (!error) {
    return next(new AppError('Error is required', 'INVALID_INPUT', 400));
  }

  if (!workspacePath) {
    return next(
      new AppError('Workspace path is required', 'INVALID_INPUT', 400)
    );
  }

  next();
}

export function validateRecoveryAttempt(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { originalCommand, error, recoveryCommand, success } = req.body;

  if (!originalCommand) {
    return next(
      new AppError('Original command is required', 'INVALID_INPUT', 400)
    );
  }

  if (!error) {
    return next(new AppError('Error is required', 'INVALID_INPUT', 400));
  }

  if (!recoveryCommand) {
    return next(
      new AppError('Recovery command is required', 'INVALID_INPUT', 400)
    );
  }

  if (typeof success !== 'boolean') {
    return next(new AppError('Success flag is required', 'INVALID_INPUT', 400));
  }

  next();
}

export function validateErrorQuery(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { command, error } = req.query;

  if (!command) {
    return next(new AppError('Command is required', 'INVALID_INPUT', 400));
  }

  if (!error) {
    return next(new AppError('Error is required', 'INVALID_INPUT', 400));
  }

  next();
}
