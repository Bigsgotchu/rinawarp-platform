import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { Command, CommandResult } from '../types';
import WorkspaceContextService from './WorkspaceContextService';
import AIService from './AIService';
import logger from '../../utils/logger';

interface ChainStep {
  id: string;
  command: Command;
  condition?: string;
  timeout?: number;
  retries?: number;
  rollback?: Command;
}

interface CommandChain {
  id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  context?: {
    workspace?: string;
    environment?: string;
    requiredTools?: string[];
  };
}

interface ChainExecution {
  chainId: string;
  status: 'running' | 'completed' | 'failed';
  currentStep: number;
  results: {
    stepId: string;
    result: CommandResult;
    retries?: number;
  }[];
  startTime: Date;
  endTime?: Date;
  error?: string;
}

class CommandChainService {
  private redis: Redis;
  private readonly CHAIN_KEY = 'command_chains';
  private readonly EXECUTION_KEY = 'chain_executions';

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async createChain(chain: Omit<CommandChain, 'id'>): Promise<CommandChain> {
    const id = uuidv4();
    const newChain: CommandChain = {
      ...chain,
      id,
      steps: chain.steps.map(step => ({
        ...step,
        id: uuidv4(),
      })),
    };

    await this.redis.hset(this.CHAIN_KEY, id, JSON.stringify(newChain));

    return newChain;
  }

  async getChain(id: string): Promise<CommandChain | null> {
    const chain = await this.redis.hget(this.CHAIN_KEY, id);
    return chain ? JSON.parse(chain) : null;
  }

  async listChains(): Promise<CommandChain[]> {
    const chains = await this.redis.hgetall(this.CHAIN_KEY);
    return Object.values(chains).map(chain => JSON.parse(chain));
  }

  async executeChain(
    chainId: string,
    workspacePath?: string
  ): Promise<ChainExecution> {
    const chain = await this.getChain(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not found`);
    }

    const execution: ChainExecution = {
      chainId,
      status: 'running',
      currentStep: 0,
      results: [],
      startTime: new Date(),
    };

    const executionId = uuidv4();
    await this.saveExecution(executionId, execution);

    try {
      // Validate workspace context if required
      if (chain.context?.workspace && workspacePath) {
        const context =
          await WorkspaceContextService.getWorkspaceContext(workspacePath);
        const validation =
          await WorkspaceContextService.validateConfiguration(workspacePath);

        // Check if all required configurations are valid
        const isValid = Object.values(validation).every(v => v);
        if (!isValid) {
          throw new Error('Workspace configuration validation failed');
        }
      }

      // Execute steps
      for (let i = 0; i < chain.steps.length; i++) {
        const step = chain.steps[i];
        execution.currentStep = i;

        // Check step condition
        if (step.condition) {
          const conditionMet = await this.evaluateCondition(
            step.condition,
            execution.results
          );
          if (!conditionMet) {
            logger.info(`Skipping step ${step.id} due to unmet condition`);
            continue;
          }
        }

        // Execute step with retries
        let result: CommandResult | null = null;
        let retries = 0;
        const maxRetries = step.retries || 0;

        do {
          try {
            result = await this.executeStep(step, workspacePath);
            break;
          } catch (error) {
            retries++;
            if (retries > maxRetries) {
              throw error;
            }
            logger.warn(
              `Retrying step ${step.id}, attempt ${retries}/${maxRetries}`
            );
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        } while (retries <= maxRetries);

        if (!result) {
          throw new Error(`Step ${step.id} failed after ${maxRetries} retries`);
        }

        execution.results.push({
          stepId: step.id,
          result,
          retries,
        });

        // Handle step failure
        if (result.exitCode !== 0) {
          if (step.rollback) {
            logger.info(`Executing rollback for step ${step.id}`);
            await this.executeStep(step.rollback, workspacePath);
          }
          throw new Error(
            `Step ${step.id} failed with exit code ${result.exitCode}`
          );
        }

        await this.saveExecution(executionId, execution);
      }

      execution.status = 'completed';
      execution.endTime = new Date();
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error.message;
      logger.error('Chain execution failed:', error);
    }

    await this.saveExecution(executionId, execution);
    return execution;
  }

  async suggestChain(
    commands: Command[],
    workspacePath?: string
  ): Promise<CommandChain> {
    try {
      // Get workspace context if available
      const context = workspacePath
        ? await WorkspaceContextService.getWorkspaceContext(workspacePath)
        : undefined;

      // Get AI suggestions for chain structure
      const chainStructure = await AIService.analyzeCommand(commands[0], {
        previousCommands: commands.slice(1).map(c => c.command),
        currentDirectory: workspacePath,
      });

      // Create chain steps with conditions and rollbacks
      const steps: ChainStep[] = commands.map(command => ({
        id: uuidv4(),
        command,
        condition: this.generateStepCondition(command, context),
        rollback: this.generateRollbackCommand(command, context),
      }));

      return {
        id: uuidv4(),
        name: `Chain_${new Date().toISOString()}`,
        description: chainStructure.suggestion,
        steps,
        context: context
          ? {
              workspace: workspacePath,
              environment: process.env.NODE_ENV,
              requiredTools: this.detectRequiredTools(commands, context),
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to suggest chain:', error);
      throw error;
    }
  }

  private async executeStep(
    step: ChainStep,
    workspacePath?: string
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const timeout = step.timeout || 30000; // Default 30s timeout
      const timer = setTimeout(() => {
        reject(new Error(`Step ${step.id} timed out after ${timeout}ms`));
      }, timeout);

      this.executeCommand(step.command, workspacePath)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeCommand(
    command: Command,
    workspacePath?: string
  ): Promise<CommandResult> {
    // This is a placeholder. In reality, you'd use your CommandService here
    return {
      output: 'Command executed',
      exitCode: 0,
    };
  }

  private async evaluateCondition(
    condition: string,
    previousResults: { stepId: string; result: CommandResult }[]
  ): Promise<boolean> {
    // Simple condition evaluation
    if (condition === 'previous_success') {
      return (
        previousResults.length === 0 ||
        previousResults[previousResults.length - 1].result.exitCode === 0
      );
    }
    if (condition === 'all_success') {
      return previousResults.every(r => r.result.exitCode === 0);
    }
    return true;
  }

  private async saveExecution(
    id: string,
    execution: ChainExecution
  ): Promise<void> {
    await this.redis.hset(this.EXECUTION_KEY, id, JSON.stringify(execution));
  }

  private generateStepCondition(
    command: Command,
    context?: any
  ): string | undefined {
    // Add logic to generate appropriate conditions based on command and context
    return 'previous_success';
  }

  private generateRollbackCommand(
    command: Command,
    context?: any
  ): Command | undefined {
    // Add logic to generate appropriate rollback commands
    return undefined;
  }

  private detectRequiredTools(commands: Command[], context?: any): string[] {
    const tools = new Set<string>();

    for (const cmd of commands) {
      const baseCommand = cmd.command.split(' ')[0];
      switch (baseCommand) {
        case 'git':
          tools.add('git');
          break;
        case 'docker':
          tools.add('docker');
          break;
        case 'npm':
        case 'yarn':
        case 'pnpm':
          tools.add('node');
          tools.add(baseCommand);
          break;
      }
    }

    return Array.from(tools);
  }
}

export default new CommandChainService();
