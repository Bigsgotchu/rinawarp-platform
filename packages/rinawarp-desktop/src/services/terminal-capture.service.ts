/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { logger } from '../utils/logger';

export interface TerminalData {
  id: string;
  timestamp: Date;
  type: 'command' | 'output' | 'error';
  content: string;
  mode: string;
  metadata?: {
    duration?: number;
    exitCode?: number;
    pwd?: string;
    env?: Record<string, string>;
    user?: string;
    sessionId?: string;
    aiAssisted?: boolean;
  };
}

export interface TerminalSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  mode: string;
  data: TerminalData[];
}

export class TerminalCaptureService {
  private static instance: TerminalCaptureService;
  private sessions: Map<string, TerminalSession> = new Map();
  private currentSessionId: string | null = null;
  private dataBuffer: Map<string, string> = new Map();
  private outputProcessors: ((data: TerminalData) => Promise<void>)[] = [];

  private constructor() {
    this.initializeService();
  }

  public static getInstance(): TerminalCaptureService {
    if (!TerminalCaptureService.instance) {
      TerminalCaptureService.instance = new TerminalCaptureService();
    }
    return TerminalCaptureService.instance;
  }

  private initializeService() {
    // Set up cleanup interval for old sessions
    setInterval(() => {
      this.cleanupOldSessions();
    }, 24 * 60 * 60 * 1000); // Clean up daily
  }

  public startSession(mode: string = 'default'): string {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      id: sessionId,
      startTime: new Date(),
      mode,
      data: [],
    });
    this.currentSessionId = sessionId;
    logger.info(`Terminal session started: ${sessionId}`);
    return sessionId;
  }

  public endSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = new Date();
      logger.info(`Terminal session ended: ${sessionId}`);
      
      // Export session data if needed
      this.exportSessionData(session).catch(err => {
        logger.error('Failed to export session data:', err);
      });
    }
  }

  public captureCommand(command: string, metadata: TerminalData['metadata'] = {}) {
    if (!this.currentSessionId) {
      logger.warn('No active terminal session');
      return;
    }

    const data: TerminalData = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'command',
      content: command,
      mode: this.sessions.get(this.currentSessionId)?.mode || 'default',
      metadata: {
        ...metadata,
        sessionId: this.currentSessionId,
      },
    };

    this.processData(data);
  }

  public captureOutput(output: string, metadata: TerminalData['metadata'] = {}) {
    if (!this.currentSessionId) {
      logger.warn('No active terminal session');
      return;
    }

    const data: TerminalData = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'output',
      content: output,
      mode: this.sessions.get(this.currentSessionId)?.mode || 'default',
      metadata: {
        ...metadata,
        sessionId: this.currentSessionId,
      },
    };

    this.processData(data);
  }

  public captureError(error: string, metadata: TerminalData['metadata'] = {}) {
    if (!this.currentSessionId) {
      logger.warn('No active terminal session');
      return;
    }

    const data: TerminalData = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'error',
      content: error,
      mode: this.sessions.get(this.currentSessionId)?.mode || 'default',
      metadata: {
        ...metadata,
        sessionId: this.currentSessionId,
      },
    };

    this.processData(data);
  }

  public async processData(data: TerminalData) {
    // Add to session data
    const session = this.sessions.get(data.metadata?.sessionId || this.currentSessionId!);
    if (session) {
      session.data.push(data);
    }

    // Process through registered processors
    for (const processor of this.outputProcessors) {
      try {
        await processor(data);
      } catch (error) {
        logger.error('Output processor error:', error);
      }
    }

    // Buffer management for multi-line output
    if (data.type === 'output') {
      this.updateBuffer(data);
    }
  }

  public registerOutputProcessor(processor: (data: TerminalData) => Promise<void>) {
    this.outputProcessors.push(processor);
  }

  public getSessionData(sessionId: string): TerminalData[] {
    return this.sessions.get(sessionId)?.data || [];
  }

  public getCurrentSession(): TerminalSession | undefined {
    return this.currentSessionId ? this.sessions.get(this.currentSessionId) : undefined;
  }

  public async exportSessionData(session: TerminalSession) {
    try {
      // Here you would implement your export logic
      // For example, saving to a file or sending to a server
      logger.info(`Exporting session data: ${session.id}`);
      
      // Example: Convert to JSON and save
      const exportData = {
        sessionId: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        mode: session.mode,
        commands: session.data.filter(d => d.type === 'command').length,
        outputs: session.data.filter(d => d.type === 'output').length,
        errors: session.data.filter(d => d.type === 'error').length,
        data: session.data,
      };

      // You would implement your storage logic here
      // await storage.saveSessionData(exportData);
      
    } catch (error) {
      logger.error('Failed to export session data:', error);
      throw error;
    }
  }

  private updateBuffer(data: TerminalData) {
    const sessionId = data.metadata?.sessionId || this.currentSessionId!;
    let buffer = this.dataBuffer.get(sessionId) || '';
    
    // Append new data to buffer
    buffer += data.content;

    // Process complete lines
    const lines = buffer.split('\n');
    if (lines.length > 1) {
      // Process all complete lines
      for (const line of lines.slice(0, -1)) {
        this.processLine(line.trim(), sessionId);
      }
      // Keep the incomplete line in the buffer
      buffer = lines[lines.length - 1];
    }

    this.dataBuffer.set(sessionId, buffer);
  }

  private processLine(line: string, sessionId: string) {
    // Implement line processing logic here
    // For example, detecting command prompts, errors, etc.
    if (line.startsWith('error') || line.includes('Error:')) {
      this.captureError(line, { sessionId });
    }
  }

  private cleanupOldSessions() {
    const now = new Date();
    for (const [id, session] of this.sessions.entries()) {
      // Remove sessions older than 30 days
      if (session.startTime.getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000) {
        this.sessions.delete(id);
        this.dataBuffer.delete(id);
      }
    }
  }

  // Analytics and metrics methods
  public getSessionMetrics(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const commands = session.data.filter(d => d.type === 'command');
    const errors = session.data.filter(d => d.type === 'error');
    
    return {
      totalCommands: commands.length,
      totalErrors: errors.length,
      averageCommandDuration: commands.reduce((acc, cmd) => acc + (cmd.metadata?.duration || 0), 0) / commands.length,
      errorRate: errors.length / commands.length,
      aiAssistedCommands: commands.filter(cmd => cmd.metadata?.aiAssisted).length,
    };
  }

  public searchSessionData(query: string): TerminalData[] {
    const results: TerminalData[] = [];
    for (const session of this.sessions.values()) {
      const matches = session.data.filter(data =>
        data.content.toLowerCase().includes(query.toLowerCase())
      );
      results.push(...matches);
    }
    return results;
  }
}
