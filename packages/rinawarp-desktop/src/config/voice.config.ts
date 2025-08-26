/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

export const VoiceConfig = {
  api: {
    baseUrl: process.env.VOICE_API_BASE_URL || 'http://localhost:3000/api/voice',
    endpoints: {
      initialize: '/initialize',
      synthesize: '/synthesize',
      status: '/status',
    },
  },
  voice: {
    id: 'rina-ai',
    defaultSettings: {
      stability: 0.7,
      similarity_boost: 0.7,
      style: 0.7,
      use_speaker_boost: true,
    },
  },
  fallback: {
    useSystemTTS: true,
    voice: 'Samantha', // Default macOS voice
    rate: 1.1,
    pitch: 1.0,
    volume: 1.0,
  },
};
