/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.production' });

const deploy = async () => {
  try {
    console.log('Starting deployment process...');

    // Run tests
    console.log('Running tests...');
    execSync('npm run test:ci', { stdio: 'inherit' });

    // Build the application
    console.log('Building application...');
    execSync('npm run build', { stdio: 'inherit' });

    // Run database migrations
    console.log('Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    // Build OpenAPI documentation
    console.log('Generating API documentation...');
    execSync('npm run docs:build', { stdio: 'inherit' });

    // Clear Redis cache
    if (process.env.REDIS_URL) {
      console.log('Clearing Redis cache...');
      execSync('npm run cache:clear', { stdio: 'inherit' });
    }

    // Restart PM2 processes
    console.log('Restarting application...');
    execSync('pm2 reload ecosystem.config.js --env production', { stdio: 'inherit' });

    console.log('Deployment completed successfully!');
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
};

deploy();
