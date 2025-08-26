import { logger } from '@rinawarp/shared';
import { CacheService } from '@rinawarp/core';
import axios from 'axios';
import { AIContext, AIOptions, AIResponse } from './types';

export class AIService {
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
    options: AIOptions = {},
    context?: AIContext
  ): Promise<AIResponse> {
    try {
      const cacheKey = `ai_response:${Buffer.from(prompt + JSON.stringify(context || {})).toString('base64')}`;
      const cached = await this.cache.get<AIResponse>(cacheKey);
      if (cached) return cached;

      const response = await axios.post<any>(
        this.endpoint,
        {
          prompt,
          context,
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

  public async analyzeCommand(
    command: string,
    context?: {
      previousCommands?: string[];
      currentDirectory?: string;
    }
  ): Promise<{ suggestion: string; nextCommands?: string[] }> {
    try {
      const cacheKey = `command_analysis:${Buffer.from(command + JSON.stringify(context || {})).toString('base64')}`;
      const cached = await this.cache.get<{ suggestion: string; nextCommands?: string[] }>(cacheKey);
      if (cached) return cached;

      const response = await this.generateResponse(
        command,
        {
          temperature: 0.7,
          maxTokens: 200,
        },
        {
          previousCommands: context?.previousCommands,
          currentDirectory: context?.currentDirectory,
        }
      );

      const result = {
        suggestion: response.text,
        nextCommands: response.text
          .split('\n')
          .filter((line) => line.trim().startsWith('$'))
          .map((line) => line.trim().slice(2)),
      };

      await this.cache.set(cacheKey, result, 3600); // Cache for 1 hour
      return result;
    } catch (error) {
      logger.error('Error analyzing command:', error);
      throw error;
    }
  }
}

export default AIService;
