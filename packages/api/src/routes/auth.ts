import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const authService = new AuthService();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// Routes
router.post('/register', validateRequest({ body: registerSchema }), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const result = await authService.register(email, password, name);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/login', validateRequest({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', validateRequest({ body: refreshSchema }), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

import type { AuthRequest } from '../middleware/auth';

router.post('/logout', requireAuth, async (req: AuthRequest, res, next) => {
  try {
await authService.logout(req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
