/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { logger } from '../utils/logger';
import { AnalyticsService } from './analytics.service';

interface VoiceConfig {
  language: string;
  useCustomVoice: boolean;
  voiceId: string;
  pitch: number;
  rate: number;
  volume: number;
}

export class VoiceService {
  private static instance: VoiceService;
  private recognition: any; // SpeechRecognition
  private synthesis: any; // SpeechSynthesis
  private isListening: boolean = false;
  private analyticsService: AnalyticsService;
  private customVoice: any; // ElevenLabs voice instance
  private config: VoiceConfig = {
    language: 'en-US',
    useCustomVoice: true,
    voiceId: 'rina-ai', // Custom voice ID
    pitch: 1.0,
    rate: 1.0,
    volume: 1.0,
  };

  private constructor() {
    this.initializeSpeechRecognition();
    this.initializeSpeechSynthesis();
    this.analyticsService = AnalyticsService.getInstance();
  }

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  private initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.config.language;

    this.recognition.onresult = this.handleRecognitionResult.bind(this);
    this.recognition.onerror = this.handleRecognitionError.bind(this);
    this.recognition.onend = this.handleRecognitionEnd.bind(this);
  }

  private initializeSpeechSynthesis() {
    this.synthesis = window.speechSynthesis;
    this.initializeCustomVoice();
  }

  private async initializeCustomVoice() {
    try {
      // Initialize ElevenLabs API for custom voice
      const response = await fetch('/api/voice/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceId: this.config.voiceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initialize custom voice');
      }

      this.customVoice = await response.json();
    } catch (error) {
      logger.error('Failed to initialize custom voice:', error);
      this.config.useCustomVoice = false;
    }
  }

  public async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      await this.recognition.start();
      this.isListening = true;
      logger.info('Voice recognition started');
    } catch (error) {
      logger.error('Failed to start voice recognition:', error);
      throw error;
    }
  }

  public async stopListening(): Promise<void> {
    if (!this.isListening) return;

    try {
      await this.recognition.stop();
      this.isListening = false;
      logger.info('Voice recognition stopped');
    } catch (error) {
      logger.error('Failed to stop voice recognition:', error);
      throw error;
    }
  }

  public async speak(text: string): Promise<void> {
    try {
      if (this.config.useCustomVoice) {
        await this.speakWithCustomVoice(text);
      } else {
        await this.speakWithDefaultVoice(text);
      }
    } catch (error) {
      logger.error('Failed to speak:', error);
      throw error;
    }
  }

  private async speakWithCustomVoice(text: string): Promise<void> {
    try {
      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voiceId: this.config.voiceId,
          pitch: this.config.pitch,
          rate: this.config.rate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to synthesize speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      await new Promise((resolve, reject) => {
        audio.onended = resolve;
        audio.onerror = reject;
        audio.play();
      });

      URL.revokeObjectURL(audioUrl);
    } catch (error) {
      logger.error('Failed to speak with custom voice:', error);
      // Fallback to default voice
      await this.speakWithDefaultVoice(text);
    }
  }

  private async speakWithDefaultVoice(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.config.language;
      utterance.pitch = this.config.pitch;
      utterance.rate = this.config.rate;
      utterance.volume = this.config.volume;

      utterance.onend = () => resolve();
      utterance.onerror = (error) => reject(error);

      this.synthesis.speak(utterance);
    });
  }

  private async handleRecognitionResult(event: any) {
    try {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const command = result[0].transcript.trim();
        const confidence = result[0].confidence;

        // Track the voice command
        await this.analyticsService.trackVoiceCommand(
          command,
          event.timeStamp,
          confidence
        );

        // Emit the command for processing
        this.emit('command', {
          command,
          confidence,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      logger.error('Failed to handle recognition result:', error);
    }
  }

  private handleRecognitionError(event: any) {
    logger.error('Speech recognition error:', event.error);
    this.isListening = false;
    this.emit('error', event.error);
  }

  private handleRecognitionEnd() {
    this.isListening = false;
    this.emit('end');

    // Automatically restart if it was supposed to be listening
    if (this.isListening) {
      this.startListening().catch((error) => {
        logger.error('Failed to restart voice recognition:', error);
      });
    }
  }

  // Configuration methods
  public updateConfig(config: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.recognition) {
      this.recognition.lang = this.config.language;
    }

    if (config.useCustomVoice) {
      this.initializeCustomVoice();
    }
  }

  public getConfig(): VoiceConfig {
    return { ...this.config };
  }

  // Event handling
  private listeners: { [key: string]: Function[] } = {};

  public on(event: string, callback: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  public off(event: string, callback: Function): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  private emit(event: string, data?: any): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }
}
