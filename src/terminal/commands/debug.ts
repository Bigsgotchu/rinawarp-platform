import { AIBaseCommand } from './ai-base';
import { CommandContext } from '../command';
import { CommandResult } from '../types';
import { AIMessage, AIFunction } from '../../ai/types';
import { DebugSession, DebugContext, DebugSolution } from '../debug/session';

export class DebugCommand extends AIBaseCommand {
  private activeSession?: DebugSession;

  protected systemPrompt = `You are an expert debugger, helping users solve technical issues. Your approach should be:
- Systematic and thorough
- Clear and educational
- Interactive when needed
- Focused on root causes
- Prevention-oriented

Guide users through the debugging process step by step.`;

  protected functions: AIFunction[] = [
    {
      name: 'start_debug_session',
      description: 'Start a new debug session',
      parameters: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              stack: { type: 'string' },
              code: { type: 'string' },
            },
            required: ['message'],
          },
          environment: {
            type: 'object',
            properties: {
              os: { type: 'string' },
              runtime: { type: 'string' },
              version: { type: 'string' },
            },
          },
        },
        required: ['error'],
      },
    },
    {
      name: 'show_solutions',
      description: 'Show current debug solutions',
      parameters: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['brief', 'detailed'],
            description: 'Output format',
          },
        },
      },
    },
    {
      name: 'execute_step',
      description: 'Execute a debug step',
      parameters: {
        type: 'object',
        properties: {
          step: {
            type: 'string',
            description: 'Step to execute',
          },
        },
        required: ['step'],
      },
    },
  ];

  constructor(context: CommandContext) {
    super(
      {
        name: 'debug',
        description: 'Interactive AI-powered debugging assistant',
        category: 'ai',
        usage: 'debug <error_message|command>',
        examples: [
          'debug "Error: Cannot find module \'express\'"',
          'debug "git push" failed with error 128',
          'debug why is my server connection timing out',
        ],
      },
      context
    );
  }

  protected async handleFunctionCall(
    functionCall: AIMessage['functionCall']
  ): Promise<CommandResult> {
    if (!functionCall) return { output: '', exitCode: 1 };

    const { name, arguments: args } = functionCall;
    const parsedArgs = JSON.parse(args);

    switch (name) {
      case 'start_debug_session': {
        // End any existing session
        if (this.activeSession) {
          await this.activeSession.end();
        }

        // Create debug context
        const context: DebugContext = {
          error: parsedArgs.error,
          environment: parsedArgs.environment || {
            os: process.platform,
            runtime: process.version,
          },
          history: [],
        };

        // Start new session
        this.activeSession = new DebugSession(context);
        this.setupSessionListeners();
        await this.activeSession.start();

        // Format initial output
        let output = '## Debug Session Started\n\n';
        output += `Error: ${context.error.message}\n`;
        if (context.error.stack) {
          output += `\nStack Trace:\n${context.error.stack}\n`;
        }
        output += '\nAnalyzing error...\n';

        return {
          output,
          exitCode: 0,
          metadata: {
            sessionId: this.activeSession.getSteps()[0]?.id,
          },
        };
      }

      case 'show_solutions': {
        if (!this.activeSession) {
          return {
            output: 'No active debug session. Start one with: debug <error>',
            exitCode: 1,
          };
        }

        const solutions = this.activeSession.getSolutions();
        const output = this.formatSolutions(solutions, parsedArgs.format);

        return {
          output,
          exitCode: 0,
          metadata: {
            solutionCount: solutions.length,
            format: parsedArgs.format,
          },
        };
      }

      case 'execute_step': {
        if (!this.activeSession) {
          return {
            output: 'No active debug session. Start one with: debug <error>',
            exitCode: 1,
          };
        }

        const step = await this.activeSession.executeStep(parsedArgs.step);

        return {
          output: step.result,
          exitCode: step.success ? 0 : 1,
          metadata: {
            stepId: step.id,
            success: step.success,
          },
        };
      }

      default:
        return {
          output: `Unknown function: ${name}`,
          exitCode: 1,
        };
    }
  }

  private setupSessionListeners(): void {
    if (!this.activeSession) return;

    this.activeSession.on('error', error => {
      console.error('Debug session error:', error);
    });

    this.activeSession.on('step', step => {
      console.log(`Debug step ${step.id}:`, step.action);
    });

    this.activeSession.on('solutions', solutions => {
      console.log('New solutions available:', solutions.length);
    });

    this.activeSession.on('end', result => {
      console.log('Debug session ended with', result.steps.length, 'steps');
    });
  }

  private formatSolutions(
    solutions: DebugSolution[],
    format: string = 'brief'
  ): string {
    if (solutions.length === 0) {
      return 'No solutions found yet. Still analyzing...\n';
    }

    let output = '## Potential Solutions\n\n';

    solutions.forEach((solution, index) => {
      output += `### Solution ${index + 1} `;
      output += `(${Math.round(solution.confidence * 100)}% confidence)\n\n`;
      output += `${solution.description}\n\n`;

      if (format === 'detailed') {
        output += 'Steps:\n';
        solution.steps.forEach((step, stepIndex) => {
          output += `${stepIndex + 1}. ${step}\n`;
        });
        output += '\n';

        if (solution.code) {
          output += 'Code Changes:\n';
          output += '```\n';
          output += solution.code;
          output += '\n```\n\n';
        }
      }
    });

    return output;
  }
}

export default new DebugCommand({
  cwd: process.cwd(),
  env: process.env,
  user: {
    id: 'default',
    subscription: {
      planId: 'pro',
      features: ['ai_assistant'],
    },
  },
});
