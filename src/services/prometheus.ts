import client from 'prom-client';
import { env } from '../config/env';

// Create a Registry to register metrics
const register = new client.Registry();

// Enable the collection of default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'rinawarp_',
});

// HTTP request metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Database metrics
export const dbConnectionPoolSize = new client.Gauge({
  name: 'db_connection_pool_size',
  help: 'Current size of the database connection pool',
});

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

// Redis metrics
export const redisOperationDuration = new client.Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
});

export const redisConnectionStatus = new client.Gauge({
  name: 'redis_connection_status',
  help: 'Status of Redis connection (1 for connected, 0 for disconnected)',
});

// Business metrics
export const activeUsers = new client.Gauge({
  name: 'active_users',
  help: 'Number of currently active users',
});

export const subscriptionStatus = new client.Gauge({
  name: 'subscription_status',
  help: 'Status of user subscriptions',
  labelNames: ['plan_type'],
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(dbConnectionPoolSize);
register.registerMetric(dbQueryDuration);
register.registerMetric(redisOperationDuration);
register.registerMetric(redisConnectionStatus);
register.registerMetric(activeUsers);
register.registerMetric(subscriptionStatus);

// Export metrics endpoint handler
export const metricsHandler = async (req: any, res: any) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
};

// Helper function to wrap async route handlers with prometheus metrics
export const wrapWithMetrics = (handler: Function) => {
  return async (req: any, res: any, next: any) => {
    const start = Date.now();
    const route = req.route?.path || req.path;

    try {
      await handler(req, res, next);
    } finally {
      const duration = (Date.now() - start) / 1000;
      const statusCode = res.statusCode.toString();

      httpRequestDuration.observe(
        { method: req.method, route, status_code: statusCode },
        duration
      );
      httpRequestTotal.inc({ method: req.method, route, status_code: statusCode });
    }
  };
};

// Database query wrapper
export const wrapDbQuery = async (
  queryType: string,
  queryFn: () => Promise<any>
) => {
  const start = Date.now();
  try {
    return await queryFn();
  } finally {
    const duration = (Date.now() - start) / 1000;
    dbQueryDuration.observe({ query_type: queryType }, duration);
  }
};

// Redis operation wrapper
export const wrapRedisOperation = async (
  operationType: string,
  operationFn: () => Promise<any>
) => {
  const start = Date.now();
  try {
    return await operationFn();
  } finally {
    const duration = (Date.now() - start) / 1000;
    redisOperationDuration.observe({ operation_type: operationType }, duration);
  }
};

export default register;
