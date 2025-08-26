/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import base from './base';

export default {
  ...base,
  server: {
    ...base.server,
    cors: {
      ...base.server.cors,
      // In production, only allow specific origins
      origin: process.env.CORS_ORIGIN?.split(',') || [],
    },
  },

  // Production overrides
  security: {
    ...base.security,
    enableCSRF: true,
    trustProxy: true, // Required when running behind a reverse proxy
    bcryptSaltRounds: 12, // Higher rounds for production
  },

  monitoring: {
    ...base.monitoring,
    logLevel: 'error', // Less verbose logging in production
    enableRequestLogging: true,
  },

  // Production database settings
  database: {
    ...base.database,
    ssl: true, // Require SSL in production
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10), // Higher connection limit
  },

  // Production Redis settings
  redis: {
    ...base.redis,
    tls: true, // Require TLS in production
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
  },

  // Cache settings
  cache: {
    ttl: 3600, // 1 hour default TTL
    maxSize: 1000, // Maximum number of items in memory cache
  },

  // Performance tuning
  performance: {
    compression: true,
    etag: true,
    cacheControl: true,
  },
};
