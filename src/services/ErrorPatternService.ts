import CommandPatternService from './CommandPatternService';
import AIService from './AIService';
import HistoryService from './HistoryService';
import logger from '../utils/logger';

interface ErrorPattern {
  id: string;
  commandPattern: string;
  errorPattern: string;
  frequency: number;
  recoveryActions: {
    command: string;
    successRate: number;
  }[];
  context: {
    operatingSystem?: string;
    projectType?: string;
    dependencies?: string[];
  };
}

interface ErrorContext {
  recentCommands: string[];
  projectContext: any;
  systemState: any;
}

class ErrorPatternService {
  private readonly errorPatterns = new Map<string, ErrorPattern>();
  private readonly ERROR_HISTORY_LIMIT = 50;

  async analyzeError(
    command: string,
    error: string,
    context: ErrorContext
  ): Promise<any> {
    try {
      // Get AI analysis of the error
      const aiAnalysis = await AIService.analyzeError(
        { command },
        error,
        context,
        'system'
      );

      // Find similar patterns
      const similarPatterns = await this.findSimilarErrors(command, error);
      
      // Generate recovery suggestions
      const suggestions = await this.generateRecoverySuggestions(
        command,
        error,
        context,
        similarPatterns
      );

      // Update error patterns
      await this.updateErrorPatterns(command, error, context);

      return {
        analysis: aiAnalysis,
        similarPatterns,
        suggestions,
      };
    } catch (error) {
      logger.error('Failed to analyze error:', error);
      throw error;
    }
  }

  private async findSimilarErrors(
    command: string,
    error: string
  ): Promise<ErrorPattern[]> {
    const patterns: ErrorPattern[] = [];

    for (const pattern of this.errorPatterns.values()) {
      // Match command pattern
      if (this.matchesCommandPattern(command, pattern.commandPattern)) {
        // Match error pattern
        if (this.matchesErrorPattern(error, pattern.errorPattern)) {
          patterns.push(pattern);
        }
      }
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  private async generateRecoverySuggestions(
    command: string,
    error: string,
    context: ErrorContext,
    similarPatterns: ErrorPattern[]
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Add suggestions from similar patterns
    for (const pattern of similarPatterns) {
      suggestions.push(
        ...pattern.recoveryActions
          .sort((a, b) => b.successRate - a.successRate)
          .map(action => action.command)
      );
    }

    // Add AI-generated suggestions
    const aiSuggestions = await AIService.suggestRecovery(
      { command },
      error,
      context,
      'system'
    );

    suggestions.push(...aiSuggestions.map(s => s.command));

    // Deduplicate and return top suggestions
    return Array.from(new Set(suggestions)).slice(0, 5);
  }

  async recordRecoveryAttempt(
    originalCommand: string,
    error: string,
    recoveryCommand: string,
    success: boolean
  ): Promise<void> {
    try {
      // Find matching pattern
      const patterns = await this.findSimilarErrors(originalCommand, error);
      const pattern = patterns[0];

      if (pattern) {
        // Update recovery action success rate
        const action = pattern.recoveryActions.find(
          a => a.command === recoveryCommand
        );

        if (action) {
          // Update existing action success rate
          const totalAttempts = pattern.frequency;
          action.successRate =
            (action.successRate * (totalAttempts - 1) + (success ? 1 : 0)) /
            totalAttempts;
        } else {
          // Add new recovery action
          pattern.recoveryActions.push({
            command: recoveryCommand,
            successRate: success ? 1 : 0,
          });
        }

        this.errorPatterns.set(pattern.id, pattern);
      }
    } catch (error) {
      logger.error('Failed to record recovery attempt:', error);
    }
  }

  private async updateErrorPatterns(
    command: string,
    error: string,
    context: ErrorContext
  ): Promise<void> {
    try {
      // Find or create pattern
      const patterns = await this.findSimilarErrors(command, error);
      let pattern = patterns[0];

      if (!pattern) {
        // Create new pattern
        pattern = {
          id: Math.random().toString(36).substring(7),
          commandPattern: this.generateCommandPattern(command),
          errorPattern: this.generateErrorPattern(error),
          frequency: 0,
          recoveryActions: [],
          context: {
            operatingSystem: process.platform,
            projectType: context.projectContext?.type,
            dependencies: context.projectContext?.dependencies,
          },
        };
      }

      // Update frequency
      pattern.frequency++;

      // Store pattern
      this.errorPatterns.set(pattern.id, pattern);

      // Cleanup old patterns if needed
      if (this.errorPatterns.size > this.ERROR_HISTORY_LIMIT) {
        this.cleanupOldPatterns();
      }
    } catch (error) {
      logger.error('Failed to update error patterns:', error);
    }
  }

  private generateCommandPattern(command: string): string {
    // TODO: Implement more sophisticated pattern generation
    return command.split(' ')[0];
  }

  private generateErrorPattern(error: string): string {
    // TODO: Implement more sophisticated error pattern generation
    return error.split('\n')[0];
  }

  private matchesCommandPattern(command: string, pattern: string): boolean {
    return command.startsWith(pattern);
  }

  private matchesErrorPattern(error: string, pattern: string): boolean {
    return error.includes(pattern);
  }

  private cleanupOldPatterns(): void {
    // Remove least frequent patterns
    const patterns = Array.from(this.errorPatterns.entries())
      .sort(([, a], [, b]) => b.frequency - a.frequency)
      .slice(0, this.ERROR_HISTORY_LIMIT);

    this.errorPatterns.clear();
    patterns.forEach(([id, pattern]) => {
      this.errorPatterns.set(id, pattern);
    });
  }

  async getErrorStats(): Promise<any> {
    const stats = {
      totalErrors: this.errorPatterns.size,
      commonPatterns: [] as any[],
      recoveryStats: {
        totalAttempts: 0,
        successfulRecoveries: 0,
      },
    };

    // Get most common patterns
    stats.commonPatterns = Array.from(this.errorPatterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map(pattern => ({
        commandPattern: pattern.commandPattern,
        frequency: pattern.frequency,
        topRecoveryActions: pattern.recoveryActions
          .sort((a, b) => b.successRate - a.successRate)
          .slice(0, 3),
      }));

    // Calculate recovery stats
    for (const pattern of this.errorPatterns.values()) {
      for (const action of pattern.recoveryActions) {
        stats.recoveryStats.totalAttempts += pattern.frequency;
        stats.recoveryStats.successfulRecoveries +=
          pattern.frequency * action.successRate;
      }
    }

    return stats;
  }
}

export default new ErrorPatternService();
