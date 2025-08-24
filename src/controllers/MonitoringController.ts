import { Request, Response } from 'express';
import { MonitoringService } from '../services/MonitoringService';
import logger from '../utils/logger';

class MonitoringController {
  private monitoringService: MonitoringService;

  constructor() {
    this.monitoringService = MonitoringService.getInstance();
  }

  /**
   * Get detailed health status of the application
   */
  public getHealth = async (req: Request, res: Response) => {
    try {
      const health = await this.monitoringService.getHealthStatus();
      res.json(health);
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Simple liveness probe endpoint
   */
  public getLiveness = (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Get system metrics
   */
  public getMetrics = async (req: Request, res: Response) => {
    try {
      const metrics = await this.monitoringService.collectMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to collect metrics', { error });
      res.status(500).json({
        status: 'error',
        message: 'Failed to collect metrics',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

export default new MonitoringController();
