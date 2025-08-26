import swaggerUi from 'swagger-ui-express';
import { join } from 'path';
import { Express } from 'express';
import YAML from 'yaml';
import { readFileSync } from 'fs';

/**
 * Setup Swagger documentation for the API
 */
export function setupApiDocs(app: Express) {
  try {
    // Load OpenAPI spec files
    const analyticsSpec = YAML.parse(
      readFileSync(join(__dirname, 'openapi/analytics.yaml'), 'utf8')
    );

    // Combine specs if needed
    const fullSpec = {
      ...analyticsSpec,
      // Add any additional API specs here
    };

    // Serve Swagger UI
    app.use(
      '/docs/api',
      swaggerUi.serve,
      swaggerUi.setup(fullSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Rinawarp API Documentation',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: true,
          tagsSorter: 'alpha',
          operationsSorter: 'alpha',
        },
      })
    );

    // Serve raw OpenAPI spec for tools consumption
    app.get('/docs/api/spec', (req, res) => {
      res.setHeader('Content-Type', 'application/yaml');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="openapi-spec.yaml"'
      );
      res.send(YAML.stringify(fullSpec));
    });
  } catch (error) {
    console.error('Failed to setup API documentation:', error);
    throw error;
  }
}
