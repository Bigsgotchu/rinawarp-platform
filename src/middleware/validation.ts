import { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';

export const validateCommand = [
  body('command')
    .trim()
    .notEmpty()
    .withMessage('Command is required')
    .matches(/^[a-zA-Z0-9\s\-_.\/]+$/)
    .withMessage('Command contains invalid characters'),
  body('args')
    .optional()
    .isArray()
    .withMessage('Args must be an array'),
  body('args.*')
    .optional()
    .isString()
    .matches(/^[a-zA-Z0-9\s\-_.\/]+$/)
    .withMessage('Argument contains invalid characters'),
  body('cwd')
    .optional()
    .isString()
    .matches(/^[a-zA-Z0-9\s\-_.\/]+$/)
    .withMessage('Working directory path contains invalid characters'),
  handleValidationErrors
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
  handleValidationErrors
];

export const validateHistorySearch = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  handleValidationErrors
];

function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
}
