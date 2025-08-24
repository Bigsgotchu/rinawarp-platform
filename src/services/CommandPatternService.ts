import Redis from 'ioredis';
import { Command, CommandResult } from '../types';
import logger from '../utils/logger';

interface CommandPattern {
  pattern: string;
  frequency: number;
  successRate: number;
  avgImpact: number;
  commonPrecursors: string[];
  commonFollowUps: string[];
  peakUsageTimes: number[];
  systemStates: SystemState[];
}

interface SystemState {
  cpuLoad: number;
  memoryUsage: number;
  diskIO: number;
  timestamp: Date;
}

interface WorkflowPattern {
  commands: string[];
  frequency: number;
  successRate: number;
  averageDuration: number;
  commonContexts: string[];
}

class CommandPatternService {
  private redis: Redis;
  private readonly PATTERN_KEY = 'global_command_patterns';
  private readonly WORKFLOW_KEY = 'command_workflows';
  private readonly IMPACT_KEY = 'command_impacts';
  private readonly MAX_PATTERNS = 10000;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async recordCommandExecution(
    command: Command,
    result: CommandResult,
    systemState: SystemState
  ): Promise<void> {
    try {
      const pattern = this.normalizeCommand(command);
      const patternKey = `${this.PATTERN_KEY}:${pattern}`;

      // Update pattern statistics
      const existingPattern = await this.getCommandPattern(pattern);
      const updatedPattern = this.updatePatternStats(
        existingPattern,
        result,
        systemState
      );

      // Store updated pattern
      await this.redis.hset(
        patternKey,
        'data',
        JSON.stringify(updatedPattern)
      );

      // Update workflow patterns
      await this.updateWorkflowPatterns(command, result);

      // Update impact analysis
      await this.updateImpactAnalysis(command, systemState);

      // Prune old patterns if needed
      await this.prunePatterns();
    } catch (error) {
      logger.error('Failed to record command pattern:', error);
    }
  }

  async predictNextCommands(
    recentCommands: string[],
    currentState: SystemState
  ): Promise<string[]> {
    try {
      const predictions: { command: string; score: number }[] = [];
      const patterns = await this.getAllPatterns();

      for (const pattern of patterns) {
        const score = this.calculatePredictionScore(
          pattern,
          recentCommands,
          currentState
        );
        predictions.push({ command: pattern.pattern, score });
      }

      // Sort by score and return top 5
      return predictions
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(p => p.command);
    } catch (error) {
      logger.error('Failed to predict next commands:', error);
      return [];
    }
  }

  async detectWorkflow(commands: string[]): Promise<WorkflowPattern[]> {
    try {
      const workflows = await this.redis.hgetall(this.WORKFLOW_KEY);
      const matches: WorkflowPattern[] = [];

      for (const [key, value] of Object.entries(workflows)) {
        const workflow: WorkflowPattern = JSON.parse(value);
        const similarity = this.calculateWorkflowSimilarity(
          commands,
          workflow.commands
        );

        if (similarity > 0.7) {
          matches.push(workflow);
        }
      }

      return matches.sort((a, b) => b.frequency - a.frequency).slice(0, 3);
    } catch (error) {
      logger.error('Failed to detect workflow:', error);
      return [];
    }
  }

  async suggestCommandTiming(
    command: Command,
    currentState: SystemState
  ): Promise<{ shouldWait: boolean; reason: string }> {
    try {
      const pattern = await this.getCommandPattern(
        this.normalizeCommand(command)
      );
      
      if (!pattern) {
        return { shouldWait: false, reason: 'No historical data available' };
      }

      // Check system state thresholds
      const highLoad = currentState.cpuLoad > 80;
      const highMemory = currentState.memoryUsage > 90;
      const highIO = currentState.diskIO > 70;

      if (highLoad || highMemory || highIO) {
        return {
          shouldWait: true,
          reason: `System resources are constrained (CPU: ${currentState.cpuLoad}%, Memory: ${currentState.memoryUsage}%, IO: ${currentState.diskIO}%)`
        };
      }

      // Check if current time is optimal
      const currentHour = new Date().getHours();
      const isOptimalTime = pattern.peakUsageTimes.includes(currentHour);

      return {
        shouldWait: !isOptimalTime,
        reason: isOptimalTime
          ? 'Current time is optimal for this command'
          : `Command typically performs better during hours: ${pattern.peakUsageTimes.join(', ')}`
      };
    } catch (error) {
      logger.error('Failed to suggest command timing:', error);
      return { shouldWait: false, reason: 'Unable to analyze timing' };
    }
  }

  async predictCommandImpact(
    command: Command,
    currentState: SystemState
  ): Promise<{
    cpuImpact: number;
    memoryImpact: number;
    ioImpact: number;
    duration: number;
    confidence: number;
  }> {
    try {
      const pattern = await this.getCommandPattern(
        this.normalizeCommand(command)
      );

      if (!pattern) {
        return {
          cpuImpact: 0,
          memoryImpact: 0,
          ioImpact: 0,
          duration: 0,
          confidence: 0
        };
      }

      // Calculate average impact from historical data
      const impacts = pattern.systemStates.map(state => ({
        cpu: state.cpuLoad - currentState.cpuLoad,
        memory: state.memoryUsage - currentState.memoryUsage,
        io: state.diskIO - currentState.diskIO
      }));

      const avgImpact = {
        cpu: this.average(impacts.map(i => i.cpu)),
        memory: this.average(impacts.map(i => i.memory)),
        io: this.average(impacts.map(i => i.io))
      };

      // Calculate confidence based on sample size and consistency
      const confidence = Math.min(
        pattern.frequency / 100,
        this.calculateStandardDeviation(impacts.map(i => i.cpu)) < 20 ? 1 : 0.5
      );

      return {
        cpuImpact: avgImpact.cpu,
        memoryImpact: avgImpact.memory,
        ioImpact: avgImpact.io,
        duration: pattern.avgImpact,
        confidence
      };
    } catch (error) {
      logger.error('Failed to predict command impact:', error);
      return {
        cpuImpact: 0,
        memoryImpact: 0,
        ioImpact: 0,
        duration: 0,
        confidence: 0
      };
    }
  }

