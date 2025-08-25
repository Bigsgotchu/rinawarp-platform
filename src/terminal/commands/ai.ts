import { BaseCommand } from './base';
import { CommandContext } from '../command';
import { TerminalCommand, CommandResult } from '../types';
import AIService from '../../ai/service';
import { AIFunction } from '../../ai/types';

export class AICommand extends BaseCommand {
  private readonly functions: AIFunction[] = [
    {
      name: 'execute_command',
      description: 'Execute a shell command',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute',
          },
          args: {
            type: 'array',
            description: 'Command arguments',
            items: {
              type: 'string',
            },
          },
        },
        required: ['command'],
      },
    },
    {
      name: 'get_help',
      description: 'Get help for a command',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to get help for',
          },
        },
        required: ['command'],
      },
    },
  ];

  constructor(context: CommandContext) {
    super(
      {
        name: 'ai',
        description: 'Interact with the AI assistant',
        category: 'ai',
        usage: 'ai [query]',
        examples: [
          'ai how do I list files in the current directory?',
          'ai help me optimize this git command',
          'ai explain what this error means',
        ],
        requiresAuth: true,
        requiresSubscription: true,
        requiredFeatures: ['ai_assistant'],
      },
      context
    );
  }

  protected async executeCommand(
    command: TerminalCommand
  ): Promise<CommandResult> {
    const query = command.args.join(' ');

    if (!query) {
      return {
        output: 'Please provide a query for the AI assistant.',
        exitCode: 1,
      };
    }

    try {
      // Get AI response
      const response = await AIService.getInstance().chat(
        query,
        this.functions
      );

      // Check for function call
      if (response.message.functionCall) {
        const { name, arguments: args } = response.message.functionCall;
        const parsedArgs = JSON.parse(args);

        switch (name) {
          case 'execute_command':
            // Execute command through terminal
            // This would be handled by the terminal session
            return {
              output: `Would execute: ${parsedArgs.command} ${
                parsedArgs.args?.join(' ') || ''
              }`,
              exitCode: 0,
            };

          case 'get_help':
            // Get help for command
            const help = await AIService.getInstance().getHelp(
              parsedArgs.command
            );
            return {
              output: `Help for ${parsedArgs.command}:\n\n${help.description}\n\nExamples:\n${help.examples.join(
                '\n'
              )}`,
              exitCode: 0,
            };

          default:
            return {
              output: `Unknown function: ${name}`,
              exitCode: 1,
            };
        }
      }

      // Get command suggestions
      const suggestions = await AIService.getInstance().getSuggestions(
        query
      );

      // Format response
      const output = `${response.message.content}

${
  suggestions.length > 0
    ? `\nSuggested commands:
${suggestions
  .map(
    (s) =>
      `${s.command} ${s.args.join(' ')}
  ${s.description}`
  )
  .join('\n\n')}`
    : ''
}`;

      return {
        output,
        exitCode: 0,
        metadata: {
          model: response.model.id,
          usage: response.usage,
          suggestions: suggestions.length,
        },
      };
    } catch (error) {
      return {
        output: `AI request failed: ${error.message}`,
        exitCode: 1,
        error,
      };
    }
  }
}
