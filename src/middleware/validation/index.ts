import { Request, Response, NextFunction } from 'express';
import {
  ValidationChain,
  validationResult,
  ValidationError,
  body,
  query,
  param,
} from 'express-validator';
import { AppError } from '../errorHandler';

export type ValidationResults = {
  errors: ValidationError[];
  isEmpty: () => boolean;
  array: () => ValidationError[];
};

// Common validation patterns
export const patterns = {
  path: /^[a-zA-Z0-9\s\-_./]+$/,
  safeName: /^[a-zA-Z0-9\s\-_]+$/,
  safeString: /^[a-zA-Z0-9\s\-_@.]+$/,
};

// Re-export express-validator primitives
export { body, query, param };

// Common validation chains
export const validate = {
  stringField: (field: string, required = true) => {
    const chain = body(field).trim().isString();
    return required ? chain.notEmpty() : chain.optional();
  },

  numberField: (
    field: string,
    required = true,
    opts?: { min?: number; max?: number }
  ) => {
    const chain = body(field).isInt(opts);
    return required ? chain : chain.optional();
  },

  safePath: (field: string) =>
    body(field)
      .optional()
      .isString()
      .matches(patterns.path)
      .withMessage('Path contains invalid characters'),

  arrayField: (field: string, required = true) => {
    const chain = body(field).isArray();
    return required ? chain : chain.optional();
  },

  email: () =>
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please enter a valid email address'),

  password: () =>
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*]/)
      .withMessage(
        'Password must contain at least one special character (!@#$%^&*)'
      ),
};

// Validation middleware
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors: ValidationResults = validationResult(req);
  if (!errors.isEmpty()) {
    const error = errors.array()[0];
    return next(new AppError(error.msg, 'VALIDATION_ERROR', 400));
  }
  next();
};

// Common validation middlewares
export const validateCommand = [
  body('command')
    .trim()
    .notEmpty()
    .withMessage('Command is required')
    .matches(patterns.path)
    .withMessage('Command contains invalid characters'),
  body('args').optional().isArray().withMessage('Args must be an array'),
  body('args.*')
    .optional()
    .isString()
    .matches(patterns.path)
    .withMessage('Argument contains invalid characters'),
  body('cwd')
    .optional()
    .isString()
    .matches(patterns.path)
    .withMessage('Working directory path contains invalid characters'),
  handleValidationErrors,
];

export const validateHistoryQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a positive number'),
  handleValidationErrors,
];

export const validateHistorySearch = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  handleValidationErrors,
];

// Helper to compose validation chains
export const composeValidators = (...validators: ValidationChain[]) => [
  ...validators,
  handleValidationErrors,
];