  private normalizeCommand(command: Command): string {
    // Replace specific values with placeholders
    const args = command.args?.map(arg => {
      if (arg.match(/^[0-9]+$/)) return '<number>';
      if (arg.match(/^[a-zA-Z0-9]{32,}$/)) return '<hash>';
      if (arg.startsWith('/')) return '<path>';
      if (arg.includes('@')) return '<email>';
      return arg;
    }) || [];

    return `${command.command} ${args.join(' ')}`.trim();
  }

  private async getCommandPattern(pattern: string): Promise<CommandPattern | null> {
    const data = await this.redis.hget(
      `${this.PATTERN_KEY}:${pattern}`,
      'data'
    );
    return data ? JSON.parse(data) : null;
  }

  private async getAllPatterns(): Promise<CommandPattern[]> {
    const keys = await this.redis.keys(`${this.PATTERN_KEY}:*`);
    const patterns: CommandPattern[] = [];

    for (const key of keys) {
      const data = await this.redis.hget(key, 'data');
      if (data) {
        patterns.push(JSON.parse(data));
      }
    }

    return patterns;
  }

  private updatePatternStats(
    existing: CommandPattern | null,
    result: CommandResult,
    state: SystemState
  ): CommandPattern {
    if (!existing) {
      return {
        pattern: '',
        frequency: 1,
        successRate: result.exitCode === 0 ? 1 : 0,
        avgImpact: 0,
        commonPrecursors: [],
        commonFollowUps: [],
        peakUsageTimes: [new Date().getHours()],
        systemStates: [state]
      };
    }

    const success = result.exitCode === 0;
    return {
      ...existing,
      frequency: existing.frequency + 1,
      successRate:
        (existing.successRate * existing.frequency + (success ? 1 : 0)) /
        (existing.frequency + 1),
      systemStates: [...existing.systemStates, state].slice(-100),
      peakUsageTimes: this.updatePeakTimes(
        existing.peakUsageTimes,
        new Date().getHours()
      )
    };
  }

  private async updateWorkflowPatterns(
    command: Command,
    result: CommandResult
  ): Promise<void> {
    // Implementation details for workflow pattern updates
  }

  private async updateImpactAnalysis(
    command: Command,
    state: SystemState
  ): Promise<void> {
    // Implementation details for impact analysis updates
  }

  private async prunePatterns(): Promise<void> {
    const keys = await this.redis.keys(`${this.PATTERN_KEY}:*`);
    if (keys.length > this.MAX_PATTERNS) {
      // Remove oldest/least used patterns
      const patterns = await Promise.all(
        keys.map(async key => {
          const data = await this.redis.hget(key, 'data');
          return { key, data: data ? JSON.parse(data) : null };
        })
      );

      const toRemove = patterns
        .sort((a, b) => (a.data?.frequency || 0) - (b.data?.frequency || 0))
        .slice(0, keys.length - this.MAX_PATTERNS)
        .map(p => p.key);

      await this.redis.del(...toRemove);
    }
  }

  private calculatePredictionScore(
    pattern: CommandPattern,
    recentCommands: string[],
    currentState: SystemState
  ): number {
    let score = 0;

    // Frequency score
    score += Math.log10(pattern.frequency);

    // Success rate score
    score += pattern.successRate * 2;

    // Precursor match score
    const precursorMatch = pattern.commonPrecursors.some(p =>
      recentCommands.includes(p)
    );
    if (precursorMatch) score += 1;

    // Time-of-day score
    const currentHour = new Date().getHours();
    if (pattern.peakUsageTimes.includes(currentHour)) score += 0.5;

    // System state similarity score
    const stateSimilarity = this.calculateStateSimilarity(
      currentState,
      pattern.systemStates[pattern.systemStates.length - 1]
    );
    score += stateSimilarity;

    return score;
  }

  private calculateWorkflowSimilarity(
    commands1: string[],
    commands2: string[]
  ): number {
    const set1 = new Set(commands1);
    const set2 = new Set(commands2);
    const intersection = new Set(
      [...set1].filter(x => set2.has(x))
    );
    return intersection.size / Math.max(set1.size, set2.size);
  }

  private calculateStateSimilarity(
    state1: SystemState,
    state2: SystemState
  ): number {
    const cpuDiff = Math.abs(state1.cpuLoad - state2.cpuLoad) / 100;
    const memDiff = Math.abs(state1.memoryUsage - state2.memoryUsage) / 100;
    const ioDiff = Math.abs(state1.diskIO - state2.diskIO) / 100;
    return 1 - (cpuDiff + memDiff + ioDiff) / 3;
  }

  private updatePeakTimes(existing: number[], newHour: number): number[] {
    const hourCounts = new Map<number, number>();
    [...existing, newHour].forEach(h => {
      hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
    });
    return Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour]) => hour);
  }

  private average(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private calculateStandardDeviation(numbers: number[]): number {
    const avg = this.average(numbers);
    const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
    return Math.sqrt(this.average(squareDiffs));
  }
}

export default new CommandPatternService();
