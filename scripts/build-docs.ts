/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import swaggerJsdoc from 'swagger-jsdoc';
import { execSync } from 'child_process';

const buildDocs = async () => {
  try {
    console.log('Building API documentation...');

    // Swagger options
    const options = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'RinaWarp API Documentation',
          version: '1.0.0',
          description: 'API documentation for the RinaWarp terminal application',
        },
        servers: [
          {
            url: process.env.DOCS_BASE_URL || 'http://localhost:3000',
            description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
      apis: ['./src/routes/*.ts', './src/routes/**/*.ts'],
    };

    // Generate documentation
    const swaggerSpec = swaggerJsdoc(options);

    // Ensure the docs directory exists
    const docsDir = path.join(__dirname, '../src/docs/openapi');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    // Write OpenAPI specification
    fs.writeFileSync(
      path.join(docsDir, 'openapi.yaml'),
      YAML.stringify(swaggerSpec)
    );

    // Write OpenAPI specification as JSON
    fs.writeFileSync(
      path.join(docsDir, 'openapi.json'),
      JSON.stringify(swaggerSpec, null, 2)
    );

    // Generate static documentation
    const staticDocsDir = path.join(__dirname, '../public/docs');
    if (!fs.existsSync(staticDocsDir)) {
      fs.mkdirSync(staticDocsDir, { recursive: true });
    }

    // You could use a tool like @redocly/cli to generate static documentation
    // execSync('npx @redocly/cli build-docs src/docs/openapi/openapi.yaml -o public/docs/index.html');

    console.log('API documentation built successfully!');
  } catch (error) {
    console.error('Failed to build documentation:', error);
    process.exit(1);
  }
};

buildDocs();
