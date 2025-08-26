import { UsageType } from '@prisma/client';
import TerminalApi from './api/TerminalApi';
import logger from '../utils/logger';

export interface UsageMetadata {
  duration?: number;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  [key: string]: any;
}

class UsageTrackingService {
  private static instance: UsageTrackingService;
  private batchQueue: Array<{
    type: string;
    quantity: number;
    metadata?: UsageMetadata;
  }> = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    // Set up periodic flush of usage data
    setInterval(() => this.flushBatch(), 60000); // Flush every minute
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
    metadata?: UsageMetadata
  ): Promise<void> {
    try {
      // Add to batch queue
      this.batchQueue.push({ type, quantity, metadata });

      // If queue is getting large, flush immediately
      if (this.batchQueue.length >= 50) {
        await this.flushBatch();
      } else {
        // Schedule a flush if not already scheduled
        this.scheduleBatchFlush();
      }
    } catch (error) {
      logger.error('Failed to track usage:', error);
      throw error;
    }
  }

  public async trackTokenUsage(
    promptTokens: number,
    completionTokens: number
  ): Promise<void> {
    try {
      await Promise.all([
        this.trackUsage(UsageType.PROMPT_TOKENS, promptTokens),
        this.trackUsage(UsageType.COMPLETION_TOKENS, completionTokens),
      ]);
    } catch (error) {
      logger.error('Failed to track token usage:', error);
      throw error;
    }
  }

  private scheduleBatchFlush() {
    if (this.batchTimeout) return;

    this.batchTimeout = setTimeout(() => {
      this.flushBatch().catch(error => {
        logger.error('Failed to flush usage batch:', error);
      });
    }, 5000); // Flush after 5 seconds of inactivity
  }

  private async flushBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    try {
      // Aggregate similar events
      const aggregated = batch.reduce(
        (acc, curr) => {
          const key = curr.type;
          if (!acc[key]) {
            acc[key] = { ...curr };
          } else {
            acc[key].quantity += curr.quantity;
            // Merge metadata if needed
            if (curr.metadata) {
              acc[key].metadata = {
                ...acc[key].metadata,
                ...curr.metadata,
              };
            }
          }
          return acc;
        },
        {} as Record<string, (typeof batch)[0]>
      );

      // Send aggregated data to API
      await Promise.all(
        Object.values(aggregated).map(usage =>
          TerminalApi.trackUsage({
            type: usage.type,
            quantity: usage.quantity,
            metadata: usage.metadata,
          })
        )
      );
    } catch (error) {
      logger.error('Failed to flush usage batch:', error);
      // Add failed events back to queue
      this.batchQueue = [...batch, ...this.batchQueue];
      throw error;
    }
  }
}

export default UsageTrackingService.getInstance();
