import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/auth';
import logger from '../utils/logger';

export interface UsageTrackingOptions {
  type: string;
  getQuantity?: (req: Request, res: Response) => number;
  getMetadata?: (req: Request, res: Response) => Record<string, any>;
  shouldTrack?: (req: Request, res: Response) => boolean;
}

export function trackUsage(options: UsageTrackingOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function(body: any): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Check if we should track this request
      if (options.shouldTrack?.(req, res) ?? true) {
        const quantity = options.getQuantity?.(req, res) ?? 1;
        const baseMetadata = {
          duration,
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
        };

        const customMetadata = options.getMetadata?.(req, res) || {};
        
        // Track usage asynchronously
        UsageTrackingService.getInstance()
          .trackUsage(options.type, quantity, {
            ...baseMetadata,
            ...customMetadata,
          })
          .catch((error) => {
            logger.error('Failed to track usage:', error);
          });
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

// Common usage tracking middleware
export const trackApiUsage = trackUsage({
  type: 'api_request',
});

export const trackAiUsage = trackUsage({
  type: 'ai_request',
  getMetadata: (req) => ({
    model: req.body.model,
    prompt: req.body.prompt?.length,
  }),
});

export const trackCommandUsage = trackUsage({
  type: 'command_execution',
  getMetadata: (req) => ({
    command: req.body.command,
    context: req.body.context,
  }),
});

export async function trackError(
  error: Error,
  req: Request,
  res: Response
): Promise<void> {
  try {
    await UsageTrackingService.getInstance().trackUsage('error', 1, {
      error: error.message,
      stack: error.stack,
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
    });
  } catch (trackingError) {
    logger.error('Failed to track error:', trackingError);
  }
}
