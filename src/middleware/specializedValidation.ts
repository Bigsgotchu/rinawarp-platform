import { body, query, param } from 'express-validator';

export const validateGitOperation = [
  body('operation')
    .isString()
    .isIn(['clone', 'pull', 'push', 'commit', 'checkout', 'merge'])
    .withMessage('Invalid git operation'),
  body('repository')
    .optional()
    .isString()
    .matches(/^(https?:\/\/|git@)/)
    .withMessage('Invalid repository URL/path'),
  body('branch')
    .optional()
    .isString()
    .matches(/^[a-zA-Z0-9\-_./]+$/)
    .withMessage('Invalid branch name'),
  body('message')
    .optional()
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Commit message must be between 1 and 500 characters'),
];

export const validateDockerOperation = [
  body('operation')
    .isString()
    .isIn(['build', 'run', 'stop', 'remove', 'logs', 'exec'])
    .withMessage('Invalid docker operation'),
  body('container')
    .optional()
    .isString()
    .matches(/^[a-zA-Z0-9\-_./]+$/)
    .withMessage('Invalid container name/ID'),
  body('image')
    .optional()
    .isString()
    .matches(/^[a-zA-Z0-9\-_./]+$/)
    .withMessage('Invalid image name'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
];

export const validatePackageOperation = [
  body('operation')
    .isString()
    .isIn(['install', 'uninstall', 'update', 'list', 'search'])
    .withMessage('Invalid package operation'),
  body('manager')
    .isString()
    .isIn(['npm', 'yarn', 'pip', 'brew'])
    .withMessage('Invalid package manager'),
  body('packages')
    .optional()
    .isArray()
    .withMessage('Packages must be an array'),
  body('packages.*')
    .optional()
    .isString()
    .matches(/^[@a-zA-Z0-9\-_./]+$/)
    .withMessage('Invalid package name'),
];

export const validateAnalysis = [
  query('type')
    .optional()
    .isString()
    .isIn(['performance', 'security', 'compatibility'])
    .withMessage('Invalid analysis type'),
  query('detail')
    .optional()
    .isString()
    .isIn(['basic', 'detailed', 'expert'])
    .withMessage('Invalid detail level'),
];

export const validateWorkflowOperation = [
  body('name')
    .isString()
    .matches(/^[a-zA-Z0-9\-_]+$/)
    .withMessage('Invalid workflow name'),
  body('steps')
    .isArray({ min: 1 })
    .withMessage('Workflow must have at least one step'),
  body('steps.*.command')
    .isString()
    .withMessage('Each step must have a command'),
  body('steps.*.condition')
    .optional()
    .isString()
    .withMessage('Step condition must be a string'),
];

export const validateProfileOperation = [
  param('userId')
    .isString()
    .matches(/^[a-zA-Z0-9\-_]+$/)
    .withMessage('Invalid user ID'),
  query('section')
    .optional()
    .isString()
    .isIn(['commands', 'workflows', 'preferences', 'metrics'])
    .withMessage('Invalid profile section'),
];
