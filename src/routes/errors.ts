import express from 'express';
import ErrorPatternService from '../services/command';
import WorkspaceContextService from '../services/command';
import SystemMonitorService from '../services/command';
import HistoryService from '../services/command';
import {
  validateErrorAnalysis,
  validateRecoveryAttempt,
} from '../middleware/errorValidation';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = express.Router();

/**
 * @swagger
 * /api/errors/analyze:
 *   post:
 *     tags: [Errors]
 *     summary: Analyze command error and get recovery suggestions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - command
 *               - error
 *               - workspacePath
 *             properties:
 *               command:
 *                 type: string
 *               error:
 *                 type: string
 *               workspacePath:
 *                 type: string
 *     responses:
 *       200:
 *         description: Error analysis and recovery suggestions
 */
router.post('/analyze', validateErrorAnalysis, async (req, res, next) => {
  try {
    const { command, error, workspacePath } = req.body;
    const systemState = await SystemMonitorService.getCurrentMetrics();

    const analysis = await ErrorPatternService.analyzeError(command, error, {
      recentCommands: (await HistoryService.getHistory(5)).map(h => h.command),
      projectContext:
        await WorkspaceContextService.getWorkspaceContext(workspacePath),
      systemState,
    });

    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/errors/recovery:
 *   post:
 *     tags: [Errors]
 *     summary: Record error recovery attempt result
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originalCommand
 *               - error
 *               - recoveryCommand
 *               - success
 *             properties:
 *               originalCommand:
 *                 type: string
 *               error:
 *                 type: string
 *               recoveryCommand:
 *                 type: string
 *               success:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Recovery attempt recorded
 */
router.post('/recovery', validateRecoveryAttempt, async (req, res, next) => {
  try {
    const { originalCommand, error, recoveryCommand, success } = req.body;

    await ErrorPatternService.recordRecoveryAttempt(
      originalCommand,
      error,
      recoveryCommand,
      success
    );

    res.json({ status: 'success' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/errors/stats:
 *   get:
 *     tags: [Errors]
 *     summary: Get error pattern statistics
 *     responses:
 *       200:
 *         description: Error pattern statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await ErrorPatternService.getErrorStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/errors/patterns:
 *   get:
 *     tags: [Errors]
 *     summary: Find similar error patterns
 *     parameters:
 *       - in: query
 *         name: command
 *         required: true
 *         schema:
 *           type: string
 *         description: Command that produced the error
 *       - in: query
 *         name: error
 *         required: true
 *         schema:
 *           type: string
 *         description: Error message to find patterns for
 *     responses:
 *       200:
 *         description: Similar error patterns
 */
router.get('/patterns', async (req, res, next) => {
  try {
    const { command, error } = req.query;

    if (!command || !error) {
      throw new AppError(
        'Command and error are required',
        'INVALID_INPUT',
        400
      );
    }

    const patterns = await ErrorPatternService.findSimilarErrors(
      command as string,
      error as string
    );

    res.json(patterns);
  } catch (error) {
    next(error);
  }
});

export default router;
