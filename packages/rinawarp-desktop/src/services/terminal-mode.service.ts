/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { VoiceService } from './voice.service';
import { AnalyticsService } from './analytics.service';
import { logger } from '../utils/logger';

export interface CommandProcessor {
  processCommand: (command: string) => Promise<string>;
}

class AgentModeProcessor implements CommandProcessor {
  async processCommand(command: string): Promise<string> {
    // Here you would integrate with your AI agent for command processing
    // For now, we'll just return a placeholder
    return `[Agent] Processing: ${command}`;
  }
}

class RegularModeProcessor implements CommandProcessor {
  async processCommand(command: string): Promise<string> {
    // Regular mode just executes the command directly
    return command;
  }
}

class VoiceModeProcessor implements CommandProcessor {
  private voiceService: VoiceService;

  constructor() {
    this.voiceService = VoiceService.getInstance();
  }

  async processCommand(command: string): Promise<string> {
    try {
      // Process command using AI if needed
      const response = await this.processWithAI(command);
      
      // Speak the response using custom voice
      await this.voiceService.speak(response);
      
      return response;
    } catch (error) {
      logger.error('Voice mode processing error:', error);
      throw error;
    }
  }

  private async processWithAI(command: string): Promise<string> {
    // Here you would integrate with your AI for natural language processing
    // For now, return a simple response
    return `Processed voice command: ${command}`;
  }
}

export class TerminalModeService {
  private static instance: TerminalModeService;
  private currentMode: string = 'agent'; // Default to agent mode
  private processors: { [key: string]: CommandProcessor } = {
    agent: new AgentModeProcessor(),
    regular: new RegularModeProcessor(),
    voice: new VoiceModeProcessor(),
  };
  private analyticsService: AnalyticsService;

  private constructor() {
    this.analyticsService = AnalyticsService.getInstance();
  }

  public static getInstance(): TerminalModeService {
    if (!TerminalModeService.instance) {
      TerminalModeService.instance = new TerminalModeService();
    }
    return TerminalModeService.instance;
  }

  public setMode(mode: string): void {
    if (!this.processors[mode]) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    this.currentMode = mode;
    logger.info(`Terminal mode changed to: ${mode}`);
  }

  public getMode(): string {
    return this.currentMode;
  }

  public async processCommand(command: string): Promise<string> {
    const startTime = Date.now();
    let result: string;

    try {
      // Process command using the current mode's processor
      result = await this.processors[this.currentMode].processCommand(command);

      // Track command execution
      await this.analyticsService.trackCommand({
        id: crypto.randomUUID(),
        command,
        timestamp: new Date(),
        mode: this.currentMode as any,
        duration: Date.now() - startTime,
        exitCode: 0,
        output: result,
        aiAssisted: this.currentMode === 'agent',
      });

      return result;
    } catch (error) {
      logger.error('Command processing error:', error);

      // Track failed command
      await this.analyticsService.trackCommand({
        id: crypto.randomUUID(),
        command,
        timestamp: new Date(),
        mode: this.currentMode as any,
        duration: Date.now() - startTime,
        exitCode: 1,
        output: (error as Error).message,
        aiAssisted: this.currentMode === 'agent',
      });

      throw error;
    }
  }

  public getAvailableModes(): string[] {
    return Object.keys(this.processors);
  }
}
