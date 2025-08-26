/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

const { safeStorage } = require('electron');
const { writeFile } = require('fs').promises;
const { join } = require('path');
const { homedir } = require('os');
const { mkdirSync } = require('fs');

async function storeApiKey(key) {
  const configDir = join(homedir(), '.rinawarp');
  const configPath = join(configDir, 'secure-config.enc');
  
  try {
    // Ensure config directory exists
    mkdirSync(configDir, { recursive: true });
    
    // Encrypt and store the key
    const config = { elevenlabs_api_key: key };
    const jsonData = JSON.stringify(config);
    const encryptedData = safeStorage.encryptString(jsonData);
    
    await writeFile(configPath, encryptedData);
    console.log('API key stored securely in:', configPath);
  } catch (error) {
    console.error('Failed to store API key:', error);
    process.exit(1);
  }
}

// Get key from command line
const key = process.argv[2];
if (!key) {
  console.error('Please provide the API key as an argument');
  process.exit(1);
}

storeApiKey(key);
