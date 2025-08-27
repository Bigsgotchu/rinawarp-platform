import { Request, Response, NextFunction } from 'express';
import { logger } from '@rinawarp/shared';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

function handlePrismaError(error: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint failed
        return new APIError(400, 'Resource already exists', 'DUPLICATE_RESOURCE');
      case 'P2025':
        // Record not found
        return new APIError(404, 'Resource not found', 'NOT_FOUND');
      default:
        logger.error('Unhandled Prisma error:', { code: error.code, message: error.message });
        return new APIError(500, 'Internal server error', 'DATABASE_ERROR');
    }
  }
  return new APIError(500, 'Internal server error', 'DATABASE_ERROR');
}

function handleStripeError(error: Stripe.errors.StripeError) {
  switch (error.type) {
    case 'StripeCardError':
      // Failed card payment
      return new APIError(400, error.message, 'PAYMENT_FAILED');
    case 'StripeInvalidRequestError':
      // Invalid parameters
      return new APIError(400, error.message, 'INVALID_REQUEST');
    case 'StripeAuthenticationError':
      // Invalid API key
      logger.error('Stripe authentication error:', error);
      return new APIError(500, 'Payment service configuration error', 'PAYMENT_CONFIG_ERROR');
    default:
      logger.error('Unhandled Stripe error:', error);
      return new APIError(500, 'Payment service error', 'PAYMENT_ERROR');
  }
}

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Error handling request:', error);

  // Handle known error types
  if (error instanceof APIError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError) {
    const apiError = handlePrismaError(error);
    return res.status(apiError.status).json({
      error: {
        code: apiError.code,
        message: apiError.message,
      },
    });
  }

  if (error instanceof Stripe.errors.StripeError) {
    const apiError = handleStripeError(error);
    return res.status(apiError.status).json({
      error: {
        code: apiError.code,
        message: apiError.message,
      },
    });
  }

  // Handle unknown errors
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
