import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { StripeCheckoutService } from '../services/stripe-checkout.service';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';

const router = Router();

const checkoutSessionSchema = z.object({
  tierId: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const customerPortalSchema = z.object({
  returnUrl: z.string().url(),
});

router.post(
  '/create-checkout-session',
  requireAuth,
  validateRequest({ body: checkoutSessionSchema }),
  async (req: AuthRequest, res, next) => {
    try {
      const { tierId, successUrl, cancelUrl } = req.body;
      const session = await StripeCheckoutService.getInstance().createCheckoutSession(
        req.user!.id,
        tierId,
        successUrl,
        cancelUrl
      );
      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/create-portal-session',
  requireAuth,
  validateRequest({ body: customerPortalSchema }),
  async (req: AuthRequest, res, next) => {
    try {
      const { returnUrl } = req.body;
      const session = await StripeCheckoutService.getInstance().createCustomerPortalSession(
        req.user!.id,
        returnUrl
      );
      res.json({ url: session.url });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
