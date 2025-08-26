import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { logger } from '@rinawarp/shared';
import {
  TerminalOptions,
  TerminalState,
  TerminalCommand,
  CommandResult,
  TerminalError,
} from './types';

export class TerminalService extends EventEmitter {
  private static instance: TerminalService;
  private ptyProcess?: pty.IPty;
  private state: TerminalState;
  private commandHistory: string[] = [];
  private dataSubscription?: pty.IDisposable;
  private exitSubscription?: pty.IDisposable;

  private constructor() {
    super();
    this.state = {
      pid: 0,
      cwd: process.cwd(),
      shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
      dimensions: {
        rows: 24,
        cols: 80,
      },
    };
  }

  public static getInstance(): TerminalService {
    if (!TerminalService.instance) {
      TerminalService.instance = new TerminalService();
    }
    return TerminalService.instance;
  }

  public start(options: TerminalOptions = {}): void {
    try {
      this.ptyProcess = pty.spawn(
        options.shell || this.state.shell,
        [],
        {
          name: 'xterm-color',
          cwd: options.cwd || this.state.cwd,
          env: options.env || process.env as { [key: string]: string },
          rows: options.rows || this.state.dimensions.rows,
          cols: options.cols || this.state.dimensions.cols,
        }
      );

      this.state = {
        pid: this.ptyProcess.pid,
        cwd: options.cwd || this.state.cwd,
        shell: options.shell || this.state.shell,
        dimensions: {
          rows: options.rows || this.state.dimensions.rows,
          cols: options.cols || this.state.dimensions.cols,
        },
      };

      this.setupEventHandlers();
      logger.info(`Terminal started with PID ${this.state.pid}`);
    } catch (error) {
      logger.error('Failed to start terminal:', error);
      throw error;
    }
  }

  public resize(rows: number, cols: number): void {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows);
      this.state.dimensions = { rows, cols };
    }
  }

  public async executeCommand(cmd: TerminalCommand): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      if (!this.ptyProcess) {
        reject(new Error('Terminal not initialized'));
        return;
      }

      const startTime = Date.now();
      let output = '';
      let error: string | undefined;

      const timeout = setTimeout(() => {
        const err = new Error('Command execution timed out') as TerminalError;
        err.code = 'TIMEOUT';
        err.cmd = cmd.command;
        reject(err);
      }, cmd.timeout || 30000);

      const marker = '__CMD_DONE__:';
      let exitCode: number | null = null;

      const dataHandler = (data: string) => {
        output += data;
        const idx = output.lastIndexOf(marker);
        if (idx !== -1) {
          const after = output.slice(idx + marker.length).trim();
          const match = after.match(/^(\d+)/);
          if (match) {
            exitCode = parseInt(match[1], 10);
            cleanupAndResolve();
          }
        }
      };

      const dataSub = this.ptyProcess.onData(dataHandler);

      const cleanupAndResolve = () => {
        clearTimeout(timeout);
        dataSub.dispose();
        const cleanedOutput = output.replace(new RegExp(`${marker}\d+`), '').trim();
        const result: CommandResult = {
          command: cmd.command,
          output: cleanedOutput,
          exitCode: exitCode ?? 0,
          error,
          duration: Date.now() - startTime,
        };
        this.commandHistory.push(cmd.command);
        resolve(result);
      };

      this.ptyProcess.write(`${cmd.command} ; echo ${marker}$?` + '\n');

      // Fallback: if marker not detected within timeout, return whatever we have
      // The timeout cleanup is handled above
    });
  }

  public async getSuggestions(currentCommand: string): Promise<string[]> {
    // AI integration removed - return empty suggestions for now
    return [];
  }

  private setupEventHandlers(): void {
    if (!this.ptyProcess) return;

    this.dataSubscription?.dispose();
    this.exitSubscription?.dispose();

    this.dataSubscription = this.ptyProcess.onData((data: string) => {
      this.emit('data', data);
    });

    this.exitSubscription = this.ptyProcess.onExit((evt) => {
      logger.info(`Terminal exited with code ${evt.exitCode}`);
      this.emit('exit', evt.exitCode);
    });

    process.on('exit', () => {
      this.ptyProcess?.kill();
    });
  }

  public get processId(): number {
    return this.state.pid;
  }

  public get currentDirectory(): string {
    return this.state.cwd;
  }

  public get currentShell(): string {
    return this.state.shell;
  }
}

export default TerminalService;
