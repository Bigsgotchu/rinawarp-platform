export { rateLimiter } from './rateLimiter';

// Basic security headers wrapper using helmet
import helmet from 'helmet';
export const securityHeaders = helmet();

// CSRF protection (stubbed for now)
import { RequestHandler } from 'express';
export const csrfProtection: RequestHandler = (req, res, next) => next();
