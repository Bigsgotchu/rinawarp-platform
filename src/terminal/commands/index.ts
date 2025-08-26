export * from './base';
export * from './ai-base';
export * from './help';
export * from './clear';
export * from './ai';
export * from './explain';
export * from './optimize';

// Register all commands
import { CommandRegistry } from '../command';
import { HelpCommand } from './help';
import { ClearCommand } from './clear';
import { AICommand } from './ai';
import { ExplainCommand } from './explain';
import { OptimizeCommand } from './optimize';

export function registerCommands(context: any): void {
  const registry = CommandRegistry.getInstance();

  // System commands
  registry.register(new HelpCommand(context));
  registry.register(new ClearCommand(context));

  // AI commands
  registry.register(new AICommand(context));
  registry.register(new ExplainCommand(context));
  registry.register(new OptimizeCommand(context));

  // Register aliases
  registry.registerAlias('?', 'help');
  registry.registerAlias('cls', 'clear');
}
