import { query, body } from 'express-validator';
import { handleValidationErrors } from './validation';

export const validateWorkflowQuery = [
  query('command')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Command is required'),
  query('workspacePath')
    .optional()
    .isString()
    .trim()
    .matches(/^[a-zA-Z0-9\-_./]+$/)
    .withMessage('Invalid workspace path'),
  handleValidationErrors,
];

export const validateWorkflowRecord = [
  body('command').isObject().withMessage('Command object is required'),
  body('command.command')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Command string is required'),
  body('command.args')
    .optional()
    .isArray()
    .withMessage('Args must be an array'),
  body('command.args.*')
    .optional()
    .isString()
    .withMessage('Args must be strings'),
  body('result').isObject().withMessage('Result object is required'),
  body('result.exitCode').isInt().withMessage('Exit code must be an integer'),
  body('result.output').isString().withMessage('Output must be a string'),
  body('workspacePath')
    .optional()
    .isString()
    .trim()
    .matches(/^[a-zA-Z0-9\-_./]+$/)
    .withMessage('Invalid workspace path'),
  handleValidationErrors,
];

export const validateCompletionQuery = [
  query('input').isString().trim().notEmpty().withMessage('Input is required'),
  query('cursorPosition')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Cursor position must be a non-negative integer'),
  query('workspacePath')
    .optional()
    .isString()
    .trim()
    .matches(/^[a-zA-Z0-9\-_./]+$/)
    .withMessage('Invalid workspace path'),
  handleValidationErrors,
];
