/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { SecureConfigManager } from '../src/config/secure-config';

async function storeApiKey(key: string) {
  const config = SecureConfigManager.getInstance();
  await config.setApiKey(key);
  console.log('API key stored securely');
}

// Get key from command line
const key = process.argv[2];
if (!key) {
  console.error('Please provide the API key as an argument');
  process.exit(1);
}

storeApiKey(key).catch(console.error);
