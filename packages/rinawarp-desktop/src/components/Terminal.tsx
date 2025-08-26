/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useEffect, useRef, useState } from 'react';
import { TerminalToolbar } from './terminal/TerminalToolbar';
import { VoiceService } from '../services/voice.service';
import { TerminalModeService } from '../services/terminal-mode.service';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { ipcRenderer } from 'electron';

interface TerminalProps {
  id?: string;
}

const terminalTheme = {
  background: '#1a1a1a',
  foreground: '#fff',
  cursor: '#FF69B4',
  selection: '#FF7F5066',
  black: '#000000',
  red: '#FF69B4',
  green: '#40E0D0',
  yellow: '#FFD700',
  blue: '#ADD8E6',
  magenta: '#FF69B4',
  cyan: '#40E0D0',
  white: '#ffffff',
  brightBlack: '#808080',
  brightRed: '#FF1493',
  brightGreen: '#48D1CC',
  brightYellow: '#FFA07A',
  brightBlue: '#87CEEB',
  brightMagenta: '#FF69B4',
  brightCyan: '#40E0D0',
  brightWhite: '#ffffff',
};

const Terminal: React.FC<TerminalProps> = ({ id = 'default' }) => {
  const [currentMode, setCurrentMode] = useState({
    id: 'agent',
    name: 'Agent Mode',
    color: '#FF69B4'
  });
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const voiceService = VoiceService.getInstance();
  const modeService = TerminalModeService.getInstance();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    const xterm = new XTerm({
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, Consolas, monospace',
      theme: terminalTheme,
      cursorBlink: true,
      cursorStyle: 'bar',
      letterSpacing: 1
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());

    xtermRef.current = xterm;
    xterm.open(terminalRef.current!);
    fitAddon.fit();

    // Start terminal session
    ipcRenderer.invoke('terminal:start', {
      rows: xterm.rows,
      cols: xterm.cols
    });

    // Handle terminal input
    xterm.onData(async data => {
      // If it's a newline, process the command based on current mode
      if (data === '\r') {
        const command = xterm.buffer.active.getLine(xterm.buffer.active.cursorY)?.translateToString();
        if (command) {
          try {
            const result = await modeService.processCommand(command);
            xterm.writeln('\r\n' + result);
          } catch (error) {
            xterm.writeln('\r\n' + (error as Error).message);
          }
        }
        xterm.write('\r\n$ ');
        return;
      }
      ipcRenderer.invoke('terminal:write', data);
    });

    // Handle terminal output
    ipcRenderer.on('terminal:data', (_, data) => {
      xterm.write(data);
    });

    // Handle terminal exit
    ipcRenderer.on('terminal:exit', (_, code) => {
      console.log(`Terminal ${id} exited with code ${code}`);
    });

    // Handle window resize
    const resizeHandler = () => {
      fitAddon.fit();
      ipcRenderer.invoke('terminal:start', {
        rows: xterm.rows,
        cols: xterm.cols
      });
    };

    window.addEventListener('resize', resizeHandler);

    return () => {
      xterm.dispose();
      window.removeEventListener('resize', resizeHandler);
    };
  }, [id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TerminalToolbar
        currentMode={currentMode}
        onModeChange={(mode) => {
          modeService.setMode(mode.id);
          setCurrentMode(mode);
          // Handle mode change
          if (mode.id === 'voice' && !voiceEnabled) {
            voiceService.startListening().catch(console.error);
            setVoiceEnabled(true);
          } else if (mode.id !== 'voice' && voiceEnabled) {
            voiceService.stopListening().catch(console.error);
            setVoiceEnabled(false);
          }
        }}
      />
      <div
        ref={terminalRef}
        style={{
          width: '100%',
          height: '100%',
          padding: '12px'
        }}
      />
    </div>
  );
};

export default Terminal;
