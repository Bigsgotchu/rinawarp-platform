import { CacheService } from './cache';
import { CommandService } from './command';
import { logger } from '../../utils/logger';
import { config } from '../../config';

export interface AIModelResponse {
  text: string;
  confidence: number;
  alternatives?: string[];
}

export interface CommandContext {
  previousCommands: string[];
  currentDirectory: string;
  lastOutput?: string;
  lastError?: string;
  environmentVariables?: Record<string, string>;
}

export interface CodeContext {
  language: string;
  file: string;
  code: string;
  cursor: {
    line: number;
    column: number;
  };
}

export class AIService {
  private cache: CacheService;
  private commandService: CommandService;
  private readonly cachePrefix = 'ai:';
  private readonly cacheTTL = 3600; // 1 hour

  constructor() {
    this.cache = new CacheService();
    this.commandService = new CommandService();
  }

  /**
   * Get command suggestions
   */
  public async suggestCommands(
    partialCommand: string,
    context: CommandContext
  ): Promise<string[]> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}suggest:${partialCommand}:${context.currentDirectory}`;
      const cached = await this.cache.get<string[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get historical suggestions
      const historicalSuggestions = await this.commandService.getSuggestions(
        context.previousCommands[0], // Use most recent command for context
        partialCommand,
        context.currentDirectory
      );

      // Prepare prompt for AI model
      const prompt = {
        role: 'user',
        content: `Given the partial command "${partialCommand}" and previous commands ${JSON.stringify(context.previousCommands)}, suggest relevant command completions. Current directory: ${context.currentDirectory}`,
      };

      // Get AI suggestions
      const response = await this.callModel([prompt], {
        temperature: 0.3,
        max_tokens: 100,
        stop: ['\n'],
      });

      // Parse and combine suggestions
      const aiSuggestions = response.text
        .split(',')
        .map(s => s.trim())
        .filter(s => s.startsWith(partialCommand));

      // Combine and deduplicate suggestions
      const suggestions = Array.from(new Set([
        ...historicalSuggestions,
        ...aiSuggestions,
      ])).slice(0, 5); // Limit to top 5

      // Cache results
      await this.cache.set(cacheKey, suggestions, this.cacheTTL);

      return suggestions;
    } catch (error) {
      logger.error('Failed to get command suggestions:', error);
      return [];
    }
  }

  /**
   * Get command help
   */
  public async getCommandHelp(
    command: string,
    context: CommandContext
  ): Promise<AIModelResponse> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}help:${command}`;
      const cached = await this.cache.get<AIModelResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      // Prepare prompt
      const prompt = {
        role: 'user',
        content: `Explain the command "${command}" and provide examples of common usage. ${
          context.lastError ? `Consider this error context: ${context.lastError}` : ''
        }`,
      };

      // Get AI response
      const response = await this.callModel([prompt], {
        temperature: 0.7,
        max_tokens: 300,
      });

      // Cache response
      await this.cache.set(cacheKey, response, this.cacheTTL);

      return response;
    } catch (error) {
      logger.error('Failed to get command help:', error);
      return {
        text: 'Sorry, I could not generate help for this command.',
        confidence: 0,
      };
    }
  }

  /**
   * Get code completion
   */
  public async completeCode(
    context: CodeContext
  ): Promise<AIModelResponse> {
    try {
      // Prepare prompt
      const prompt = {
        role: 'user',
        content: `Complete the following ${context.language} code:\n\n${context.code}\n\nCursor position: Line ${context.cursor.line}, Column ${context.cursor.column}`,
      };

      // Get AI response
      const response = await this.callModel([prompt], {
        temperature: 0.2,
        max_tokens: 150,
        stop: ['\n\n'],
      });

      return response;
    } catch (error) {
      logger.error('Failed to complete code:', error);
      return {
        text: '',
        confidence: 0,
      };
    }
  }

  /**
   * Process natural language command
   */
  public async processNaturalLanguage(
    text: string,
    context: CommandContext
  ): Promise<AIModelResponse> {
    try {
      // Prepare prompt
      const prompt = {
        role: 'user',
        content: `Convert this natural language request into a command: "${text}"\nCurrent directory: ${context.currentDirectory}\nPrevious commands: ${JSON.stringify(context.previousCommands)}`,
      };

      // Get AI response
      const response = await this.callModel([prompt], {
        temperature: 0.3,
        max_tokens: 100,
        stop: ['\n'],
      });

      // Validate suggested command
      if (response.text && this.commandService.validateCommand(response.text)) {
        return response;
      }

      throw new Error('Invalid command suggestion');
    } catch (error) {
      logger.error('Failed to process natural language:', error);
      return {
        text: 'Sorry, I could not understand that request.',
        confidence: 0,
      };
    }
  }

  /**
   * Explain command output
   */
  public async explainOutput(
    command: string,
    output: string,
    error?: string
  ): Promise<AIModelResponse> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}explain:${command}:${output.slice(0, 100)}`;
      const cached = await this.cache.get<AIModelResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      // Prepare prompt
      const prompt = {
        role: 'user',
        content: `Explain this command output:\nCommand: ${command}\nOutput: ${output}${
          error ? `\nError: ${error}` : ''
        }`,
      };

      // Get AI response
      const response = await this.callModel([prompt], {
        temperature: 0.7,
        max_tokens: 200,
      });

      // Cache response
      await this.cache.set(cacheKey, response, this.cacheTTL);

      return response;
    } catch (error) {
      logger.error('Failed to explain output:', error);
      return {
        text: 'Sorry, I could not explain this output.',
        confidence: 0,
      };
    }
  }

  /**
   * Call AI model
   */
  private async callModel(
    messages: Array<{
      role: string;
      content: string;
    }>,
    options: {
      temperature?: number;
      max_tokens?: number;
      stop?: string[];
    } = {}
  ): Promise<AIModelResponse> {
    try {
      // Make API request to AI model
      const response = await fetch(config.ai.modelEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.ai.apiKey}`,
        },
        body: JSON.stringify({
          model: config.ai.modelName,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 150,
          stop: options.stop,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI model request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        text: data.choices[0].message.content,
        confidence: data.choices[0].confidence || 1,
        alternatives: data.choices.slice(1).map((c: any) => c.message.content),
      };
    } catch (error) {
      logger.error('Failed to call AI model:', error);
      throw error;
    }
  }

  /**
   * Get shell environment recommendations
   */
  public async getEnvironmentRecommendations(
    context: CommandContext
  ): Promise<AIModelResponse> {
    try {
      // Prepare prompt
      const prompt = {
        role: 'user',
        content: `Based on these commands ${JSON.stringify(context.previousCommands)}, suggest shell environment improvements (aliases, environment variables, etc.).`,
      };

      // Get AI response
      const response = await this.callModel([prompt], {
        temperature: 0.7,
        max_tokens: 200,
      });

      return response;
    } catch (error) {
      logger.error('Failed to get environment recommendations:', error);
      return {
        text: 'Sorry, I could not generate recommendations.',
        confidence: 0,
      };
    }
  }

  /**
   * Get error resolution suggestions
   */
  public async getSolutionSuggestions(
    error: string,
    context: CommandContext
  ): Promise<AIModelResponse> {
    try {
      // Prepare prompt
      const prompt = {
        role: 'user',
        content: `Suggest solutions for this error:\n${error}\n\nContext:\nCommand: ${context.previousCommands[0]}\nDirectory: ${context.currentDirectory}`,
      };

      // Get AI response
      const response = await this.callModel([prompt], {
        temperature: 0.7,
        max_tokens: 300,
      });

      return response;
    } catch (error) {
      logger.error('Failed to get solution suggestions:', error);
      return {
        text: 'Sorry, I could not generate solution suggestions.',
        confidence: 0,
      };
    }
  }
}
