import { EventEmitter } from 'events';
import { env } from '../config/env';
import logger from '../utils/logger';

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy';
  message?: string;
  timestamp: number;
  latency?: number;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  latency: number;
  errors: number;
  requests: number;
}

class MonitoringService extends EventEmitter {
  private static instance: MonitoringService;
  private metrics: Map<string, MetricPoint[]> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private metricsRetention = env.METRICS_RETENTION || 3600 * 24; // 24 hours
  private isCollecting = false;

  private constructor() {
    super();
    this.startMetricsCollection();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // Metrics collection
  public recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    const point: MetricPoint = {
      name,
      value,
      timestamp: Date.now(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(point);
    this.emit('metric', point);

    // Clean up old metrics
    this.cleanupMetrics(name);
  }

  public getMetrics(
    name: string,
    timeRange?: { start: number; end: number }
  ): MetricPoint[] {
    const points = this.metrics.get(name) || [];
    
    if (!timeRange) {
      return points;
    }

    return points.filter(
      (point) => point.timestamp >= timeRange.start && point.timestamp <= timeRange.end
    );
  }

  // Health checks
  public recordHealthCheck(check: Omit<HealthCheck, 'timestamp'>): void {
    const healthCheck: HealthCheck = {
      ...check,
      timestamp: Date.now(),
    };

    this.healthChecks.set(check.name, healthCheck);
    this.emit('health', healthCheck);

    if (healthCheck.status === 'unhealthy') {
      logger.warn(`Health check failed: ${check.name}`, {
        check: healthCheck,
      });
    }
  }

  public getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  public isHealthy(): boolean {
    return Array.from(this.healthChecks.values()).every(
      (check) => check.status === 'healthy'
    );
  }

  // System metrics
  public async getSystemMetrics(): Promise<SystemMetrics> {
    const metrics = {
      cpu: await this.getCpuUsage(),
      memory: await this.getMemoryUsage(),
      latency: this.getAverageLatency(),
      errors: this.getErrorRate(),
      requests: this.getRequestRate(),
    };

    this.emit('system', metrics);
    return metrics;
  }

  // Private methods
  private cleanupMetrics(name: string): void {
    const points = this.metrics.get(name);
    if (!points) return;

    const cutoff = Date.now() - this.metricsRetention * 1000;
    const filtered = points.filter((point) => point.timestamp >= cutoff);
    this.metrics.set(name, filtered);
  }

  private startMetricsCollection(): void {
    if (this.isCollecting) return;
    this.isCollecting = true;

    const interval = env.METRICS_INTERVAL || 60000; // 1 minute
    setInterval(async () => {
      try {
        const metrics = await this.getSystemMetrics();
        Object.entries(metrics).forEach(([name, value]) => {
          this.recordMetric(`system.${name}`, value);
        });
      } catch (error) {
        logger.error('Failed to collect system metrics:', error);
      }
    }, interval);
  }

  private async getCpuUsage(): Promise<number> {
    try {
      const usage = process.cpuUsage();
      return (usage.user + usage.system) / 1000000; // Convert to seconds
    } catch (error) {
      logger.error('Failed to get CPU usage:', error);
      return 0;
    }
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      const usage = process.memoryUsage();
      return usage.heapUsed / 1024 / 1024; // Convert to MB
    } catch (error) {
      logger.error('Failed to get memory usage:', error);
      return 0;
    }
  }

  private getAverageLatency(): number {
    const latencyPoints = this.getMetrics('request.latency', {
      start: Date.now() - 60000, // Last minute
      end: Date.now(),
    });

    if (latencyPoints.length === 0) return 0;

    const sum = latencyPoints.reduce((acc, point) => acc + point.value, 0);
    return sum / latencyPoints.length;
  }

  private getErrorRate(): number {
    const timeRange = {
      start: Date.now() - 60000, // Last minute
      end: Date.now(),
    };

    const errors = this.getMetrics('request.error', timeRange).length;
    const total = this.getMetrics('request.total', timeRange).length;

    return total === 0 ? 0 : (errors / total) * 100;
  }

  private getRequestRate(): number {
    const requests = this.getMetrics('request.total', {
      start: Date.now() - 60000, // Last minute
      end: Date.now(),
    }).length;

    return requests / 60; // Requests per second
  }
}

export default MonitoringService.getInstance();
