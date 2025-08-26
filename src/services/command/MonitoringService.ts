import logger from '../../utils/logger';

export class MonitoringService {
  static getInstance() {
    return new MonitoringService();
  }

  async trackError(error: Error, context?: any) {
    logger.error('Error tracked:', error, context);
  }

  async trackMetric(name: string, value: number, tags?: Record<string, string>) {
    logger.info('Metric tracked:', { name, value, tags });
  }

  async healthCheck() {
    return { status: 'ok' };
  }
}
