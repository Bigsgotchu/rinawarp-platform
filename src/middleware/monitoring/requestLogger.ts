import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { performance } from 'perf_hooks';

interface RequestWithStartTime extends Request {
  startTime?: number;
}

export const requestLogger = (includeBody: boolean = false) => {
  return (req: RequestWithStartTime, res: Response, next: NextFunction) => {
    // Record start time
    req.startTime = performance.now();

    // Log request
    const requestLog = {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      ...(includeBody && { body: req.body }),
    };

    logger.info('Incoming request', requestLog);

    // Log response
    const originalEnd = res.end;
    res.end = function (
      chunk?: any,
      encoding?: string | Function,
      cb?: Function
    ): Response {
      const responseTime = performance.now() - (req.startTime || 0);

      const responseLog = {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTime: `${responseTime.toFixed(2)}ms`,
      };

      if (res.statusCode >= 400) {
        logger.error('Request error', responseLog);
      } else {
        logger.info('Request completed', responseLog);
      }

      res.end = originalEnd;
      return res.end(chunk, encoding as string, cb);
    };

    next();
  };
};

// Sensitive data patterns to redact
const sensitivePatterns = [
  /password/i,
  /token/i,
  /key/i,
  /secret/i,
  /authorization/i,
  /api[-_]?key/i,
];

// Helper function to redact sensitive data
export const redactSensitiveData = (data: any): any => {
  if (!data) return data;

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (sensitivePatterns.some(pattern => pattern.test(key))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }

    return redacted;
  }

  return data;
};
