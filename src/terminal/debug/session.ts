import { EventEmitter } from 'events';
import AIService from '../../ai/service';
import { AIMessage, AIFunction } from '../../ai/types';
import logger from '../../utils/logger';

export interface DebugContext {
  error: {
    message: string;
    stack?: string;
    code?: string;
  };
  environment?: {
    os: string;
    runtime?: string;
    version?: string;
  };
  history?: string[];
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DebugStep {
  id: string;
  action: string;
  result: string;
  success: boolean;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface DebugSolution {
  description: string;
  steps: string[];
  code?: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export class DebugSession extends EventEmitter {
  private context: DebugContext;
  private steps: DebugStep[] = [];
  private solutions: DebugSolution[] = [];
  private isActive = false;

  private readonly debugFunctions: AIFunction[] = [
    {
      name: 'analyze_error',
      description: 'Analyze error message and stack trace',
      parameters: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message to analyze',
          },
          stack: {
            type: 'string',
            description: 'Stack trace if available',
          },
          patterns: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Identified error patterns',
          },
        },
        required: ['error'],
      },
    },
    {
      name: 'suggest_fix',
      description: 'Suggest a fix for the error',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Description of the fix',
          },
          steps: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Steps to implement the fix',
          },
          code: {
            type: 'string',
            description: 'Code changes if applicable',
          },
          confidence: {
            type: 'number',
            description: 'Confidence level (0-1)',
          },
        },
        required: ['description', 'steps', 'confidence'],
      },
    },
    {
      name: 'check_environment',
      description: 'Check environment for issues',
      parameters: {
        type: 'object',
        properties: {
          checks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                result: { type: 'string' },
                status: { type: 'string' },
              },
            },
            description: 'Environment checks performed',
          },
        },
        required: ['checks'],
      },
    },
  ];

  constructor(context: DebugContext) {
    super();
    this.context = context;
  }

  public async start(): Promise<void> {
    if (this.isActive) {
      throw new Error('Debug session already active');
    }

    try {
      this.isActive = true;
      this.emit('start', this.context);

      // Initial error analysis
      const analysis = await this.analyzeError();
      this.addStep({
        id: 'initial_analysis',
        action: 'Analyze error',
        result: analysis.message.content,
        success: true,
        metadata: {
          type: 'analysis',
        },
      });

      // Get initial solutions
      const solutions = await this.getSolutions();
      this.solutions = solutions;
      this.emit('solutions', solutions);
    } catch (error) {
      logger.error('Failed to start debug session:', error);
      this.emit('error', error);
      throw error;
    }
  }

  public async executeStep(step: string): Promise<DebugStep> {
    if (!this.isActive) {
      throw new Error('Debug session not active');
    }

    try {
      // Execute step with AI guidance
      const response = await AIService.getInstance().chat(
        `Execute debug step: ${step}\nContext: ${JSON.stringify(this.context)}`,
        this.debugFunctions
      );

      const debugStep: DebugStep = {
        id: `step_${this.steps.length + 1}`,
        action: step,
        result: response.message.content,
        success: true,
        timestamp: Date.now(),
      };

      this.addStep(debugStep);
      return debugStep;
    } catch (error) {
      const failedStep: DebugStep = {
        id: `step_${this.steps.length + 1}`,
        action: step,
        result: error.message,
        success: false,
        timestamp: Date.now(),
      };

      this.addStep(failedStep);
      throw error;
    }
  }

  public async updateContext(updates: Partial<DebugContext>): Promise<void> {
    this.context = {
      ...this.context,
      ...updates,
    };

    // Re-analyze with new context
    if (this.isActive) {
      const analysis = await this.analyzeError();
      this.addStep({
        id: `context_update_${Date.now()}`,
        action: 'Update context',
        result: analysis.message.content,
        success: true,
        metadata: {
          type: 'context_update',
        },
      });

      // Update solutions
      const solutions = await this.getSolutions();
      this.solutions = solutions;
      this.emit('solutions', solutions);
    }
  }

  public async end(): Promise<void> {
    if (!this.isActive) return;

    this.isActive = false;
    this.emit('end', {
      steps: this.steps,
      solutions: this.solutions,
    });
  }

  public getSteps(): DebugStep[] {
    return [...this.steps];
  }

  public getSolutions(): DebugSolution[] {
    return [...this.solutions];
  }

  private async analyzeError(): Promise<AIMessage> {
    return AIService.getInstance().chat(
      `Analyze this error:\n${JSON.stringify(this.context.error)}`,
      this.debugFunctions,
      {
        messages: [
          {
            role: 'system',
            content: `You are analyzing a software error. Focus on:
- Root cause analysis
- Common patterns
- Related issues
- Potential fixes
- Prevention strategies`,
          },
        ],
      }
    );
  }

  private addStep(step: DebugStep): void {
    this.steps.push(step);
    this.emit('step', step);
  }

  private async getSolutions(): Promise<DebugSolution[]> {
    const response = await AIService.getInstance().chat(
      `Suggest solutions for this error:\n${JSON.stringify(this.context.error)}`,
      [this.debugFunctions[1]], // Use suggest_fix function
      {
        messages: [
          {
            role: 'system',
            content: `You are suggesting solutions for a software error. For each solution:
- Clearly describe the approach
- List specific steps to implement
- Include code changes if relevant
- Rate your confidence level
- Consider tradeoffs and alternatives`,
          },
        ],
      }
    );

    if (response.message.functionCall) {
      const { arguments: args } = response.message.functionCall;
      const parsedArgs = JSON.parse(args);

      return [
        {
          description: parsedArgs.description,
          steps: parsedArgs.steps,
          code: parsedArgs.code,
          confidence: parsedArgs.confidence,
          metadata: {
            type: 'ai_suggested',
          },
        },
      ];
    }

    return [];
  }
}

export default DebugSession;
