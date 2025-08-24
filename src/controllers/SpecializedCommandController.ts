import { Request, Response, NextFunction } from 'express';
import CommandService from '../services/CommandService';
import AIService from '../services/AIService';
import WorkspaceContextService from '../services/WorkspaceContextService';
import CommandChainService from '../services/CommandChainService';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

/**
 * @swagger
 * tags:
 *   name: Git
 *   description: Git operations
 */
interface OperationContext {
  workspacePath: string;
  context?: any;
  analysis?: any;
}

export class GitController {
  /**
   * @swagger
   * /api/git/execute:
   *   post:
   *     tags: [Git]
   *     summary: Execute a git command
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - operation
   *             properties:
   *               operation:
   *                 type: string
   *                 enum: [clone, pull, push, commit, checkout, merge]
   *               repository:
   *                 type: string
   *               branch:
   *                 type: string
   *               message:
   *                 type: string
   *     responses:
   *       200:
   *         description: Command executed successfully
   */
  private async validateGitContext(workspacePath: string): Promise<any> {
    const context = await WorkspaceContextService.getWorkspaceContext(workspacePath);
    if (!context.git) {
      throw new AppError('Not a git repository', 'INVALID_CONTEXT', 400);
    }
    return context;
  }

  private async getOperationContext(req: Request): Promise<OperationContext> {
    const workspacePath = req.body.cwd || process.cwd();
    const context = await this.validateGitContext(workspacePath);
    
    // Get AI suggestions for the operation
    const analysis = await AIService.analyzeCommand(
      { command: 'git', args: req.body.args },
      {
        currentDirectory: workspacePath,
        previousCommands: context.git?.status.modified || [],
      }
    );

    return { workspacePath, context, analysis };
  }

  async executeGit(req: Request, res: Response, next: NextFunction) {
    try {
      const { operation, repository, branch, message } = req.body;
      const { workspacePath, context, analysis } = await this.getOperationContext(req);
      
      let command: string;
      let chainSteps = [];

      switch (operation) {
        case 'clone':
          command = `git clone ${repository}`;
          break;
        case 'pull':
          command = `git pull ${repository || 'origin'} ${branch || 'main'}`;
          break;
        case 'push':
          command = `git push ${repository || 'origin'} ${branch || 'main'}`;
          break;
        case 'commit':
          command = `git commit -m "${message}"`;
          break;
        case 'checkout':
          command = `git checkout ${branch}`;
          break;
        case 'merge':
          command = `git merge ${branch}`;
          break;
        default:
          throw new AppError('Invalid git operation', 'INVALID_OPERATION', 400);
      }

      // Create command object
      const commandObj = {
        command: 'git',
        args: command.split(' ').slice(1)
      };

      // Execute command
      const result = await CommandService.executeCommand(commandObj);

      // Create command chain if needed
      if (chainSteps.length > 0) {
        const chain = await CommandChainService.createChain({
          name: `git_${operation}_chain`,
          description: `Chain for git ${operation} operation`,
          steps: chainSteps,
          context: {
            workspace: workspacePath,
            environment: process.env.NODE_ENV,
          },
        });
        await CommandChainService.executeChain(chain.id, workspacePath);
      }

// Update workspace context
      await WorkspaceContextService.getWorkspaceContext(workspacePath);

      const suggestions = await WorkspaceContextService.suggestActions(workspacePath);

      res.json({
        result,
        analysis,
        context: context.git,
        suggestions,
      });
    } catch (error) {
      next(error);
    }
  }
}

/**
 * @swagger
 * tags:
 *   name: Docker
 *   description: Docker operations
 */
export class DockerController {
  /**
   * @swagger
   * /api/docker/execute:
   *   post:
   *     tags: [Docker]
   *     summary: Execute a docker command
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - operation
   *             properties:
   *               operation:
   *                 type: string
   *                 enum: [build, run, stop, remove, logs, exec]
   *               container:
   *                 type: string
   *               image:
   *                 type: string
   *               options:
   *                 type: object
   *     responses:
   *       200:
   *         description: Command executed successfully
   */
  async executeDocker(req: Request, res: Response, next: NextFunction) {
    try {
      const { operation, container, image, options } = req.body;
      let command: string;

      switch (operation) {
        case 'build':
          command = `docker build ${options?.path || '.'} -t ${image}`;
          break;
        case 'run':
          command = `docker run ${container} ${image}`;
          break;
        case 'stop':
          command = `docker stop ${container}`;
          break;
        case 'remove':
          command = `docker rm ${container}`;
          break;
        case 'logs':
          command = `docker logs ${container}`;
          break;
        case 'exec':
          command = `docker exec ${container} ${options?.command}`;
          break;
        default:
          throw new AppError('Invalid docker operation', 'INVALID_OPERATION', 400);
      }

      const result = await CommandService.executeCommand({
        command: 'docker',
        args: command.split(' ').slice(1)
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

/**
 * @swagger
 * tags:
 *   name: Package
 *   description: Package management operations
 */
export class PackageController {
  /**
   * @swagger
   * /api/package/execute:
   *   post:
   *     tags: [Package]
   *     summary: Execute a package management command
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - operation
   *               - manager
   *             properties:
   *               operation:
   *                 type: string
   *                 enum: [install, uninstall, update, list, search]
   *               manager:
   *                 type: string
   *                 enum: [npm, yarn, pip, brew]
   *               packages:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Command executed successfully
   */
  async executePackage(req: Request, res: Response, next: NextFunction) {
    try {
      const { operation, manager, packages } = req.body;
      let command: string;

      switch (operation) {
        case 'install':
          command = `${manager} ${manager === 'pip' ? 'install' : 'add'} ${packages.join(' ')}`;
          break;
        case 'uninstall':
          command = `${manager} ${manager === 'pip' ? 'uninstall' : 'remove'} ${packages.join(' ')}`;
          break;
        case 'update':
          command = `${manager} update ${packages.join(' ')}`;
          break;
        case 'list':
          command = `${manager} list`;
          break;
        case 'search':
          command = `${manager} search ${packages[0]}`;
          break;
        default:
          throw new AppError('Invalid package operation', 'INVALID_OPERATION', 400);
      }

      const result = await CommandService.executeCommand({
        command: manager,
        args: command.split(' ').slice(1)
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const gitController = new GitController();
export const dockerController = new DockerController();
export const packageController = new PackageController();
