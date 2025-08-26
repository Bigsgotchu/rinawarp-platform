/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { WebglAddon } from 'xterm-addon-webgl';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import { LigaturesAddon } from 'xterm-addon-ligatures';
import { ipcRenderer } from 'electron';
import { Button } from '@progress/kendo-react-buttons';
import { Dialog } from '@progress/kendo-react-dialogs';
import { VoiceService } from '../../services/voice.service';
import { TerminalModeService } from '../../services/terminal-mode.service';
import '../styles/advanced-terminal.css';

interface Tab {
  id: string;
  title: string;
  terminal: XTerm;
}

interface Command {
  id: string;
  title: string;
  description: string;
  icon: string;
  action: () => void;
}

export const AdvancedTerminal: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [splitView, setSplitView] = useState<boolean>(false);
  const [splitOrientation, setSplitOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [searchVisible, setSearchVisible] = useState<boolean>(false);
  const [minimapVisible, setMinimapVisible] = useState<boolean>(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const voiceService = VoiceService.getInstance();
  const modeService = TerminalModeService.getInstance();

  // Advanced command palette commands
  const commands: Command[] = [
    {
      id: 'new-tab',
      title: 'New Tab',
      description: 'Create a new terminal tab',
      icon: '➕',
      action: () => createNewTab(),
    },
    {
      id: 'split-view',
      title: 'Toggle Split View',
      description: 'Split the terminal view',
      icon: '⚡',
      action: () => setSplitView(!splitView),
    },
    {
      id: 'toggle-search',
      title: 'Toggle Search',
      description: 'Show/hide search panel',
      icon: '🔍',
      action: () => setSearchVisible(!searchVisible),
    },
    {
      id: 'toggle-minimap',
      title: 'Toggle Minimap',
      description: 'Show/hide terminal minimap',
      icon: '📍',
      action: () => setMinimapVisible(!minimapVisible),
    },
    // Add more commands as needed
  ];

  const createNewTab = () => {
    const terminal = new XTerm({
      fontFamily: 'JetBrains Mono',
      fontSize: 14,
      theme: {
        background: '#0a0a0a',
        foreground: '#f8f8f2',
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
      },
    });

    // Add terminal addons
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webglAddon = new WebglAddon();
    const unicode11Addon = new Unicode11Addon();
    const ligaturesAddon = new LigaturesAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webglAddon);
    terminal.loadAddon(unicode11Addon);
    terminal.loadAddon(ligaturesAddon);

    const newTab: Tab = {
      id: crypto.randomUUID(),
      title: `Shell ${tabs.length + 1}`,
      terminal,
    };

    setTabs([...tabs, newTab]);
    setActiveTab(newTab.id);
  };

  useEffect(() => {
    createNewTab();

    return () => {
      tabs.forEach(tab => tab.terminal.dispose());
    };
  }, []);

  useEffect(() => {
    const tab = tabs.find(t => t.id === activeTab);
    if (!tab || !terminalRef.current) return;

    const terminal = tab.terminal;
    const container = terminalRef.current.querySelector(`.terminal-${activeTab}`);
    if (!container) return;

    terminal.open(container as HTMLElement);
    (terminal as any).fitAddon?.fit();

    // Set up terminal handlers
    terminal.onData(data => {
      if (data === '\r') { // Enter key
        const line = terminal.buffer.active.getLine(terminal.buffer.active.cursorY)?.translateToString();
        if (line) {
          processCommand(line.trim());
        }
      }
      ipcRenderer.invoke('terminal:write', data);
    });

    // Handle terminal output
    ipcRenderer.on('terminal:data', (_, data) => {
      terminal.write(data);
    });

    // Matrix rain effect
    const startMatrixRain = () => {
      const chars = '日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ';
      const raindrops: HTMLSpanElement[] = [];

      for (let i = 0; i < 50; i++) {
        const drop = document.createElement('span');
        drop.textContent = chars[Math.floor(Math.random() * chars.length)];
        drop.style.left = `${Math.random() * 100}%`;
        drop.style.animationDelay = `${Math.random() * 2}s`;
        raindrops.push(drop);
      }

      const matrixContainer = document.createElement('div');
      matrixContainer.className = 'matrix-rain';
      raindrops.forEach(drop => matrixContainer.appendChild(drop));
      container.appendChild(matrixContainer);
    };

    startMatrixRain();

    return () => {
      terminal.dispose();
    };
  }, [activeTab, tabs]);

  const processCommand = async (command: string) => {
    try {
      const result = await modeService.processCommand(command);
      const terminal = tabs.find(t => t.id === activeTab)?.terminal;
      if (terminal) {
        terminal.writeln(`\r\n${result}`);
        terminal.write('\r\n$ ');
      }
    } catch (error) {
      console.error('Command processing error:', error);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // Command palette shortcut (Cmd/Ctrl + P)
    if ((event.metaKey || event.ctrlKey) && event.key === 'p') {
      event.preventDefault();
      setShowCommandPalette(true);
    }

    // Search shortcut (Cmd/Ctrl + F)
    if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
      event.preventDefault();
      setSearchVisible(true);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="advanced-terminal">
      {/* Terminal Tabs */}
      <div className="terminal-tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`terminal-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.title}
            {tabs.length > 1 && (
              <Button
                look="clear"
                icon="x"
                onClick={(e) => {
                  e.stopPropagation();
                  setTabs(tabs.filter(t => t.id !== tab.id));
                }}
              />
            )}
          </div>
        ))}
        <Button
          look="clear"
          icon="plus"
          onClick={createNewTab}
        />
      </div>

      {/* Terminal Content */}
      <div
        className={`terminal-content ${splitView ? 'terminal-split' : ''} ${
          splitOrientation === 'vertical' ? 'vertical' : ''
        }`}
      >
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`terminal-${tab.id}`}
            style={{
              display: activeTab === tab.id ? 'block' : 'none',
              height: '100%',
            }}
          />
        ))}
      </div>

      {/* Terminal Search */}
      {searchVisible && (
        <div className="terminal-search">
          <input
            type="text"
            placeholder="Search..."
            onChange={(e) => {
              const terminal = tabs.find(t => t.id === activeTab)?.terminal;
              if (terminal) {
                (terminal as any).searchAddon?.findNext(e.target.value);
              }
            }}
          />
          <Button
            look="clear"
            icon="x"
            onClick={() => setSearchVisible(false)}
          />
        </div>
      )}

      {/* Terminal Minimap */}
      {minimapVisible && (
        <div className="terminal-minimap">
          {/* Implement minimap visualization */}
        </div>
      )}

      {/* Command Palette */}
      {showCommandPalette && (
        <Dialog
          title="Command Palette"
          onClose={() => setShowCommandPalette(false)}
          width={600}
        >
          <div className="command-palette">
            <input
              type="text"
              placeholder="Type a command..."
              autoFocus
              onChange={(e) => {
                // Implement command filtering
              }}
            />
            <div className="command-palette-list">
              {commands.map(command => (
                <div
                  key={command.id}
                  className="command-palette-item"
                  onClick={() => {
                    command.action();
                    setShowCommandPalette(false);
                  }}
                >
                  <span className="icon">{command.icon}</span>
                  <div>
                    <div>{command.title}</div>
                    <div className="description">{command.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Dialog>
      )}

      {/* Status Bar */}
      <div className="terminal-status">
        <div className="status-left">
          <div className="status-item">
            <span className="icon" />
            {modeService.getMode()}
          </div>
        </div>
        <div className="status-right">
          <div className="status-item">
            <span className="icon" />
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};
