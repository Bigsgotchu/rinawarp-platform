import { APIServer } from './server';
import { logger } from '@rinawarp/shared';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || 'localhost';
const CORS_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

async function start() {
  try {
    const server = new APIServer({
      port: PORT,
      host: HOST,
      enableDocs: true,
      enableMetrics: true,
      cors: {
        origin: CORS_ORIGIN,
        credentials: true,
      },
    });

    await server.start();
    logger.info(`API server started on http://${HOST}:${PORT}`);
  } catch (error) {
    logger.error('Failed to start API server:', error);
    process.exit(1);
  }
}

start();
