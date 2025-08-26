import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { HistoryEntry, CommandResult } from '../types';
import logger from '../utils/logger';

class HistoryService {
  private redis: Redis;
  private readonly HISTORY_KEY = 'command_history';
  private readonly MAX_HISTORY = 1000;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async addEntry(
    command: string,
    result: CommandResult
  ): Promise<HistoryEntry> {
    const entry: HistoryEntry = {
      id: uuidv4(),
      command,
      timestamp: new Date(),
      result,
    };

    try {
      await this.redis.lpush(this.HISTORY_KEY, JSON.stringify(entry));
      await this.redis.ltrim(this.HISTORY_KEY, 0, this.MAX_HISTORY - 1);
      return entry;
    } catch (error) {
      logger.error('Failed to add history entry:', error);
      throw error;
    }
  }

  async getHistory(limit = 50, offset = 0): Promise<HistoryEntry[]> {
    try {
      const entries = await this.redis.lrange(
        this.HISTORY_KEY,
        offset,
        offset + limit - 1
      );
      return entries.map(entry => JSON.parse(entry));
    } catch (error) {
      logger.error('Failed to get history:', error);
      throw error;
    }
  }

  async searchHistory(query: string): Promise<HistoryEntry[]> {
    try {
      const entries = await this.redis.lrange(this.HISTORY_KEY, 0, -1);
      return entries
        .map(entry => JSON.parse(entry))
        .filter((entry: HistoryEntry) =>
          entry.command.toLowerCase().includes(query.toLowerCase())
        );
    } catch (error) {
      logger.error('Failed to search history:', error);
      throw error;
    }
  }
}

export default new HistoryService();
