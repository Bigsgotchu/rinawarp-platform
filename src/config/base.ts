/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

const requireEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
};

export default {
  // Application configuration
  app: {
    env: process.env.NODE_ENV || 'development',
    apiUrl: requireEnvVar('API_URL'),
    frontendUrl: requireEnvVar('FRONTEND_URL'),
  },

  // Server configuration
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
  },

  // Database configuration
  database: {
    url: requireEnvVar('DATABASE_URL'),
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true',
  },

  // Redis configuration
  redis: {
    url: requireEnvVar('REDIS_URL'),
    password: requireEnvVar('REDIS_PASSWORD'),
    tls:
      process.env.NODE_ENV === 'production' || process.env.REDIS_TLS === 'true',
  },

  // JWT configuration
  jwt: {
    secret: requireEnvVar('JWT_SECRET'),
    refreshSecret: requireEnvVar('JWT_REFRESH_SECRET'),
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '1h',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per windowMs
  },

  // OpenAI configuration
  openai: {
    apiKey: requireEnvVar('OPENAI_API_KEY'),
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10),
  },

  // Email configuration
  email: {
    from: process.env.EMAIL_FROM || 'noreply@rinawarp.com',
    smtp: {
      host: requireEnvVar('SMTP_HOST'),
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure:
        process.env.NODE_ENV === 'production' ||
        process.env.SMTP_SECURE === 'true',
      auth: {
        user: requireEnvVar('SMTP_USER'),
        pass: requireEnvVar('SMTP_PASS'),
      },
    },
  },

  // Monitoring and logging
  monitoring: {
    sentry: {
      dsn: requireEnvVar('SENTRY_DSN'),
      environment: process.env.NODE_ENV || 'development',
    },
    logLevel: process.env.LOG_LEVEL || 'info',
    enableRequestLogging:
      process.env.NODE_ENV !== 'production' ||
      process.env.ENABLE_REQUEST_LOGGING === 'true',
  },

  // Security
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    enableCSRF:
      process.env.NODE_ENV === 'production' ||
      process.env.ENABLE_CSRF === 'true',
    trustProxy:
      process.env.NODE_ENV === 'production' ||
      process.env.TRUST_PROXY === 'true',
    cookieSecret: requireEnvVar('COOKIE_SECRET'),
    sessionDuration: parseInt(process.env.SESSION_DURATION || '86400000', 10),
  },

  // Payment processing
  stripe: {
    secretKey: requireEnvVar('STRIPE_SECRET_KEY'),
    webhookSecret: requireEnvVar('STRIPE_WEBHOOK_SECRET'),
  },

  // CDN and DNS
  cloudflare: {
    apiToken: requireEnvVar('CLOUDFLARE_API_TOKEN'),
    zoneId: requireEnvVar('CLOUDFLARE_ZONE_ID'),
  },

  // Website API configuration
  websiteApi: {
    baseUrl: requireEnvVar('WEBSITE_API_URL'),
    timeout: parseInt(process.env.API_TIMEOUT || '10000', 10),
  },
};
