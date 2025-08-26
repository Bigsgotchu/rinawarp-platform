/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@progress/kendo-react-buttons';
import { DropDownList } from '@progress/kendo-react-dropdowns';
import { VoiceService } from '../../services/voice.service';
import { Loader } from '@progress/kendo-react-indicators';

interface TerminalMode {
  id: string;
  name: string;
  color: string;
}

const modes: TerminalMode[] = [
  { id: 'agent', name: 'Agent Mode', color: '#FF69B4' }, // Hot Pink
  { id: 'regular', name: 'Regular Mode', color: '#FF7F50' }, // Coral
  { id: 'voice', name: 'Voice Mode', color: '#40E0D0' }, // Turquoise
];

interface TerminalToolbarProps {
  onModeChange: (mode: TerminalMode) => void;
  currentMode: TerminalMode;
}

export const TerminalToolbar: React.FC<TerminalToolbarProps> = ({
  onModeChange,
  currentMode,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const voiceService = VoiceService.getInstance();

  useEffect(() => {
    voiceService.on('processing', (processing: boolean) => {
      setIsProcessing(processing);
    });

    return () => {
      voiceService.off('processing', () => {});
    };
  }, []);

  const handleVoiceToggle = async () => {
    try {
      if (isListening) {
        await voiceService.stopListening();
        setIsListening(false);
      } else {
        await voiceService.startListening();
        setIsListening(true);
      }
    } catch (error) {
      console.error('Voice control error:', error);
      setIsListening(false);
    }
  };

  return (
    <div className="terminal-toolbar">
      <div className="mode-selector">
        <DropDownList
          data={modes}
          textField="name"
          value={currentMode}
          onChange={(e) => onModeChange(e.value)}
          defaultValue={modes[0]} // Agent mode default
          style={{
            backgroundColor: currentMode.color,
            color: '#fff',
            width: '150px',
          }}
        />
      </div>

      <div className="voice-controls">
        <Button
          icon={isListening ? 'microphone' : 'microphone-mute'}
          onClick={handleVoiceToggle}
          themeColor={isListening ? 'primary' : 'base'}
          rounded="full"
          size="large"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader size="small" type="pulsing" />
          ) : (
            isListening ? 'Listening...' : 'Start Voice'
          )}
        </Button>
      </div>

      <style>{`
        .terminal-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
background: var(--rinawarp-gradient-primary);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .mode-selector {
          position: relative;
        }

        .mode-selector .k-dropdown {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 20px;
        }

        .voice-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .voice-controls .k-button {
          backdrop-filter: blur(5px);
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }

        .voice-controls .k-button:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .voice-controls .k-button.k-primary {
          background: #FF69B4;
          border-color: #FF69B4;
        }

        .voice-controls .k-button.k-primary:hover {
          background: #FF1493;
          border-color: #FF1493;
        }
      `}</style>
    </div>
  );
};
