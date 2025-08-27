import { Request, Response, NextFunction } from 'express';
import { Buffer } from 'buffer';
import { logger } from '@rinawarp/shared';

export function stripeWebhookMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/api/webhooks/stripe') {
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      (req as any).rawBody = rawBody;
      next();
    });

    req.on('error', (err) => {
      logger.error('Error reading Stripe webhook payload:', err);
      res.status(400).json({ error: 'Failed to read request body' });
    });
  } else {
    next();
  }
}
