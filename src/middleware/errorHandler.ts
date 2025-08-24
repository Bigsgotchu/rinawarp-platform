import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { ErrorResponse } from '../types';

export class AppError extends Error {
  constructor(
    public message: string,
    public code: string = 'INTERNAL_ERROR',
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
  });

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  
  const errorResponse: ErrorResponse = {
    error: err.message,
    code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};
