import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { db } from '../database';
import { CacheService } from './cache';

export interface TerminalSession {
  id: string;
  userId: string;
  shellType: string;
  cwd: string;
  env: Record<string, string>;
  createdAt: Date;
  lastActivity: Date;
}

export interface TerminalOutput {
  type: 'stdout' | 'stderr';
  data: string;
  timestamp: Date;
}

export class TerminalService extends EventEmitter {
  private sessions: Map<string, ChildProcess> = new Map();
  private cache: CacheService;
  private readonly sessionPrefix = 'terminal_session:';

  constructor() {
    super();
    this.cache = new CacheService();
  }

  /**
   * Create new terminal session
   */
  public async createSession(
    userId: string,
    options: {
      shellType?: string;
      cwd?: string;
      env?: Record<string, string>;
    } = {}
  ): Promise<TerminalSession> {
    try {
      const sessionId = uuidv4();
      const now = new Date();

      // Determine shell type
      const shellType = options.shellType || process.platform === 'win32' ? 'powershell' : 'zsh';
      
      // Get shell command and args
      const { command, args } = this.getShellCommand(shellType);

      // Prepare environment
      const env = {
        ...process.env,
        TERM: 'xterm-256color',
        ...options.env,
      };

      // Create process
      const proc = spawn(command, args, {
        cwd: options.cwd || process.cwd(),
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Store session
      this.sessions.set(sessionId, proc);

      // Create session record
      const session: TerminalSession = {
        id: sessionId,
        userId,
        shellType,
        cwd: options.cwd || process.cwd(),
        env,
        createdAt: now,
        lastActivity: now,
      };

      // Save to database
      await db.terminalSessions.create(session);

      // Cache session
      await this.cache.set(
        `${this.sessionPrefix}${sessionId}`,
        session,
        3600 // 1 hour
      );

      // Setup event handlers
      this.setupEventHandlers(sessionId, proc);

      return session;
    } catch (error) {
      logger.error('Failed to create terminal session:', error);
      throw error;
    }
  }

  /**
   * Execute command in session
   */
  public async executeCommand(
    sessionId: string,
    command: string
  ): Promise<void> {
    try {
      const proc = this.sessions.get(sessionId);
      if (!proc) {
        throw new Error('Session not found');
      }

      // Update last activity
      await this.updateLastActivity(sessionId);

      // Write command to stdin
      proc.stdin.write(command + '\n');

      // Track command in history
      const session = await this.getSession(sessionId);
      if (session) {
        await db.commandHistory.create({
          userId: session.userId,
          command,
          directory: session.cwd,
        });
      }
    } catch (error) {
      logger.error('Failed to execute command:', error);
      throw error;
    }
  }

  /**
   * Resize terminal
   */
  public async resize(
    sessionId: string,
    cols: number,
    rows: number
  ): Promise<void> {
    try {
      const proc = this.sessions.get(sessionId);
      if (!proc) {
        throw new Error('Session not found');
      }

      // Update last activity
      await this.updateLastActivity(sessionId);

      // @ts-ignore - pty.resize exists but TypeScript doesn't know about it
      if (proc.resize) {
        // @ts-ignore
        proc.resize(cols, rows);
      }
    } catch (error) {
      logger.error('Failed to resize terminal:', error);
      throw error;
    }
  }

  /**
   * Close session
   */
  public async closeSession(sessionId: string): Promise<void> {
    try {
      const proc = this.sessions.get(sessionId);
      if (!proc) {
        return;
      }

      // Kill process
      proc.kill();
      this.sessions.delete(sessionId);

      // Remove from database
      await db.terminalSessions.delete({ id: sessionId });

      // Remove from cache
      await this.cache.delete(`${this.sessionPrefix}${sessionId}`);
    } catch (error) {
      logger.error('Failed to close terminal session:', error);
      throw error;
    }
  }

  /**
   * Get session
   */
  private async getSession(sessionId: string): Promise<TerminalSession | null> {
    try {
      // Check cache
      const cacheKey = `${this.sessionPrefix}${sessionId}`;
      const cached = await this.cache.get<TerminalSession>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get from database
      const session = await db.terminalSessions.findOne({ id: sessionId });
      if (!session) {
        return null;
      }

      // Cache session
      await this.cache.set(cacheKey, session, 3600); // 1 hour

      return session;
    } catch (error) {
      logger.error('Failed to get terminal session:', error);
      return null;
    }
  }

  /**
   * Update session last activity
   */
  private async updateLastActivity(sessionId: string): Promise<void> {
    try {
      const now = new Date();

      // Update database
      await db.terminalSessions.update(sessionId, {
        lastActivity: now,
      });

      // Update cache
      const session = await this.getSession(sessionId);
      if (session) {
        session.lastActivity = now;
        await this.cache.set(
          `${this.sessionPrefix}${sessionId}`,
          session,
          3600 // 1 hour
        );
      }
    } catch (error) {
      logger.error('Failed to update terminal session activity:', error);
    }
  }

  /**
   * Get shell command and args
   */
  private getShellCommand(shellType: string): { command: string; args: string[] } {
    switch (shellType.toLowerCase()) {
      case 'powershell':
        return {
          command: 'powershell.exe',
          args: ['-NoLogo'],
        };
      case 'cmd':
        return {
          command: 'cmd.exe',
          args: [],
        };
      case 'bash':
        return {
          command: 'bash',
          args: ['--login'],
        };
      case 'zsh':
        return {
          command: 'zsh',
          args: ['--login'],
        };
      default:
        return {
          command: process.platform === 'win32' ? 'powershell.exe' : 'bash',
          args: process.platform === 'win32' ? ['-NoLogo'] : ['--login'],
        };
    }
  }

  /**
   * Setup process event handlers
   */
  private setupEventHandlers(sessionId: string, proc: ChildProcess): void {
    // Handle stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const output: TerminalOutput = {
        type: 'stdout',
        data: data.toString(),
        timestamp: new Date(),
      };
      this.emit(`output:${sessionId}`, output);
    });

    // Handle stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const output: TerminalOutput = {
        type: 'stderr',
        data: data.toString(),
        timestamp: new Date(),
      };
      this.emit(`output:${sessionId}`, output);
    });

    // Handle process exit
    proc.on('exit', (code: number) => {
      this.emit(`exit:${sessionId}`, { code });
      this.closeSession(sessionId).catch(error => {
        logger.error('Failed to clean up session:', error);
      });
    });

    // Handle process error
    proc.on('error', (error: Error) => {
      logger.error('Terminal process error:', error);
      this.emit(`error:${sessionId}`, error);
    });
  }

  /**
   * Clean up inactive sessions
   */
  public async cleanupInactiveSessions(maxAge: number = 24 * 3600 * 1000): Promise<void> {
    try {
      const now = new Date();
      const cutoff = new Date(now.getTime() - maxAge);

      // Get inactive sessions
      const inactiveSessions = await db.terminalSessions.findMany({
        lastActivity: { $lt: cutoff },
      });

      // Close each session
      for (const session of inactiveSessions) {
        await this.closeSession(session.id);
      }
    } catch (error) {
      logger.error('Failed to cleanup inactive sessions:', error);
    }
  }
}
