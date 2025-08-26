import express from 'express';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import authRoutes from '../routes/auth';
import errorRoutes from '../routes/errors';
import billingRoutes from '../routes/billing';
import portalRoutes from '../routes/portal';
import WorkflowLearningService from '../services/command';
import ErrorPatternService from '../services/command';
import SystemMonitorService from '../services/command';
import WorkspaceContextService from '../services/command';
import HistoryService from '../services/command';
import {
  validateErrorAnalysis,
  validateRecoveryAttempt,
  validateErrorQuery,
} from '../middleware/errorValidation';
import CommandController from '../controllers/command';
import {
  gitController,
  dockerController,
  packageController,
} from '../controllers/command';
import { errorHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';
import {
  validateCommand,
  validateHistoryQuery,
  validateHistorySearch,
} from '../middleware/validation';
import {
  validateGitOperation,
  validateDockerOperation,
  validatePackageOperation,
  validateAnalysis,
  validateWorkflowOperation,
  validateProfileOperation,
} from '../middleware/specializedValidation';
import {
  rateLimiter,
  securityHeaders,
  validateCommandSafety,
  sanitizeCommand,
} from '../middleware/security';
import swaggerSpec from '../config/swagger';

// Create Express application
const app = express();
const port = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(securityHeaders);
app.use(rateLimiter);

// Auth routes
app.use('/api/auth', authRoutes);

// Error handling routes
app.use('/api/errors', errorRoutes);

// Billing and portal routes
app.use('/api/billing', billingRoutes);
app.use('/api/portal', portalRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Command execution and history endpoints
app.post(
  '/api/commands',
  [validateCommand, sanitizeCommand, validateCommandSafety],
  CommandController.executeCommand
);

app.get('/api/history', validateHistoryQuery, CommandController.getHistory);

app.get(
  '/api/history/search',
  validateHistorySearch,
  CommandController.searchHistory
);

// Predictive and analysis endpoints
app.get(
  '/api/commands/predict',
  validateAnalysis,
  CommandController.predictNextCommands
);

app.get('/api/commands/workflows', CommandController.detectWorkflow);

app.post(
  '/api/commands/analyze',
  [validateCommand, validateAnalysis],
  CommandController.analyzeImpact
);

// Error handling and recovery routes
app.post(
  '/api/errors/analyze',
  validateErrorAnalysis,
  async (req, res, next) => {
    try {
      const { command, error, workspacePath } = req.body;
      const systemState = await SystemMonitorService.getCurrentMetrics();

      const analysis = await ErrorPatternService.analyzeError(command, error, {
        recentCommands: (await HistoryService.getHistory(5)).map(
          h => h.command
        ),
        projectContext:
          await WorkspaceContextService.getWorkspaceContext(workspacePath),
        systemState,
      });

      res.json(analysis);
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/errors/recovery',
  validateRecoveryAttempt,
  async (req, res, next) => {
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
  }
);

app.get('/api/errors/stats', async (req, res, next) => {
  try {
    const stats = await ErrorPatternService.getErrorStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Command completion and workflow detection
app.get('/api/commands/complete', CommandController.getCompletions);

app.get('/api/commands/detect-workflows', CommandController.detectWorkflows);

// Advanced workflow management
app.post('/api/workflows/record', [validateCommand], async (req, res, next) => {
  try {
    const { command, result, workspacePath } = req.body;
    await WorkflowLearningService.recordCommand(command, result, workspacePath);
    res.json({ status: 'success' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/workflows/suggest', async (req, res, next) => {
  try {
    const { command, workspacePath } = req.query;
    const workflow = await WorkflowLearningService.suggestWorkflow(
      command as string,
      workspacePath as string
    );
    res.json(workflow);
  } catch (error) {
    next(error);
  }
});

// Specialized command endpoints
app.post('/api/git/execute', validateGitOperation, gitController.executeGit);

app.post(
  '/api/docker/execute',
  validateDockerOperation,
  dockerController.executeDocker
);

app.post(
  '/api/package/execute',
  validatePackageOperation,
  packageController.executePackage
);

// User profile endpoints
app.get(
  '/api/profile/:userId/stats',
  validateProfileOperation,
  CommandController.getProfile
);

app.post(
  '/api/workflows',
  [validateWorkflowOperation],
  CommandController.detectWorkflow
);

// Rate limits for specific endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});

const analysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
});

app.use('/api/commands/analyze', analysisLimiter);
app.use('/api/commands/predict', analysisLimiter);
app.use('/api/', apiLimiter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT signal. Shutting down gracefully...');
  process.exit(0);
});
