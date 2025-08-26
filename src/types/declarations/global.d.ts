import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

declare global {
  var prisma: PrismaClient;
  var redis: Redis;
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      DATABASE_URL: string;
      REDIS_URL?: string;
      REDIS_PASSWORD?: string;
      REDIS_TLS?: string;
      JWT_SECRET: string;
      JWT_REFRESH_SECRET: string;
      SENTRY_DSN?: string;
      LOG_LEVEL?: string;
      OPENAI_API_KEY?: string;
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_USER?: string;
      SMTP_PASS?: string;
    }
  }
}
