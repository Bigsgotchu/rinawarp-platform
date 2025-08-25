import { Command, CommandContext, CommandMetadata } from '../command';
import { TerminalCommand, CommandResult } from '../types';
import UsageTrackingService from '../../services/usage';
import AnalyticsService from '../../services/analytics';

export abstract class BaseCommand extends Command {
  constructor(metadata: CommandMetadata, context: CommandContext) {
    super(metadata, context);
  }

  public async execute(command: TerminalCommand): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // Track command execution
      UsageTrackingService.getInstance().trackUsage(
        `command.${this.metadata.name}`,
        1,
        {
          args: command.args.length,
          category: this.metadata.category,
        }
      );

      // Track analytics
      AnalyticsService.getInstance().trackEvent(
        `command.${this.metadata.name}`,
        {
          args: command.args,
          category: this.metadata.category,
          timestamp: startTime,
        }
      );

      // Execute command
      const result = await this.executeCommand(command);

      // Calculate duration
      const duration = Date.now() - startTime;

      return {
        ...result,
        duration,
        metadata: {
          ...result.metadata,
          command: this.metadata.name,
          category: this.metadata.category,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        output: error.message,
        exitCode: 1,
        error,
        duration,
        metadata: {
          command: this.metadata.name,
          category: this.metadata.category,
        },
      };
    }
  }

  protected abstract executeCommand(
    command: TerminalCommand
  ): Promise<CommandResult>;
}
