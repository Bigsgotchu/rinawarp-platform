/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { safeStorage } from 'electron';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger';

interface SecureConfig {
  elevenlabs_api_key?: string;
  // Add other secure keys here
}

export class SecureConfigManager {
  private static instance: SecureConfigManager;
  private configPath: string;
  private config: SecureConfig = {};

  private constructor() {
    this.configPath = join(homedir(), '.rinawarp', 'secure-config.enc');
    this.loadConfig().catch(logger.error);
  }

  public static getInstance(): SecureConfigManager {
    if (!SecureConfigManager.instance) {
      SecureConfigManager.instance = new SecureConfigManager();
    }
    return SecureConfigManager.instance;
  }

  private async loadConfig() {
    try {
      const encryptedData = await readFile(this.configPath);
      const decryptedData = safeStorage.decryptString(encryptedData);
      this.config = JSON.parse(decryptedData);
    } catch (error) {
      // If file doesn't exist or is corrupted, start with empty config
      this.config = {};
    }
  }

  private async saveConfig() {
    const jsonData = JSON.stringify(this.config);
    const encryptedData = safeStorage.encryptString(jsonData);
    await writeFile(this.configPath, encryptedData);
  }

  public async setApiKey(key: string) {
    this.config.elevenlabs_api_key = key;
    await this.saveConfig();
  }

  public getApiKey(): string | undefined {
    return this.config.elevenlabs_api_key;
  }

  public async clearConfig() {
    this.config = {};
    await this.saveConfig();
  }
}
