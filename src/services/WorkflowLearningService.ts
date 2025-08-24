import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { Command, CommandResult } from '../types';
import WorkspaceContextService from './WorkspaceContextService';
import AIService from './AIService';
import logger from '../utils/logger';

interface WorkflowNode {
  id: string;
  command: string;
  successRate: number;
  nextCommands: {
    [commandId: string]: {
      count: number;
      successRate: number;
    };
  };
  contexts: {
    directory?: string;
    gitBranch?: string;
    dockerContainers?: string[];
    packageManager?: string;
  }[];
}

interface WorkflowPattern {
  id: string;
  name: string;
  description: string;
  steps: {
    command: string;
    conditions?: string[];
    successRate: number;
  }[];
  frequency: number;
  lastUsed: Date;
  contexts: {
    projectType?: string;
    techStack?: string[];
    environment?: string;
  };
}

class WorkflowLearningService {
  private redis: Redis;
  private readonly WORKFLOW_GRAPH_KEY = 'workflow_graph';
  private readonly WORKFLOW_PATTERNS_KEY = 'workflow_patterns';
  private readonly COMMAND_SEQUENCE_KEY = 'command_sequences';
  private readonly MAX_SEQUENCE_LENGTH = 10;
  private readonly MIN_PATTERN_FREQUENCY = 3;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async recordCommand(
    command: Command,
    result: CommandResult,
    workspacePath?: string
  ): Promise<void> {
    try {
      // Get workspace context
      const context = workspacePath
        ? await WorkspaceContextService.getWorkspaceContext(workspacePath)
        : undefined;

      // Update command graph
      await this.updateCommandGraph(command, result, context);

      // Update current sequence
      await this.updateCommandSequence(command, result, context);

      // Detect and store new patterns
      await this.detectNewPatterns();
    } catch (error) {
      logger.error('Failed to record command for learning:', error);
    }
  }

