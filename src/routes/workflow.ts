import express from 'express';
import { validateCommand } from '../middleware/validation';
import { validateWorkflowQuery } from '../middleware/workflowValidation';
import CommandController from '../controllers/command';
import WorkflowLearningService from '../services/command';
import { AppError } from '../middleware/errorHandler';

const router = express.Router();

/**
 * @swagger
 * /api/commands/complete:
 *   get:
 *     tags: [Commands]
 *     summary: Get command completion suggestions
 *     parameters:
 *       - in: query
 *         name: input
 *         required: true
 *         schema:
 *           type: string
 *         description: Current command input
 *       - in: query
 *         name: cursorPosition
 *         schema:
 *           type: integer
 *         description: Current cursor position in input
 *       - in: query
 *         name: workspacePath
 *         schema:
 *           type: string
 *         description: Current workspace path
 *     responses:
 *       200:
 *         description: Command suggestions
 */
router.get('/commands/complete', CommandController.getCompletions);

/**
 * @swagger
 * /api/commands/detect-workflows:
 *   get:
 *     tags: [Workflows]
 *     summary: Detect project workflows
 *     parameters:
 *       - in: query
 *         name: workspacePath
 *         required: true
 *         schema:
 *           type: string
 *         description: Project workspace path
 *     responses:
 *       200:
 *         description: Detected workflows
 */
router.get('/commands/detect-workflows', CommandController.detectWorkflows);

/**
 * @swagger
 * /api/workflows/record:
 *   post:
 *     tags: [Workflows]
 *     summary: Record command execution for workflow learning
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - command
 *               - result
 *             properties:
 *               command:
 *                 $ref: '#/components/schemas/Command'
 *               result:
 *                 $ref: '#/components/schemas/CommandResult'
 *               workspacePath:
 *                 type: string
 *     responses:
 *       200:
 *         description: Command recorded
 */
router.post('/workflows/record', [validateCommand], async (req, res, next) => {
  try {
    const { command, result, workspacePath } = req.body;
    await WorkflowLearningService.recordCommand(command, result, workspacePath);
    res.json({ status: 'success' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/workflows/suggest:
 *   get:
 *     tags: [Workflows]
 *     summary: Get workflow suggestions for a command
 *     parameters:
 *       - in: query
 *         name: command
 *         required: true
 *         schema:
 *           type: string
 *         description: Command to get suggestions for
 *       - in: query
 *         name: workspacePath
 *         schema:
 *           type: string
 *         description: Current workspace path
 *     responses:
 *       200:
 *         description: Workflow suggestions
 */
router.get(
  '/workflows/suggest',
  [validateWorkflowQuery],
  async (req, res, next) => {
    try {
      const { command, workspacePath } = req.query;
      if (!command) {
        throw new AppError('Command is required', 'INVALID_INPUT', 400);
      }

      const workflow = await WorkflowLearningService.suggestWorkflow(
        command as string,
        workspacePath as string
      );
      res.json(workflow);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
