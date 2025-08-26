import { WebSocket } from 'ws';
import { TerminalService, TerminalOutput } from '../services/terminal';
import { AuthService } from '../services/auth';
import { logger } from '../../utils/logger';

interface TerminalMessage {
  type: 'init' | 'input' | 'resize';
  data: any;
}

export class TerminalController {
  private terminalService: TerminalService;
  private authService: AuthService;

  constructor() {
    this.terminalService = new TerminalService();
    this.authService = new AuthService();
  }

  /**
   * Handle WebSocket connection
   */
  public async handleConnection(ws: WebSocket, token: string): Promise<void> {
    try {
      // Authenticate user
      const user = await this.authService.getCurrentUser(token);
      if (!user) {
        ws.close(1008, 'Authentication failed');
        return;
      }

      // Set up message handling
      ws.on('message', async (data: string) => {
        try {
          const message: TerminalMessage = JSON.parse(data);
          await this.handleMessage(ws, user.id, message);
        } catch (error) {
          logger.error('Failed to handle terminal message:', error);
          this.sendError(ws, 'Failed to handle message');
        }
      });

      // Handle close
      ws.on('close', () => {
        this.handleClose(user.id);
      });

      // Handle errors
      ws.on('error', error => {
        logger.error('Terminal WebSocket error:', error);
        ws.close(1011, 'Internal error');
      });
    } catch (error) {
      logger.error('Failed to handle terminal connection:', error);
      ws.close(1011, 'Internal error');
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(
    ws: WebSocket,
    userId: string,
    message: TerminalMessage
  ): Promise<void> {
    switch (message.type) {
      case 'init':
        await this.handleInit(ws, userId, message.data);
        break;

      case 'input':
        await this.handleInput(ws, message.data);
        break;

      case 'resize':
        await this.handleResize(ws, message.data);
        break;

      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  /**
   * Handle terminal initialization
   */
  private async handleInit(
    ws: WebSocket,
    userId: string,
    data: {
      shellType?: string;
      cwd?: string;
      env?: Record<string, string>;
    }
  ): Promise<void> {
    try {
      // Create terminal session
      const session = await this.terminalService.createSession(userId, data);

      // Store session ID in WebSocket
      (ws as any).sessionId = session.id;

      // Set up terminal output handling
      this.terminalService.on(
        `output:${session.id}`,
        (output: TerminalOutput) => {
          this.sendOutput(ws, output);
        }
      );

      // Set up terminal exit handling
      this.terminalService.on(`exit:${session.id}`, ({ code }) => {
        this.sendExit(ws, code);
        ws.close(1000, 'Terminal exited');
      });

      // Set up error handling
      this.terminalService.on(`error:${session.id}`, (error: Error) => {
        this.sendError(ws, error.message);
      });

      // Send success response
      this.send(ws, {
        type: 'init',
        success: true,
        data: {
          sessionId: session.id,
          shellType: session.shellType,
          cwd: session.cwd,
        },
      });
    } catch (error) {
      logger.error('Failed to initialize terminal:', error);
      this.sendError(ws, 'Failed to initialize terminal');
    }
  }

  /**
   * Handle terminal input
   */
  private async handleInput(
    ws: WebSocket,
    data: {
      command: string;
    }
  ): Promise<void> {
    try {
      const sessionId = (ws as any).sessionId;
      if (!sessionId) {
        this.sendError(ws, 'Terminal not initialized');
        return;
      }

      await this.terminalService.executeCommand(sessionId, data.command);
    } catch (error) {
      logger.error('Failed to handle terminal input:', error);
      this.sendError(ws, 'Failed to execute command');
    }
  }

  /**
   * Handle terminal resize
   */
  private async handleResize(
    ws: WebSocket,
    data: {
      cols: number;
      rows: number;
    }
  ): Promise<void> {
    try {
      const sessionId = (ws as any).sessionId;
      if (!sessionId) {
        this.sendError(ws, 'Terminal not initialized');
        return;
      }

      await this.terminalService.resize(sessionId, data.cols, data.rows);
    } catch (error) {
      logger.error('Failed to resize terminal:', error);
      this.sendError(ws, 'Failed to resize terminal');
    }
  }

  /**
   * Handle connection close
   */
  private async handleClose(userId: string): Promise<void> {
    try {
      // Clean up will be handled by terminal service
      logger.info(`Terminal connection closed for user ${userId}`);
    } catch (error) {
      logger.error('Failed to handle terminal close:', error);
    }
  }

  /**
   * Send output to client
   */
  private sendOutput(ws: WebSocket, output: TerminalOutput): void {
    this.send(ws, {
      type: 'output',
      data: output,
    });
  }

  /**
   * Send exit status to client
   */
  private sendExit(ws: WebSocket, code: number): void {
    this.send(ws, {
      type: 'exit',
      data: { code },
    });
  }

  /**
   * Send error to client
   */
  private sendError(ws: WebSocket, message: string): void {
    this.send(ws, {
      type: 'error',
      data: { message },
    });
  }

  /**
   * Send message to client
   */
  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
