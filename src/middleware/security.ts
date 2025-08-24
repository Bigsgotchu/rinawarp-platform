import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AppError } from './errorHandler';
import AIService from '../services/AIService';

// Request sanitization middleware
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
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
    code: 'RATE_LIMIT_EXCEEDED'
  }
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
export const validateCommandSafety = async (req: Request, res: Response, next: NextFunction) => {
  const { command, args = [] } = req.body;

  // Check against blacklist
  const fullCommand = `${command} ${args.join(' ')}`.toLowerCase();
  const isDangerous = DANGEROUS_PATTERNS.some(pattern => pattern.test(fullCommand));

  if (isDangerous) {
    return next(new AppError(
      'Command contains dangerous patterns',
      'UNSAFE_COMMAND',
      403
    ));
  }

  // Use AI to validate command safety
  const isSafe = await AIService.validateCommandSafety(command, args);
  if (!isSafe) {
    return next(new AppError(
      'Command was flagged as potentially unsafe',
      'UNSAFE_COMMAND',
      403
    ));
  }

  next();
};

// Simple sanitization of command input
export const sanitizeCommand = (req: Request, res: Response, next: NextFunction) => {
  if (req.body.command) {
    // Remove any null bytes, control characters, etc.
    req.body.command = req.body.command
      .replace(/[\\0]/g, '')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  }

  if (req.body.args) {
    req.body.args = req.body.args.map((arg: string) =>
      arg.replace(/[\\0]/g, '')
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    );
  }

  next();
};
