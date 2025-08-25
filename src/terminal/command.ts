import { TerminalCommand, CommandResult } from './types';

export interface CommandHandler {
  execute(command: TerminalCommand): Promise<CommandResult>;
  validate?(command: TerminalCommand): Promise<void>;
  help?(): string;
  examples?(): string[];
}

export interface CommandContext {
  cwd: string;
  env: Record<string, string>;
  user?: {
    id: string;
    subscription?: {
      planId: string;
      features: string[];
    };
  };
}

export interface CommandMetadata {
  name: string;
  description: string;
  category: string;
  usage: string;
  examples: string[];
  requiresAuth?: boolean;
  requiresSubscription?: boolean;
  requiredFeatures?: string[];
  rateLimit?: {
    points: number;
    duration: number;
  };
}

export class Command implements CommandHandler {
  constructor(
    protected metadata: CommandMetadata,
    protected context: CommandContext
  ) {}

  public async execute(command: TerminalCommand): Promise<CommandResult> {
    throw new Error('Not implemented');
  }

  public async validate(command: TerminalCommand): Promise<void> {
    // Default validation
    if (this.metadata.requiresAuth && !this.context.user) {
      throw new Error('Authentication required');
    }

    if (
      this.metadata.requiresSubscription &&
      !this.context.user?.subscription
    ) {
      throw new Error('Subscription required');
    }

    if (this.metadata.requiredFeatures?.length) {
      const userFeatures = this.context.user?.subscription?.features || [];
      const missingFeatures = this.metadata.requiredFeatures.filter(
        (f) => !userFeatures.includes(f)
      );

      if (missingFeatures.length > 0) {
        throw new Error(
          `Missing required features: ${missingFeatures.join(', ')}`
        );
      }
    }
  }

  public help(): string {
    return `
Name: ${this.metadata.name}
Description: ${this.metadata.description}
Usage: ${this.metadata.usage}

Examples:
${this.metadata.examples.map((e) => `  ${e}`).join('\n')}

Category: ${this.metadata.category}
${this.metadata.requiresAuth ? 'Requires authentication' : ''}
${this.metadata.requiresSubscription ? 'Requires subscription' : ''}
${
  this.metadata.requiredFeatures?.length
    ? `Required features: ${this.metadata.requiredFeatures.join(', ')}`
    : ''
}
    `.trim();
  }

  public examples(): string[] {
    return this.metadata.examples;
  }

  protected getMetadata(): CommandMetadata {
    return this.metadata;
  }

  protected getContext(): CommandContext {
    return this.context;
  }
}

export class CommandRegistry {
  private static instance: CommandRegistry;
  private commands: Map<string, Command> = new Map();
  private aliases: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  public register(command: Command): void {
    const metadata = command.getMetadata();
    this.commands.set(metadata.name, command);
  }

  public registerAlias(alias: string, commandName: string): void {
    if (!this.commands.has(commandName)) {
      throw new Error(`Command ${commandName} not found`);
    }
    this.aliases.set(alias, commandName);
  }

  public async execute(
    command: TerminalCommand,
    context: CommandContext
  ): Promise<CommandResult> {
    const handler = this.getCommand(command.command);
    if (!handler) {
      throw new Error(`Command not found: ${command.command}`);
    }

    await handler.validate?.(command);
    return handler.execute(command);
  }

  public getCommand(name: string): Command | undefined {
    // Check for direct command
    if (this.commands.has(name)) {
      return this.commands.get(name);
    }

    // Check for alias
    const aliasedCommand = this.aliases.get(name);
    if (aliasedCommand) {
      return this.commands.get(aliasedCommand);
    }

    return undefined;
  }

  public getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  public getCommandsByCategory(category: string): Command[] {
    return this.getCommands().filter(
      (cmd) => cmd.getMetadata().category === category
    );
  }

  public getCategories(): string[] {
    return Array.from(
      new Set(this.getCommands().map((cmd) => cmd.getMetadata().category))
    );
  }

  public clear(): void {
    this.commands.clear();
    this.aliases.clear();
  }
}

export default CommandRegistry.getInstance();
