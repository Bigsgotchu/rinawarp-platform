import Redis from 'ioredis';
import WorkspaceContextService from './WorkspaceContextService';
import WorkflowLearningService from './WorkflowLearningService';
import AIService from './AIService';
import logger from '../utils/logger';

interface Completion {
  command: string;
  description: string;
  args?: string[];
  score: number;
}

interface CompletionContext {
  input: string;
  cursorPosition: number;
  workspacePath?: string;
  recentCommands?: string[];
}

class CommandCompletionService {
  private redis: Redis;
  private readonly COMPLETIONS_CACHE_KEY = 'command_completions';
  private readonly CACHE_TTL = 3600; // 1 hour

  private readonly COMMON_COMMANDS = new Map<string, string[]>([
    ['git', ['add', 'commit', 'push', 'pull', 'checkout', 'merge', 'status']],
    ['docker', ['build', 'run', 'stop', 'ps', 'logs', 'exec']],
    ['npm', ['install', 'start', 'run', 'test', 'build']],
    ['yarn', ['add', 'remove', 'start', 'build']],
  ]);

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async getCompletions(context: CompletionContext): Promise<Completion[]> {
    try {
      const input = context.input.slice(0, context.cursorPosition);
      const parts = input.trim().split(' ');
      const currentWord = parts[parts.length - 1];
      const isFirstWord = parts.length === 1;

      // Get workspace context if available
      const workspaceContext = context.workspacePath
        ? await WorkspaceContextService.getWorkspaceContext(
            context.workspacePath
          )
        : undefined;

      // Get cached completions
      const cached = await this.getCachedCompletions(input);
      if (cached) return cached;

      let completions: Completion[] = [];

      if (isFirstWord) {
        // Suggest base commands
        completions = await this.getBaseCommandCompletions(
          currentWord,
          workspaceContext
        );
      } else {
        // Suggest arguments based on the command
        const baseCommand = parts[0];
        completions = await this.getArgumentCompletions(
          baseCommand,
          currentWord,
          parts.slice(1, -1),
          workspaceContext
        );
      }

      // Add workflow-based suggestions
      if (context.workspacePath) {
        const workflowSuggestions =
          await WorkflowLearningService.suggestNextCommands(
            parts.join(' '),
            context.workspacePath
          );

        completions.push(
          ...workflowSuggestions.map(suggestion => ({
            command: suggestion.command,
            description: 'Based on workflow history',
            score: suggestion.confidence * 100,
          }))
        );
      }

      // Sort by score and cache
      completions.sort((a, b) => b.score - a.score);
      await this.cacheCompletions(input, completions);

      return completions;
    } catch (error) {
      logger.error('Failed to get completions:', error);
      return [];
    }
  }

  private async getBaseCommandCompletions(
    prefix: string,
    context?: any
  ): Promise<Completion[]> {
    const completions: Completion[] = [];

    // Add common commands
    for (const [cmd, subcommands] of this.COMMON_COMMANDS.entries()) {
      if (cmd.startsWith(prefix)) {
        completions.push({
          command: cmd,
          description: `Common ${cmd} operations`,
          args: subcommands,
          score: 80,
        });
      }
    }

    // Add context-based commands
    if (context) {
      if (context.git && 'git'.startsWith(prefix)) {
        completions.push({
          command: 'git',
          description: `Git operations (current branch: ${context.git.branch})`,
          args: ['add', 'commit', 'push'],
          score: 90,
        });
      }

      if (context.docker?.containers.length && 'docker'.startsWith(prefix)) {
        completions.push({
          command: 'docker',
          description: `Docker operations (${context.docker.containers.length} containers)`,
          args: ['ps', 'logs', 'stop'],
          score: 85,
        });
      }

      if (context.package && context.package.manager.startsWith(prefix)) {
        const scripts = Object.keys(context.package.scripts || {});
        completions.push({
          command: context.package.manager,
          description: `Package manager (${scripts.length} scripts available)`,
          args: scripts,
          score: 85,
        });
      }
    }

    return completions;
  }

  private async getArgumentCompletions(
    command: string,
    currentArg: string,
    previousArgs: string[],
    context?: any
  ): Promise<Completion[]> {
    const completions: Completion[] = [];

    switch (command) {
      case 'git':
        completions.push(
          ...this.getGitArgCompletions(currentArg, previousArgs, context)
        );
        break;
      case 'docker':
        completions.push(
          ...this.getDockerArgCompletions(currentArg, previousArgs, context)
        );
        break;
      case 'npm':
      case 'yarn':
        completions.push(
          ...this.getPackageArgCompletions(
            command,
            currentArg,
            previousArgs,
            context
          )
        );
        break;
    }

    return completions;
  }

