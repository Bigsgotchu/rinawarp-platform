import express from 'express';
import winston from 'winston';

// Simple logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});

export default app;
