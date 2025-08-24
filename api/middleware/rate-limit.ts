/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

const prisma = new PrismaClient();

// Store rate limiters by tier
const rateLimiters: Record<string, RateLimiterMemory> = {};

// Initialize rate limiters for each tier
async function initializeRateLimiters() {
  const tiers = await prisma.subscriptionTier.findMany({
    where: { active: true }
  });

  tiers.forEach(tier => {
    const features = tier.features as any;
    const requestsPerMonth = features.aiAssistance.requestsPerMonth;
    
    // Skip unlimited tiers
    if (requestsPerMonth === null) return;

    // Calculate requests per second (with some burst allowance)
    const requestsPerSecond = Math.max(
      1,
      Math.ceil(requestsPerMonth / (30 * 24 * 60 * 60))
    );

    rateLimiters[tier.id] = new RateLimiterMemory({
      points: requestsPerSecond * 5, // Allow bursting
      duration: 5, // Per 5 seconds
      blockDuration: 60 // Block for 1 minute if exceeded
    });
  });
}

// Initialize on startup
initializeRateLimiters().catch(console.error);

// Refresh rate limiters every hour
setInterval(() => {
  initializeRateLimiters().catch(console.error);
}, 60 * 60 * 1000);

interface ExtendedRequest extends Request {
  user?: {
    id: string;
    subscription?: {
      tierId: string;
    };
  };
}

export async function rateLimiter(req: ExtendedRequest, res: Response, next: NextFunction) {
  if (!req.user?.id || !req.user?.subscription?.tierId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tierId } = req.user.subscription;
  const limiter = rateLimiters[tierId];

  // Skip rate limiting for unlimited tiers
  if (!limiter) {
    return next();
  }

  try {
    await limiter.consume(req.user.id);
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error instanceof RateLimiterRes) {
        const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 1;
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: 'Too Many Requests',
          retryAfter,
          message: `Rate limit exceeded. Please retry in ${retryAfter} seconds.`,
          upgradePlan: '/api/subscription/upgrade'
        });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Unknown rate limiting error' });
  }
}
