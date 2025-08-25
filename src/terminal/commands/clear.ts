import { BaseCommand } from './base';
import { CommandContext } from '../command';
import { TerminalCommand, CommandResult } from '../types';
import TerminalSession from '../session';

export class ClearCommand extends BaseCommand {
  constructor(context: CommandContext) {
    super(
      {
        name: 'clear',
        description: 'Clear the terminal screen',
        category: 'system',
        usage: 'clear',
        examples: ['clear'],
      },
      context
    );
  }

  protected async executeCommand(
    command: TerminalCommand
  ): Promise<CommandResult> {
    TerminalSession.getInstance().clear();
    
    return {
      output: '',
      exitCode: 0,
    };
  }
}
