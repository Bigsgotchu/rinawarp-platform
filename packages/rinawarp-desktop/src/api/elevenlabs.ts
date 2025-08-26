/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import axios from 'axios';
import { logger } from '../utils/logger';

interface Voice {
  voice_id: string;
  name: string;
  samples: any[];
  category: string;
  settings: any;
  remaining_characters?: number;
}

interface SpeechOptions {
  voice_id: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export class ElevenLabsClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';
  private voiceCache: Map<string, Voice> = new Map();

constructor() {
    const secureConfig = SecureConfigManager.getInstance();
    this.apiKey = secureConfig.getApiKey() || '';
  }

  private getHeaders() {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'xi-api-key': this.apiKey,
    };
  }

  public async getVoices(): Promise<Voice[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: this.getHeaders(),
      });

      const voices = response.data.voices;
      voices.forEach((voice: Voice) => {
        this.voiceCache.set(voice.voice_id, voice);
      });

      return voices;

    } catch (error) {
      logger.error('Failed to fetch voices:', error);
      throw error;
    }
  }

  public async getVoice(voiceId: string): Promise<Voice | null> {
    try {
      // Check cache first
      if (this.voiceCache.has(voiceId)) {
        return this.voiceCache.get(voiceId)!;
      }

      const response = await axios.get(`${this.baseUrl}/voices/${voiceId}`, {
        headers: this.getHeaders(),
      });

      const voice = response.data;
      this.voiceCache.set(voiceId, voice);

      return voice;

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to fetch voice:', error);
      throw error;
    }
  }

  public async generateSpeech(text: string, options: SpeechOptions): Promise<Buffer> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${options.voice_id}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: options.stability,
            similarity_boost: options.similarity_boost,
            style: options.style,
            use_speaker_boost: options.use_speaker_boost,
          },
        },
        {
          headers: this.getHeaders(),
          responseType: 'arraybuffer',
        }
      );

      return Buffer.from(response.data);

    } catch (error) {
      logger.error('Failed to generate speech:', error);
      throw error;
    }
  }

  public async getUserInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        headers: this.getHeaders(),
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to fetch user info:', error);
      throw error;
    }
  }

  public clearCache() {
    this.voiceCache.clear();
  }
}
