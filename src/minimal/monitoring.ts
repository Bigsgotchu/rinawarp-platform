import os from 'os';
import { performance } from 'perf_hooks';
import logger from './logger';

export class MonitoringService {
  private static instance: MonitoringService;
  private startTime: number;
  private metricsInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startTime = Date.now();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  public startMetricsCollection(interval: number = 60000) {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error('Error collecting metrics:', error);
      });
    }, interval);
  }

  public stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  public async collectMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          processUsage: process.memoryUsage(),
        },
        cpu: {
          load: os.loadavg(),
          cores: os.cpus().length,
        },
      },
      process: {
        uptime: (Date.now() - this.startTime) / 1000,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };

    logger.info('System metrics collected', { metrics });
    return metrics;
  }

  public async getHealthStatus(): Promise<Record<string, any>> {
    try {
      const metrics = await this.collectMetrics();
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        system: {
          memory: {
            total: metrics.system.memory.total,
            free: metrics.system.memory.free,
            used: metrics.system.memory.used,
            usagePercent: ((metrics.system.memory.used / metrics.system.memory.total) * 100).toFixed(2) + '%',
          },
          cpu: {
            load: metrics.system.cpu.load,
            cores: metrics.system.cpu.cores,
          },
        },
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      throw error;
    }
  }
}
