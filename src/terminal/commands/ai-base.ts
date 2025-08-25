import { BaseCommand } from './base';
import { CommandContext, CommandMetadata } from '../command';
import { TerminalCommand, CommandResult } from '../types';
import AIService from '../../ai/service';
import { AIFunction, AIMessage } from '../../ai/types';

export abstract class AIBaseCommand extends BaseCommand {
  protected abstract systemPrompt: string;
  protected abstract functions: AIFunction[];

  constructor(metadata: CommandMetadata, context: CommandContext) {
    super(
      {
        ...metadata,
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
    if (command.args.length === 0) {
      return {
        output: `Please provide input for the ${this.metadata.name} command.`,
        exitCode: 1,
      };
    }

    try {
      // Create system message
      const systemMessage: AIMessage = {
        role: 'system',
        content: this.systemPrompt,
      };

      // Get current context and add system message
      const context = AIService.getInstance().getContext();
      context.messages = [systemMessage, ...context.messages];

      // Add functions if available
      if (this.functions?.length) {
        context.functions = this.functions;
      }

      // Get AI response
      const response = await AIService.getInstance().chat(
        command.args.join(' '),
        this.functions,
        context
      );

      // Handle function calls if present
      if (response.message.functionCall) {
        return this.handleFunctionCall(response.message.functionCall);
      }

      // Get any suggestions
      const suggestions = await AIService.getInstance().getSuggestions(
        command.args.join(' ')
      );

      // Format output
      let output = response.message.content;

      if (suggestions.length > 0) {
        output += '\n\nSuggested actions:\n';
        output += suggestions
          .map(
            (s) =>
              `${s.command} ${s.args.join(' ')}\n  ${s.description}`
          )
          .join('\n\n');
      }

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

  protected abstract handleFunctionCall(functionCall: AIMessage['functionCall']): Promise<CommandResult>;
}
