import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';

const csrfProtection = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['x-csrf-token'];
    const cookieToken = req.cookies['csrf-token'];

    if (!token || !cookieToken || token !== cookieToken) {
      return res.status(403).json({ message: 'Invalid CSRF token' });
    }

    next();
  };
};

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", env.WEBSITE_API_URL],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  dnsPrefetchControl: { allow: false },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
});

export { csrfProtection, rateLimiter, securityHeaders };

import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { AppError } from './errorHandler';
import logger from '../utils/logger';

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://js.stripe.com'],
      frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      connectSrc: ["'self'", 'https://api.stripe.com'],
      imgSrc: ["'self'", 'https://*.stripe.com', 'data:'],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Payment-specific rate limiting
export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 payment requests per windowMs
  message: 'Too many payment requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Idempotency middleware for payment operations
export const idempotencyCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey || Array.isArray(idempotencyKey)) {
    return next(
      new AppError('Idempotency key required', 'INVALID_REQUEST', 400)
    );
  }

  try {
    // Check if operation with this key already exists
    const existingOperation = await prisma.paymentOperation.findUnique({
      where: { idempotencyKey },
    });

    if (existingOperation) {
      return res.status(200).json(existingOperation.result);
    }

    // Store the key in request for later use
    req.idempotencyKey = idempotencyKey;
    next();
  } catch (error) {
    logger.error('Idempotency check failed:', error);
    next(error);
  }
};

// High-value transaction validation
export const validateHighValueTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { amount } = req.body;
  const HIGH_VALUE_THRESHOLD = 10000; // $100 in cents

  if (amount && amount > HIGH_VALUE_THRESHOLD) {
    // Additional validation for high-value transactions
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        paymentHistory: {
          where: {
            status: 'PAID',
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        },
      },
    });

    if (!user) {
      return next(new AppError('User not found', 'INVALID_USER', 404));
    }

    // Check user's payment history
    const hasPaymentHistory = user.paymentHistory.length > 0;
    const totalSpent = user.paymentHistory.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    if (!hasPaymentHistory || totalSpent < HIGH_VALUE_THRESHOLD) {
      return next(
        new AppError(
          'Additional verification required for high-value transactions',
          'HIGH_VALUE_VERIFICATION_REQUIRED',
          403
        )
      );
    }
  }

  next();
};

// Stripe webhook signature verification
export const verifyStripeWebhook = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const signature = req.headers['stripe-signature'];

  if (!signature || Array.isArray(signature)) {
    return next(
      new AppError('Invalid Stripe signature', 'INVALID_SIGNATURE', 400)
    );
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    req.stripeEvent = event;
    next();
  } catch (error) {
    logger.error('Stripe webhook verification failed:', error);
    next(new AppError('Invalid Stripe webhook', 'INVALID_WEBHOOK', 400));
  }
};

// IP-based fraud detection
export const fraudDetection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clientIP = req.ip;
  const SUSPICIOUS_THRESHOLD = 5;

  try {
    // Check recent failed payment attempts from this IP
    const recentFailures = await prisma.paymentAttempt.count({
      where: {
        ipAddress: clientIP,
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (recentFailures >= SUSPICIOUS_THRESHOLD) {
      logger.warn(`Suspicious payment activity detected from IP: ${clientIP}`);
      return next(
        new AppError(
          'Too many failed payment attempts',
          'SUSPICIOUS_ACTIVITY',
          403
        )
      );
    }

    next();
  } catch (error) {
    logger.error('Fraud detection check failed:', error);
    next(error);
  }
};

// Payment amount validation
export const validatePaymentAmount = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { amount } = req.body;
  const MIN_AMOUNT = 50; // $0.50 in cents
  const MAX_AMOUNT = 999999; // $9,999.99 in cents

  if (!amount || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return next(new AppError('Invalid payment amount', 'INVALID_AMOUNT', 400));
  }

  next();
};

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AppError } from './errorHandler';
import AIService from '../services/command';

// Request sanitization middleware
export const sanitizeRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const sanitize = (obj: any) => {
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key]
          .replace(/[<>]/g, '') // Remove potential HTML
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control chars
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]); // Recursively sanitize nested objects
      }
    });
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

// Basic rate limiting
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// Security headers
export const securityHeaders = helmet();

// Dangerous commands blacklist
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/,
  /rm\s+-r/,
  /mkfs/,
  /dd/,
  />(>?)\s*\/dev\/.*/,
  /chmod\s+777/,
  /chmod\s+-R/,
  /curl\s+.*\|\s*(?:ba)?sh/,
  /wget\s+.*\|\s*(?:ba)?sh/,
];

// Command validation middleware
export const validateCommandSafety = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { command, args = [] } = req.body;

  // Check against blacklist
  const fullCommand = `${command} ${args.join(' ')}`.toLowerCase();
  const isDangerous = DANGEROUS_PATTERNS.some(pattern =>
    pattern.test(fullCommand)
  );

  if (isDangerous) {
    return next(
      new AppError('Command contains dangerous patterns', 'UNSAFE_COMMAND', 403)
    );
  }

  // Use AI to validate command safety
  const isSafe = await AIService.validateCommandSafety(command, args);
  if (!isSafe) {
    return next(
      new AppError(
        'Command was flagged as potentially unsafe',
        'UNSAFE_COMMAND',
        403
      )
    );
  }

  next();
};

// Simple sanitization of command input
export const sanitizeCommand = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.body.command) {
    // Remove any null bytes, control characters, etc.
    req.body.command = req.body.command
      .replace(/[\\0]/g, '')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  }

  if (req.body.args) {
    req.body.args = req.body.args.map((arg: string) =>
      arg.replace(/[\\0]/g, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    );
  }

  next();
};
