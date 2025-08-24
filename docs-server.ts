import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Parse OpenAPI spec
const specPath = path.join(__dirname, 'src/docs/openapi/analytics.yaml');
const spec = YAML.parse(fs.readFileSync(specPath, 'utf8'));

// Configure Swagger UI
const options = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'RinaWarp API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
  },
};

// Serve Swagger UI
app.use('/docs/api', swaggerUi.serve, swaggerUi.setup(spec, options));

// Serve raw spec
app.get('/docs/api/spec', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/yaml');
  res.setHeader('Content-Disposition', 'attachment; filename=\"openapi-spec.yaml\"');
  res.send(YAML.stringify(spec));
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`API documentation server running on port ${port}`);
});
