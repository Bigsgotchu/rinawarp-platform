import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import analyticsRoutes from './analytics';
import billingRoutes from './billing';
import portalRoutes from './portal';
import workflowRoutes from './workflow';
import { errorHandler } from '../middleware/errorHandler';

const router = Router();

// API version prefix
const API_PREFIX = '/api/v1';

// Mount routes
router.use(`${API_PREFIX}/auth`, authRoutes);
router.use(`${API_PREFIX}/users`, userRoutes);
router.use(`${API_PREFIX}/analytics`, analyticsRoutes);
router.use(`${API_PREFIX}/billing`, billingRoutes);
router.use(`${API_PREFIX}/portal`, portalRoutes);
router.use(`${API_PREFIX}/workflows`, workflowRoutes);

// Global error handler
router.use(errorHandler);

export default router;
