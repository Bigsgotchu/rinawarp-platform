import Redis from 'ioredis';
import { env } from '../config/env';

const redisClient = new Redis({
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT || 6379,
  password: env.REDIS_PASSWORD,
  keyPrefix: env.REDIS_PREFIX || 'warp:',
});

import logger from '../utils/logger';

redisClient.on('error', (error) => {
  logger.error('Redis Client Error:', error);
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

export { redisClient };
