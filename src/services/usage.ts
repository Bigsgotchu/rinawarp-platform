import { UsageData } from '../api/types';
import { TerminalApiClient } from '../api/terminal';
import { env } from '../config/env';
import logger from '../utils/logger';

export class UsageTrackingService {
  private static instance: UsageTrackingService;
  private batchQueue: UsageData[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private isProcessing = false;

  private constructor() {
    // Set up periodic flush of usage data
    if (env.BATCH_USAGE_TRACKING) {
      setInterval(() => this.flushBatch(), env.USAGE_BATCH_INTERVAL);
    }
  }

  public static getInstance(): UsageTrackingService {
    if (!UsageTrackingService.instance) {
      UsageTrackingService.instance = new UsageTrackingService();
    }
    return UsageTrackingService.instance;
  }

  public async trackUsage(
    type: string,
    quantity: number = 1,
    metadata?: UsageData['metadata']
  ): Promise<void> {
    if (!env.ENABLE_USAGE_TRACKING) {
      return;
    }

    const usageData: UsageData = {
      type,
      quantity,
      metadata,
    };

    if (env.BATCH_USAGE_TRACKING) {
      this.queueUsage(usageData);
    } else {
      await this.sendUsage(usageData);
    }
  }

  public async trackTokenUsage(
    promptTokens: number,
    completionTokens: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await Promise.all([
      this.trackUsage('prompt_tokens', promptTokens, metadata),
      this.trackUsage('completion_tokens', completionTokens, metadata),
    ]);
  }

  private queueUsage(data: UsageData): void {
    this.batchQueue.push(data);

    // If queue is getting large, flush immediately
    if (this.batchQueue.length >= env.USAGE_BATCH_SIZE) {
      this.flushBatch().catch((error) => {
        logger.error('Failed to flush usage batch:', error);
      });
    } else {
      // Schedule a flush if not already scheduled
      this.scheduleBatchFlush();
    }
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimeout || this.isProcessing) {
      return;
    }

    this.batchTimeout = setTimeout(() => {
      this.flushBatch().catch((error) => {
        logger.error('Failed to flush usage batch:', error);
      });
    }, env.USAGE_BATCH_INTERVAL);
  }

  private async flushBatch(): Promise<void> {
    if (this.isProcessing || this.batchQueue.length === 0) {
      return;
    }

    try {
      this.isProcessing = true;

      // Clear timeout if it exists
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }

      // Get current batch and clear queue
      const batch = [...this.batchQueue];
      this.batchQueue = [];

      // Aggregate similar events
      const aggregated = this.aggregateBatch(batch);

      // Send aggregated data
      await TerminalApiClient.getInstance().batchTrackUsage(
        Object.values(aggregated)
      );
    } catch (error) {
      logger.error('Failed to flush usage batch:', error);
      // Add failed events back to queue
      this.batchQueue = [...this.batchQueue, ...batch];
    } finally {
      this.isProcessing = false;
    }
  }

  private aggregateBatch(
    batch: UsageData[]
  ): Record<string, UsageData> {
    return batch.reduce((acc, curr) => {
      const key = `${curr.type}:${JSON.stringify(curr.metadata || {})}`;
      
      if (!acc[key]) {
        acc[key] = { ...curr };
      } else {
        acc[key].quantity += curr.quantity;
      }
      
      return acc;
    }, {} as Record<string, UsageData>);
  }

  private async sendUsage(data: UsageData): Promise<void> {
    try {
      await TerminalApiClient.getInstance().trackUsage(data);
    } catch (error) {
      logger.error('Failed to track usage:', error);
      throw error;
    }
  }

  // Monitoring methods
  public getQueueSize(): number {
    return this.batchQueue.length;
  }

  public isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  public async forceFlush(): Promise<void> {
    await this.flushBatch();
  }
}

export default UsageTrackingService.getInstance();
