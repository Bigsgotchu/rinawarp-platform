/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Rinawarp API',
      version: '1.0.0',
      description: 'A modern, AI-powered terminal that enhances developer productivity',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Commands', description: 'Command execution endpoints' },
      { name: 'History', description: 'Command history management' },
      { name: 'Analysis', description: 'Command analysis and predictions' },
      { name: 'Git', description: 'Git-specific operations' },
      { name: 'Docker', description: 'Docker management operations' },
      { name: 'Package', description: 'Package management operations' },
      { name: 'Profile', description: 'User profile management' },
    ],
    components: {
      schemas: {
        Command: {
          type: 'object',
          required: ['command'],
          properties: {
            command: { type: 'string', description: 'The command to execute' },
            args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
            cwd: { type: 'string', description: 'Working directory for command execution' },
          },
        },
        CommandResult: {
          type: 'object',
          properties: {
            output: { type: 'string' },
            exitCode: { type: 'number' },
            error: { type: 'string' },
          },
        },
        SystemState: {
          type: 'object',
          properties: {
            cpuLoad: { type: 'number' },
            memoryUsage: { type: 'number' },
            diskIO: { type: 'number' },
            networkIO: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        WorkflowPattern: {
          type: 'object',
          properties: {
            commands: { type: 'array', items: { type: 'string' } },
            frequency: { type: 'number' },
            successRate: { type: 'number' },
            averageDuration: { type: 'number' },
            commonContexts: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export default swaggerJsdoc(options);
