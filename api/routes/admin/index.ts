import express from 'express';
import triggerReportRouter from './trigger-report';

const router = express.Router();

// Mount all admin routes
router.use('/trigger-report', triggerReportRouter);

export default router;
