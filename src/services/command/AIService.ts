import axios from 'axios';
import logger from '../../utils/logger';
import { CacheService } from '../cache';

export interface AIResponse {
  text: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

class AIService {
  private static instance: AIService;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private cache: CacheService;

  private constructor() {
    this.apiKey = process.env.AI_MODEL_API_KEY || '';
    this.endpoint = process.env.AI_MODEL_ENDPOINT || 'https://api.example.com/v1';
    this.cache = CacheService.getInstance();
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  public async generateResponse(
    prompt: string,
    options: AIOptions = {}
  ): Promise<AIResponse> {
    try {
      const cacheKey = `ai_response:${Buffer.from(prompt).toString('base64')}`;
      const cached = await this.cache.get<AIResponse>(cacheKey);
      if (cached) return cached;

      const response = await axios.post(
        this.endpoint,
        {
          prompt,
          ...options,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      const result: AIResponse = {
        text: response.data.choices[0].text,
        tokens: {
          prompt: response.data.usage.prompt_tokens,
          completion: response.data.usage.completion_tokens,
          total: response.data.usage.total_tokens,
        },
      };

      await this.cache.set(cacheKey, result, 3600); // Cache for 1 hour
      return result;
    } catch (error) {
      logger.error('Error generating AI response:', error);
      throw error;
    }
  }
}

export { AIService };
export default AIService;
