import { EnvConfig } from '../types/env';

// Load environment variables
const requireEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
};

// Create mutable config for tests
export let env: EnvConfig = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  API_URL: process.env.API_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  WEBSITE_API_URL: process.env.WEBSITE_API_URL || process.env.API_URL || 'http://localhost:3000',
  API_TIMEOUT: parseInt(process.env.API_TIMEOUT || '10000', 10),

  // Usage Tracking
  ENABLE_USAGE_TRACKING: process.env.NODE_ENV === 'production' || process.env.ENABLE_USAGE_TRACKING === 'true',
  BATCH_USAGE_TRACKING: process.env.NODE_ENV === 'production' || process.env.BATCH_USAGE_TRACKING === 'true',
  USAGE_BATCH_SIZE: parseInt(process.env.USAGE_BATCH_SIZE || '50', 10),
  USAGE_BATCH_INTERVAL: parseInt(process.env.USAGE_BATCH_INTERVAL || '5000', 10),
  USAGE_RETENTION: parseInt(process.env.USAGE_RETENTION || String(30 * 24 * 3600), 10),

  // Analytics & monitoring
  EVENT_RETENTION: parseInt(process.env.EVENT_RETENTION || String(7 * 24 * 3600), 10),
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT || String(30 * 60 * 1000), 10),
  METRICS_RETENTION: parseInt(process.env.METRICS_RETENTION || String(24 * 3600), 10),
  METRICS_INTERVAL: parseInt(process.env.METRICS_INTERVAL || '60000', 10),
  SENTRY_DSN: process.env.SENTRY_DSN,

  // Rate Limiting (moved to base.ts)
  STRICT_RATE_LIMITING: process.env.NODE_ENV === 'production' || process.env.STRICT_RATE_LIMITING === 'true',
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,

  // Database and caching
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  // Authentication and security
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  COOKIE_SECRET: process.env.COOKIE_SECRET,

  // External services
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
};

// Reset to defaults for tests
export function resetEnv() {
  if (process.env.NODE_ENV === 'test') {
    env = {
      NODE_ENV: 'test',
      PORT: 3000,
      HOST: '0.0.0.0',
      ENABLE_USAGE_TRACKING: false,
      BATCH_USAGE_TRACKING: false,
      USAGE_BATCH_SIZE: 50,
      USAGE_BATCH_INTERVAL: 5000,
      STRICT_RATE_LIMITING: false,
    };
  }
}

// Production environment validation
if (env.NODE_ENV === 'production') {
  const requiredVars = [
    // Core application URLs
    'API_URL',
    'FRONTEND_URL',
    'WEBSITE_API_URL',
    
    // Database and caching
    'DATABASE_URL',
    'REDIS_URL',
    'REDIS_PASSWORD',
    
    // Authentication and security
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'COOKIE_SECRET',
    
    // External services
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ZONE_ID',
    'SENDGRID_API_KEY',
    
    // Monitoring
    'SENTRY_DSN',
  ];

  for (const varName of requiredVars) {
    requireEnvVar(varName);
  }
}