  async suggestNextCommands(
    currentCommand: string,
    workspacePath?: string,
    limit = 5
  ): Promise<{ command: string; confidence: number }[]> {
    try {
      // Get current context
      const context = workspacePath
        ? await WorkspaceContextService.getWorkspaceContext(workspacePath)
        : undefined;

      // Get command node from graph
      const node = await this.getCommandNode(currentCommand);
      if (!node) return [];

      // Sort next commands by frequency and success rate
      const suggestions = Object.entries(node.nextCommands)
        .map(([cmd, stats]) => ({
          command: cmd,
          confidence: this.calculateConfidence(stats, node.contexts, context),
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limit);

      return suggestions;
    } catch (error) {
      logger.error('Failed to suggest next commands:', error);
      return [];
    }
  }

  async suggestWorkflow(
    command: string,
    workspacePath?: string
  ): Promise<WorkflowPattern | null> {
    try {
      // Get current context
      const context = workspacePath
        ? await WorkspaceContextService.getWorkspaceContext(workspacePath)
        : undefined;

      // Find matching patterns
      const patterns = await this.getWorkflowPatterns();
      const matchingPatterns = patterns.filter(pattern =>
        pattern.steps.some(step => step.command === command)
      );

      if (matchingPatterns.length === 0) return null;

      // Score patterns based on context similarity
      const scoredPatterns = matchingPatterns.map(pattern => ({
        pattern,
        score: this.calculatePatternScore(pattern, context),
      }));

      // Return the best matching pattern
      return scoredPatterns.sort((a, b) => b.score - a.score)[0].pattern;
    } catch (error) {
      logger.error('Failed to suggest workflow:', error);
      return null;
    }
  }

  async detectProjectType(workspacePath: string): Promise<{
    type: string;
    confidence: number;
    suggestedWorkflows: WorkflowPattern[];
  }> {
    try {
      const context = await WorkspaceContextService.getWorkspaceContext(
        workspacePath
      );

      // Detect project type based on files and dependencies
      const projectType = this.inferProjectType(context);

      // Find relevant workflow patterns
      const patterns = await this.getWorkflowPatterns();
      const relevantPatterns = patterns.filter(
        pattern => pattern.contexts.projectType === projectType.type
      );

      return {
        type: projectType.type,
        confidence: projectType.confidence,
        suggestedWorkflows: relevantPatterns,
      };
    } catch (error) {
      logger.error('Failed to detect project type:', error);
      return {
        type: 'unknown',
        confidence: 0,
        suggestedWorkflows: [],
      };
    }
  }

  private async updateCommandGraph(
    command: Command,
    result: CommandResult,
    context?: any
  ): Promise<void> {
    const commandStr = `${command.command} ${command.args?.join(' ') || ''}`.trim();
    const nodeKey = `${this.WORKFLOW_GRAPH_KEY}:${commandStr}`;

    // Get or create node
    let node = await this.getCommandNode(commandStr);
    if (!node) {
      node = {
        id: uuidv4(),
        command: commandStr,
        successRate: result.exitCode === 0 ? 1 : 0,
        nextCommands: {},
        contexts: [],
      };
    } else {
      // Update success rate
      const totalExecutions = Object.values(node.nextCommands).reduce(
        (sum, stats) => sum + stats.count,
        0
      );
      node.successRate =
        (node.successRate * totalExecutions + (result.exitCode === 0 ? 1 : 0)) /
        (totalExecutions + 1);
    }

    // Add context if available
    if (context) {
      node.contexts.push({
        directory: context.currentDirectory,
        gitBranch: context.git?.branch,
        dockerContainers: context.docker?.containers.map((c: any) => c.name),
        packageManager: context.package?.manager,
      });

      // Keep only last 100 contexts
      if (node.contexts.length > 100) {
        node.contexts = node.contexts.slice(-100);
      }
    }

    // Save updated node
    await this.redis.hset(
      this.WORKFLOW_GRAPH_KEY,
      commandStr,
      JSON.stringify(node)
    );
  }

  private async updateCommandSequence(
    command: Command,
    result: CommandResult,
    context?: any
  ): Promise<void> {
    const commandStr = `${command.command} ${command.args?.join(' ') || ''}`.trim();
    const sequence = await this.getCurrentSequence();

    // Add command to sequence
    sequence.push({
      command: commandStr,
      success: result.exitCode === 0,
      context: context
        ? {
            directory: context.currentDirectory,
            gitBranch: context.git?.branch,
            dockerContainers: context.docker?.containers.map((c: any) => c.name),
            packageManager: context.package?.manager,
          }
        : undefined,
    });

    // Keep only last N commands
    if (sequence.length > this.MAX_SEQUENCE_LENGTH) {
      sequence.shift();
    }

    // Save updated sequence
    await this.redis.set(
      this.COMMAND_SEQUENCE_KEY,
      JSON.stringify(sequence)
    );
  }

  private async detectNewPatterns(): Promise<void> {
    const sequence = await this.getCurrentSequence();
    if (sequence.length < 2) return;

    // Look for repeated command patterns
    const patterns = this.findRepeatedPatterns(sequence);

    // Store new patterns
    for (const pattern of patterns) {
      if (pattern.frequency >= this.MIN_PATTERN_FREQUENCY) {
        await this.storeWorkflowPattern(pattern);
      }
    }
  }

  private findRepeatedPatterns(
    sequence: { command: string; success: boolean; context?: any }[]
  ): WorkflowPattern[] {
    const patterns: WorkflowPattern[] = [];
    const minPatternLength = 2;
    const maxPatternLength = 5;

    // Look for patterns of different lengths
    for (let length = minPatternLength; length <= maxPatternLength; length++) {
      for (let i = 0; i <= sequence.length - length; i++) {
        const candidate = sequence.slice(i, i + length);
        const pattern = this.createPatternFromSequence(candidate);

        // Count pattern occurrences
        let count = 0;
        for (let j = 0; j <= sequence.length - length; j++) {
          const testSequence = sequence.slice(j, j + length);
          if (this.comparePatterns(pattern, testSequence)) {
            count++;
          }
        }

        if (count >= this.MIN_PATTERN_FREQUENCY) {
          pattern.frequency = count;
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  private createPatternFromSequence(
    sequence: { command: string; success: boolean; context?: any }[]
  ): WorkflowPattern {
    return {
      id: uuidv4(),
      name: `Pattern_${new Date().toISOString()}`,
      description: `Workflow pattern with ${sequence.length} steps`,
      steps: sequence.map(step => ({
        command: step.command,
        conditions: [],
        successRate: step.success ? 1 : 0,
      })),
      frequency: 0,
      lastUsed: new Date(),
      contexts: this.extractPatternContext(sequence),
    };
  }

  private comparePatterns(
    pattern: WorkflowPattern,
    sequence: { command: string; success: boolean; context?: any }[]
  ): boolean {
    if (pattern.steps.length !== sequence.length) return false;
    return pattern.steps.every(
      (step, i) => step.command === sequence[i].command
    );
  }

  private extractPatternContext(
    sequence: { command: string; success: boolean; context?: any }[]
  ): { projectType?: string; techStack?: string[]; environment?: string } {
    const contexts = sequence
      .map(step => step.context)
      .filter(Boolean);

    if (contexts.length === 0) return {};

    // Analyze contexts to determine pattern context
    const techStack = new Set<string>();
    contexts.forEach(context => {
      if (context.packageManager) techStack.add(context.packageManager);
      if (context.dockerContainers) techStack.add('docker');
      if (context.gitBranch) techStack.add('git');
    });

    return {
      projectType: this.inferProjectTypeFromContext(contexts[0]),
      techStack: Array.from(techStack),
      environment: process.env.NODE_ENV,
    };
  }

  private async storeWorkflowPattern(pattern: WorkflowPattern): Promise<void> {
    await this.redis.hset(
      this.WORKFLOW_PATTERNS_KEY,
      pattern.id,
      JSON.stringify(pattern)
    );
  }

  private async getCurrentSequence(): Promise<
    { command: string; success: boolean; context?: any }[]
  > {
    const sequence = await this.redis.get(this.COMMAND_SEQUENCE_KEY);
    return sequence ? JSON.parse(sequence) : [];
  }

  private async getCommandNode(command: string): Promise<WorkflowNode | null> {
    const node = await this.redis.hget(this.WORKFLOW_GRAPH_KEY, command);
    return node ? JSON.parse(node) : null;
  }

  private async getWorkflowPatterns(): Promise<WorkflowPattern[]> {
    const patterns = await this.redis.hgetall(this.WORKFLOW_PATTERNS_KEY);
    return Object.values(patterns).map(p => JSON.parse(p));
  }

  private calculateConfidence(
    stats: { count: number; successRate: number },
    nodeContexts: any[],
    currentContext?: any
  ): number {
    let confidence = stats.count * stats.successRate;

    if (currentContext && nodeContexts.length > 0) {
      // Add context similarity score
      const contextSimilarity = this.calculateContextSimilarity(
        nodeContexts[nodeContexts.length - 1],
        currentContext
      );
      confidence *= (1 + contextSimilarity) / 2;
    }

    return confidence;
  }

  private calculateContextSimilarity(context1: any, context2: any): number {
    let matchCount = 0;
    let totalCount = 0;

    if (context1.directory === context2.directory) matchCount++;
    totalCount++;

    if (context1.gitBranch === context2.gitBranch) matchCount++;
    totalCount++;

    if (context1.packageManager === context2.packageManager) matchCount++;
    totalCount++;

    if (context1.dockerContainers && context2.dockerContainers) {
      const intersection = context1.dockerContainers.filter((c: string) =>
        context2.dockerContainers.includes(c)
      );
      matchCount += intersection.length / Math.max(
        context1.dockerContainers.length,
        context2.dockerContainers.length
      );
      totalCount++;
    }

    return matchCount / totalCount;
  }

  private calculatePatternScore(pattern: WorkflowPattern, context?: any): number {
    if (!context) return pattern.frequency;

    let score = pattern.frequency;

    // Add context matching score
    if (pattern.contexts.projectType === this.inferProjectTypeFromContext(context)) {
      score *= 1.5;
    }

    if (pattern.contexts.techStack?.some(tech => 
      context.package?.manager === tech ||
      (tech === 'docker' && context.docker) ||
      (tech === 'git' && context.git)
    )) {
      score *= 1.3;
    }

    if (pattern.contexts.environment === process.env.NODE_ENV) {
      score *= 1.2;
    }

    return score;
  }

  private inferProjectType(context: any): { type: string; confidence: number } {
    let type = 'unknown';
    let confidence = 0;

    if (context.package?.dependencies || context.package?.devDependencies) {
      const deps = {
        ...context.package.dependencies,
        ...context.package.devDependencies,
      };

      if (deps.react) {
        type = 'react';
        confidence = 0.8;
      } else if (deps.vue) {
        type = 'vue';
        confidence = 0.8;
      } else if (deps.express) {
        type = 'node-backend';
        confidence = 0.7;
      } else if (deps['@angular/core']) {
        type = 'angular';
        confidence = 0.8;
      }
    }

    if (context.docker?.compose) {
      const services = context.docker.compose.services;
      if (services.includes('postgres') || services.includes('mysql')) {
        type = 'database';
        confidence = Math.max(confidence, 0.6);
      }
    }

    return { type, confidence };
  }

  private inferProjectTypeFromContext(context: any): string {
    return this.inferProjectType(context).type;
  }
}

export default new WorkflowLearningService();