  private getGitArgCompletions(
    currentArg: string,
    previousArgs: string[],
    context?: any
  ): Completion[] {
    const completions: Completion[] = [];
    const lastArg = previousArgs[previousArgs.length - 1];

    if (!previousArgs.length) {
      // First argument completions
      const gitCommands = [
        'add',
        'commit',
        'push',
        'pull',
        'checkout',
        'merge',
      ];
      completions.push(
        ...gitCommands
          .filter(cmd => cmd.startsWith(currentArg))
          .map(cmd => ({
            command: cmd,
            description: `Git ${cmd} operation`,
            score: 80,
          }))
      );
    } else if (context?.git) {
      switch (lastArg) {
        case 'checkout':
          // Suggest branches
          completions.push({
            command: context.git.branch,
            description: 'Current branch',
            score: 90,
          });
          break;
        case 'add':
          // Suggest modified files
          completions.push(
            ...context.git.status.modified.map(file => ({
              command: file,
              description: 'Modified file',
              score: 85,
            }))
          );
          break;
      }
    }

    return completions;
  }

  private getDockerArgCompletions(
    currentArg: string,
    previousArgs: string[],
    context?: any
  ): Completion[] {
    const completions: Completion[] = [];
    const lastArg = previousArgs[previousArgs.length - 1];

    if (!previousArgs.length) {
      // First argument completions
      const dockerCommands = ['build', 'run', 'stop', 'ps', 'logs', 'exec'];
      completions.push(
        ...dockerCommands
          .filter(cmd => cmd.startsWith(currentArg))
          .map(cmd => ({
            command: cmd,
            description: `Docker ${cmd} operation`,
            score: 80,
          }))
      );
    } else if (context?.docker) {
      switch (lastArg) {
        case 'stop':
        case 'logs':
        case 'exec':
          // Suggest container names
          completions.push(
            ...context.docker.containers.map(container => ({
              command: container.name,
              description: `Container (${container.status})`,
              score: 85,
            }))
          );
          break;
        case 'run':
          // Suggest images
          completions.push(
            ...context.docker.images.map(image => ({
              command: image.tag,
              description: `Image (${image.size})`,
              score: 80,
            }))
          );
          break;
      }
    }

    return completions;
  }

  private getPackageArgCompletions(
    command: string,
    currentArg: string,
    previousArgs: string[],
    context?: any
  ): Completion[] {
    const completions: Completion[] = [];
    const lastArg = previousArgs[previousArgs.length - 1];

    if (!previousArgs.length) {
      // First argument completions
      const packageCommands = ['install', 'remove', 'run', 'test', 'build'];
      completions.push(
        ...packageCommands
          .filter(cmd => cmd.startsWith(currentArg))
          .map(cmd => ({
            command: cmd,
            description: `${command} ${cmd} operation`,
            score: 80,
          }))
      );
    } else if (context?.package) {
      switch (lastArg) {
        case 'run':
          // Suggest available scripts
          completions.push(
            ...Object.entries(context.package.scripts || {}).map(
              ([name, script]) => ({
                command: name,
                description: `Script: ${script}`,
                score: 85,
              })
            )
          );
          break;
        case 'remove':
          // Suggest installed packages
          completions.push(
            ...Object.keys(context.package.dependencies || {}).map(pkg => ({
              command: pkg,
              description: 'Installed dependency',
              score: 80,
            }))
          );
          break;
      }
    }

    return completions;
  }

  private async getCachedCompletions(
    input: string
  ): Promise<Completion[] | null> {
    const cached = await this.redis.hget(this.COMPLETIONS_CACHE_KEY, input);
    return cached ? JSON.parse(cached) : null;
  }

  private async cacheCompletions(
    input: string,
    completions: Completion[]
  ): Promise<void> {
    await this.redis.hset(
      this.COMPLETIONS_CACHE_KEY,
      input,
      JSON.stringify(completions)
    );
    await this.redis.expire(this.COMPLETIONS_CACHE_KEY, this.CACHE_TTL);
  }
}

export default new CommandCompletionService();
