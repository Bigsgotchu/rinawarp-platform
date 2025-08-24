import { Request, Response, NextFunction } from 'express';
import CommandService from '../services/CommandService';
import HistoryService from '../services/HistoryService';
import AIService from '../services/AIService';
import CommandLearningService from '../services/CommandLearningService';
import WorkflowLearningService from '../services/WorkflowLearningService';
import CommandCompletionService from '../services/CommandCompletionService';
import UserProfileService from '../services/UserProfileService';
import CommandPatternService from '../services/CommandPatternService';
import SystemMonitorService from '../services/SystemMonitorService';
import ErrorPatternService from '../services/ErrorPatternService';
import { Command, CommandContext } from '../types';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import os from 'os';

export class CommandController {
  private async buildCommandContext(req: Request): Promise<CommandContext> {
    const recentHistory = await HistoryService.getHistory(5);
    
    return {
      previousCommands: recentHistory.map(h => h.command),
      currentDirectory: req.body.cwd || process.cwd(),
      operatingSystem: os.platform(),
    };
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId || 'default';
      const stats = await UserProfileService.getProfileStats(userId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  async predictNextCommands(req: Request, res: Response, next: NextFunction) {
    try {
      const systemState = await SystemMonitorService.getCurrentMetrics();
      const recentHistory = (await HistoryService.getHistory(5))
        .map(h => h.command);

      const predictions = await CommandPatternService.predictNextCommands(
        recentHistory,
        systemState
      );

      res.json({
        predictions,
        systemState
      });
    } catch (error) {
      next(error);
    }
  }

  async detectWorkflow(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await HistoryService.getHistory(10);
      const commands = history.map(h => h.command);
      
      const workflows = await CommandPatternService.detectWorkflow(commands);
      
      res.json({
        currentCommands: commands,
        suggestedWorkflows: workflows
      });
    } catch (error) {
      next(error);
    }
  }

  async analyzeImpact(req: Request, res: Response, next: NextFunction) {
    try {
      const command: Command = req.body;
      if (!command.command) {
        throw new AppError('Command is required', 'INVALID_INPUT', 400);
      }

      const systemState = await SystemMonitorService.getCurrentMetrics();
      const impact = await CommandPatternService.predictCommandImpact(
        command,
        systemState
      );

      const timing = await CommandPatternService.suggestCommandTiming(
        command,
        systemState
      );

      res.json({
        command,
        impact,
        timing,
        currentSystemState: systemState
      });
    } catch (error) {
      next(error);
    }
  }

  async executeCommand(req: Request, res: Response, next: NextFunction) {
    try {
      const command: Command = req.body;
      
      if (!command.command) {
        throw new AppError('Command is required', 'INVALID_INPUT', 400);
      }

      logger.info('Executing command:', { command });
      
      // Build command context
      const userId = req.params.userId || 'default';
      const context = await this.buildCommandContext(req);
      const systemState = await SystemMonitorService.getCurrentMetrics();

      // Check command timing and impact
      const timing = await CommandPatternService.suggestCommandTiming(
        command,
        systemState
      );

      if (timing.shouldWait) {
        logger.warn('Suboptimal timing for command:', timing.reason);
      }

      // Analyze command before execution
      const analysis = await AIService.analyzeCommand(command, context, userId);

      // Get workflow suggestions before execution
      const workflow = await WorkflowLearningService.suggestWorkflow(
        command.command,
        context.currentDirectory
      );

      // Execute command
      const result = await CommandService.executeCommand(command);
      const historyEntry = await HistoryService.addEntry(command.command, result);

      // Learn from the command execution and update patterns
      await Promise.all([
        CommandLearningService.learnFromCommand(command, result, context),
        WorkflowLearningService.recordCommand(command, result, context.currentDirectory),
        UserProfileService.updateFromCommand(userId, command, result),
        CommandPatternService.recordCommandExecution(command, result, systemState)
      ]);

      // Get next command suggestions
      const nextCommands = await WorkflowLearningService.suggestNextCommands(
        command.command,
        context.currentDirectory
      );

// If there was an error, analyze it
      let errorAnalysis = null;
      if (result.error) {
        const systemState = await SystemMonitorService.getCurrentMetrics();
        errorAnalysis = await ErrorPatternService.analyzeError(
          command.command,
          result.error,
          {
            recentCommands: (await HistoryService.getHistory(5)).map(h => h.command),
            projectContext: await WorkspaceContextService.getWorkspaceContext(context.currentDirectory),
            systemState
          }
        );
      }

      res.json({
        result,
        historyEntry,
        analysis,
        errorAnalysis,
        timing,
        systemState,
        workflow: workflow ? {
          pattern: workflow,
          nextSteps: workflow.steps
            .slice(workflow.steps.findIndex(s => s.command === command.command) + 1)
        } : null,
        nextCommands: nextCommands.map(suggestion => ({
          command: suggestion.command,
          confidence: suggestion.confidence,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const history = await HistoryService.getHistory(limit, offset);
      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  async getCompletions(req: Request, res: Response, next: NextFunction) {
    try {
      const { input, cursorPosition, workspacePath } = req.query;
      
      if (!input) {
        throw new AppError('Input is required', 'INVALID_INPUT', 400);
      }

      const completions = await CommandCompletionService.getCompletions({
        input: input as string,
        cursorPosition: parseInt(cursorPosition as string) || (input as string).length,
        workspacePath: workspacePath as string,
        recentCommands: (await HistoryService.getHistory(5)).map(h => h.command),
      });

      res.json(completions);
    } catch (error) {
      next(error);
    }
  }

  async detectWorkflows(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspacePath } = req.query;
      
      if (!workspacePath) {
        throw new AppError('Workspace path is required', 'INVALID_INPUT', 400);
      }

      const projectInfo = await WorkflowLearningService.detectProjectType(
        workspacePath as string
      );

      res.json(projectInfo);
    } catch (error) {
      next(error);
    }
  }

  async searchHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query.q as string;
      
      if (!query) {
        throw new AppError('Search query is required', 'INVALID_INPUT', 400);
      }

      const results = await HistoryService.searchHistory(query);
      res.json(results);
    } catch (error) {
      next(error);
    }
  }
}

export default new CommandController();
