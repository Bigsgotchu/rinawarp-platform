export interface EnvConfig {
  // Server settings
  NODE_ENV: string;
  PORT: number;
  HOST: string;
  API_URL: string;
  FRONTEND_URL: string;
  WEBSITE_API_URL: string;
  API_TIMEOUT: number;

  // Usage tracking
  ENABLE_USAGE_TRACKING: boolean;
  BATCH_USAGE_TRACKING: boolean;
  USAGE_BATCH_SIZE: number;
  USAGE_BATCH_INTERVAL: number;
  USAGE_RETENTION: number;

  // Analytics & monitoring
  EVENT_RETENTION: number;
  SESSION_TIMEOUT: number;
  METRICS_RETENTION: number;
  METRICS_INTERVAL: number;
  SENTRY_DSN?: string;

  // Rate limiting
  STRICT_RATE_LIMITING: boolean;
  CORS_ALLOWED_ORIGINS?: string;

  // Database and caching
  DATABASE_URL?: string;
  REDIS_URL?: string;
  REDIS_PASSWORD?: string;

  // Authentication and security
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  COOKIE_SECRET?: string;

  // External services
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  SENDGRID_API_KEY?: string;
}
