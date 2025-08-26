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
import { spawn, IPty } from 'node-pty';
import { homedir } from 'os';

let mainWindow: BrowserWindow | null = null;
let ptyProcess: IPty | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../index.html'));
  }

  mainWindow.on('closed', () => {
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
    mainWindow = null;
  });

  // Terminal IPC handlers
  ipcMain.handle('terminal:start', async (_, { rows, cols }) => {
    try {
      if (ptyProcess) {
        ptyProcess.kill();
      }

      const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
      ptyProcess = spawn(shell, [], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: homedir(),
        env: process.env as { [key: string]: string }
      });

      ptyProcess.onData((data) => {
        mainWindow?.webContents.send('terminal:data', data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        mainWindow?.webContents.send('terminal:exit', exitCode);
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to start terminal:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('terminal:write', async (_, data) => {
    try {
      ptyProcess?.write(data);
      return { success: true };
    } catch (error) {
      console.error('Failed to write to terminal:', error);
      return { success: false, error: (error as Error).message };
    }
  });
};

app.whenReady().then(createWindow);

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
