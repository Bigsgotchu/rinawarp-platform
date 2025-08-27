/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import Redis from 'ioredis';
import { config } from 'dotenv';

// Load environment variables
config();

const clearCache = async () => {
  const redis = new Redis(process.env.REDIS_URL!, {
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  });

  try {
    console.log('Clearing Redis cache...');
    await redis.flushall();
    console.log('Cache cleared successfully!');
  } catch (error) {
    console.error('Failed to clear cache:', error);
    process.exit(1);
  } finally {
    await redis.quit();
  }
};

clearCache();
