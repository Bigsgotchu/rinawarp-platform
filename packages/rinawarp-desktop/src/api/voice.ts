/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { ipcMain } from 'electron';
import { ElevenLabsClient } from './elevenlabs';
import { VoiceConfig } from '../config/voice.config';
import { logger } from '../utils/logger';

// Initialize ElevenLabs client with your API key
const elevenLabs = new ElevenLabsClient(process.env.ELEVENLABS_API_KEY || '');

// Handle voice initialization
ipcMain.handle('voice:initialize', async (event) => {
  try {
    // Get voice ID from config
    const voiceId = VoiceConfig.voice.id;

    // Verify voice exists and is available
    const voice = await elevenLabs.getVoice(voiceId);
    if (!voice) {
      throw new Error('Voice not found');
    }

    logger.info('Voice initialized:', voiceId);
    return { voice_id: voiceId };

  } catch (error) {
    logger.error('Voice initialization failed:', error);
    throw error;
  }
});

// Handle text-to-speech synthesis
ipcMain.handle('voice:synthesize', async (event, { text, voice_id, options }) => {
  try {
    // Generate speech from text
    const audioBuffer = await elevenLabs.generateSpeech(text, {
      voice_id,
      ...VoiceConfig.voice.defaultSettings,
      ...options,
    });

    // Convert buffer to base64
    const audioBase64 = audioBuffer.toString('base64');

    logger.info('Speech synthesis complete');
    return { audio: audioBase64 };

  } catch (error) {
    logger.error('Speech synthesis failed:', error);
    throw error;
  }
});

// Handle voice status check
ipcMain.handle('voice:status', async (event) => {
  try {
    const voiceId = VoiceConfig.voice.id;
    const voice = await elevenLabs.getVoice(voiceId);

    return {
      available: !!voice,
      voice_id: voiceId,
      remaining_characters: voice?.remaining_characters || 0,
    };

  } catch (error) {
    logger.error('Voice status check failed:', error);
    return {
      available: false,
      error: error.message,
    };
  }
});
