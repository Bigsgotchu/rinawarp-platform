/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { spawn } from 'node-pty';
import { getPlatformConfig } from './config';
import { homedir } from 'os';

let mainWindow: BrowserWindow | null;
const terminals: Map<string, any> = new Map();

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'RinaWarp',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webgl: true,
    },
  });

  // Load the index.html
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../index.html'));
  }

  // Handle terminal creation
  ipcMain.handle('terminal:start', (event, { rows, cols }) => {
    const shell = getPlatformConfig().shell;
    const terminal = spawn(shell, [], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: homedir(),
      env: process.env,
    });

    const terminalId = Date.now().toString();
    terminals.set(terminalId, terminal);

    terminal.onData(data => {
      if (mainWindow) {
        mainWindow.webContents.send('terminal:data', data);
      }
    });

    return terminalId;
  });

  // Handle terminal input
  ipcMain.handle('terminal:write', (event, data) => {
    terminals.forEach(terminal => {
      terminal.write(data);
    });
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    // Clean up terminals
    terminals.forEach(terminal => {
      terminal.kill();
    });
    terminals.clear();
  });
}

// App ready
app.whenReady().then(createWindow);

// Handle macOS window behavior
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
