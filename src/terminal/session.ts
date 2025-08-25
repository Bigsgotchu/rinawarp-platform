import { EventEmitter } from 'events';
import {
  TerminalSize,
  TerminalOptions,
  TerminalState,
  TerminalMode,
  TerminalCommand,
  CommandResult,
  TerminalEvent,
  TerminalEventType,
  TerminalProfile,
} from './types';
import UsageTrackingService from '../services/usage';
import AnalyticsService from '../services/analytics';
import logger from '../utils/logger';

export class TerminalSession extends EventEmitter {
  private static instance: TerminalSession;
  private state: TerminalState;
  private profile: TerminalProfile;
  private readonly options: Required<TerminalOptions>;
  private commandBuffer = '';
  private isExecuting = false;

  private constructor(options: TerminalOptions = {}) {
    super();
    
    this.options = {
      initialSize: { rows: 24, cols: 80 },
      historySize: 1000,
      tabWidth: 8,
      scrollback: 1000,
      env: {},
      ...options,
    };

    this.state = {
      cursorX: 0,
      cursorY: 0,
      size: this.options.initialSize,
      buffer: [],
      history: [],
      historyIndex: -1,
      mode: TerminalMode.NORMAL,
    };

    this.profile = this.getDefaultProfile();
    this.setupEventHandlers();
  }

  public static getInstance(options?: TerminalOptions): TerminalSession {
    if (!TerminalSession.instance) {
      TerminalSession.instance = new TerminalSession(options);
    }
    return TerminalSession.instance;
  }

  // Input handling
  public async handleInput(input: string): Promise<void> {
    try {
      this.emitEvent(TerminalEventType.INPUT, input);

      switch (this.state.mode) {
        case TerminalMode.NORMAL:
          await this.handleNormalModeInput(input);
          break;
        case TerminalMode.INSERT:
          this.handleInsertModeInput(input);
          break;
        case TerminalMode.SEARCH:
          this.handleSearchModeInput(input);
          break;
        case TerminalMode.SELECT:
          this.handleSelectModeInput(input);
          break;
      }
    } catch (error) {
      logger.error('Failed to handle input:', error);
      this.emitEvent(TerminalEventType.ERROR, error);
    }
  }

  // Command execution
  public async executeCommand(command: string): Promise<CommandResult> {
    if (this.isExecuting) {
      throw new Error('Command already executing');
    }

    try {
      this.isExecuting = true;
      const startTime = Date.now();

      // Parse command
      const parsed = this.parseCommand(command);
      
      // Track command execution
      UsageTrackingService.getInstance().trackUsage('command.execute', 1, {
        command: parsed.command,
        args: parsed.args.length,
      });

      // Track analytics
      AnalyticsService.getInstance().trackEvent('command.execute', {
        command: parsed.command,
        args: parsed.args,
        timestamp: startTime,
      });

      // Execute command (implement actual execution logic)
      const result = await this.executeCommandInternal(parsed);
      
      // Update history
      this.updateHistory(command);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Create result
      const commandResult: CommandResult = {
        output: result,
        exitCode: 0,
        duration,
        metadata: {
          command: parsed.command,
          args: parsed.args,
        },
      };

      // Emit event
      this.emitEvent(TerminalEventType.COMMAND, commandResult);

      return commandResult;
    } catch (error) {
      logger.error('Command execution failed:', error);
      
      const result: CommandResult = {
        output: error.message,
        exitCode: 1,
        error,
        duration: Date.now() - startTime,
      };

      this.emitEvent(TerminalEventType.ERROR, result);
      return result;
    } finally {
      this.isExecuting = false;
    }
  }

  // Terminal operations
  public clear(): void {
    this.state.buffer = [];
    this.state.cursorX = 0;
    this.state.cursorY = 0;
    this.emitEvent(TerminalEventType.CLEAR, null);
  }

  public resize(size: TerminalSize): void {
    this.state.size = size;
    this.emitEvent(TerminalEventType.RESIZE, size);
  }

  public setMode(mode: TerminalMode): void {
    this.state.mode = mode;
    this.emitEvent(TerminalEventType.MODE_CHANGE, mode);
  }

  public write(data: string): void {
    // Split into lines
    const lines = data.split('\n');
    
    // Update buffer
    for (const line of lines) {
      if (this.state.cursorY >= this.state.buffer.length) {
        this.state.buffer.push('');
      }
      
      const currentLine = this.state.buffer[this.state.cursorY];
      const newLine = 
        currentLine.slice(0, this.state.cursorX) +
        line +
        currentLine.slice(this.state.cursorX);
      
      this.state.buffer[this.state.cursorY] = newLine;
      this.state.cursorX += line.length;
      
      // Move to next line if not last line
      if (lines.indexOf(line) < lines.length - 1) {
        this.state.cursorY++;
        this.state.cursorX = 0;
      }
    }

    this.emitEvent(TerminalEventType.OUTPUT, data);
  }

  // State management
  public getState(): TerminalState {
    return { ...this.state };
  }

  public getProfile(): TerminalProfile {
    return { ...this.profile };
  }

  public setProfile(profile: Partial<TerminalProfile>): void {
    this.profile = {
      ...this.profile,
      ...profile,
    };
  }

  // Private methods
  private setupEventHandlers(): void {
    // Add any event handlers here
  }

  private async handleNormalModeInput(input: string): Promise<void> {
    if (input === '\r' || input === '\n') {
      const command = this.commandBuffer.trim();
      if (command) {
        await this.executeCommand(command);
        this.commandBuffer = '';
      }
    } else if (input === '\b' || input === '\x7f') {
      // Backspace
      this.commandBuffer = this.commandBuffer.slice(0, -1);
    } else {
      this.commandBuffer += input;
    }
  }

  private handleInsertModeInput(input: string): void {
    // Implement insert mode input handling
  }

  private handleSearchModeInput(input: string): void {
    // Implement search mode input handling
  }

  private handleSelectModeInput(input: string): void {
    // Implement select mode input handling
  }

  private parseCommand(raw: string): TerminalCommand {
    const parts = raw.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    const options = {}; // Parse options from args

    return {
      command,
      args,
      options,
      raw,
      timestamp: Date.now(),
    };
  }

  private async executeCommandInternal(command: TerminalCommand): Promise<string> {
    // Implement actual command execution here
    return `Executed: ${command.raw}`;
  }

  private updateHistory(command: string): void {
    if (command && command !== this.state.history[this.state.history.length - 1]) {
      this.state.history.push(command);
      if (this.state.history.length > this.options.historySize) {
        this.state.history.shift();
      }
    }
    this.state.historyIndex = this.state.history.length;
  }

  private emitEvent(type: TerminalEventType, data: any): void {
    const event: TerminalEvent = {
      type,
      data,
      timestamp: Date.now(),
    };
    this.emit('event', event);
    this.emit(type, data);
  }

  private getDefaultProfile(): TerminalProfile {
    return {
      id: 'default',
      name: 'Default',
      theme: {
        background: '#282c34',
        foreground: '#abb2bf',
        cursor: '#528bff',
        selection: '#3e4451',
        black: '#282c34',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
      font: 'Menlo',
      fontSize: 14,
      lineHeight: 1.5,
      padding: 8,
      cursorStyle: 'block',
      cursorBlink: true,
      scrollback: this.options.scrollback,
      env: this.options.env,
    };
  }
}

export default TerminalSession.getInstance();
