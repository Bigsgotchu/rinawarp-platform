/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { HelmetOptions } from 'helmet';
import { CorsOptions } from 'cors';
import { RateLimitRequestHandler, Options as RateLimitOptions } from 'express-rate-limit';
// Removed unused imports

// Helmet configuration
export const helmetConfig: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
};

// CORS configuration
export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',');
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// Rate limiting configuration
export const createRateLimiter = (options?: Partial<RateLimitOptions>): RateLimitRequestHandler => {
  const defaultOptions: RateLimitOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    requestWasSuccessful: (req, res) => res.statusCode < 400,
    skip: (req) => false, // Can be customized to skip certain requests
    keyGenerator: (req) => {
      // Use X-Forwarded-For header if behind proxy, otherwise use IP
      return req.headers['x-forwarded-for'] as string || req.ip;
    },
  };

  return require('express-rate-limit')({
    ...defaultOptions,
    ...options,
  });
};

// CSRF protection configuration
export const csrfConfig = {
  cookie: {
    key: 'csrf-token',
    secure: process.env.NODE_ENV === 'production',
    sameSite: true,
    httpOnly: true,
    maxAge: 3600, // 1 hour
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  value: (req: any) => req.headers['x-csrf-token'],
};

// Security headers configuration
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

// IP filtering configuration
export const ipFilterConfig: IpFilter = {
  mode: 'deny',
  forbidden: 'Access denied',
  log: true,
  trustProxy: true,
  // Add any IP addresses or ranges that should be blocked
  deniedIps: process.env.DENIED_IPS ? process.env.DENIED_IPS.split(',') : [],
};

// Request sanitization rules
export const sanitizationRules = {
  // Remove or encode potentially dangerous characters
  sanitizeBody: {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  },
  // Fields that should never be sanitized (e.g., password hashes)
  excludeFields: ['password', 'hashedPassword'],
};

// Password validation rules
export const passwordRules = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxLength: 128,
};

// Input validation defaults
export const validationDefaults = {
  email: {
    minLength: 5,
    maxLength: 254,
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  },
  username: {
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  name: {
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s-']+$/,
  },
};
