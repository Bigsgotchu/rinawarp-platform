import { BaseCommand } from './base';
import { CommandContext, CommandMetadata } from '../command';
import { TerminalCommand, CommandResult } from '../types';
import CommandRegistry from '../command';

export class HelpCommand extends BaseCommand {
  constructor(context: CommandContext) {
    super(
      {
        name: 'help',
        description: 'Display help information about commands',
        category: 'system',
        usage: 'help [command]',
        examples: ['help', 'help ls', 'help ai'],
      },
      context
    );
  }

  protected async executeCommand(
    command: TerminalCommand
  ): Promise<CommandResult> {
    const registry = CommandRegistry.getInstance();
    const args = command.args;

    if (args.length === 0) {
      // Show general help
      const categories = registry.getCategories();
      const output = categories
        .map(category => {
          const commands = registry.getCommandsByCategory(category);
          return `
${category.toUpperCase()}
${commands
  .map(
    cmd =>
      `  ${cmd.getMetadata().name.padEnd(15)} ${cmd.getMetadata().description}`
  )
  .join('\n')}
`;
        })
        .join('\n');

      return {
        output: `
Available Commands:
${output}

Type 'help <command>' for more information about a command.
`.trim(),
        exitCode: 0,
      };
    } else {
      // Show help for specific command
      const commandName = args[0];
      const cmd = registry.getCommand(commandName);

      if (!cmd) {
        return {
          output: `Command not found: ${commandName}`,
          exitCode: 1,
        };
      }

      return {
        output: cmd.help(),
        exitCode: 0,
      };
    }
  }
}
