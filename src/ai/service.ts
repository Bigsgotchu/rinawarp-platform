import { EventEmitter } from 'events';
import {
  AIModel,
  AIMessage,
  AIFunction,
  AIRequest,
  AIResponse,
  AIContext,
  AISuggestion,
  AIHelp,
  AICompletion,
} from './types';
import { TerminalApiClient } from '../api/terminal';
import UsageTrackingService from '../services/usage';
import AnalyticsService from '../services/analytics';
import logger from '../utils/logger';

export class AIService extends EventEmitter {
  private static instance: AIService;
  private context: AIContext = {
    messages: [],
    metadata: {},
  };
  private readonly maxContextMessages = 50;
  private readonly defaultModel: AIModel = {
    id: 'groq-mixtral-8x7b',
    name: 'Mixtral-8x7B',
    provider: 'groq',
    maxTokens: 32768,
    supportsFunctions: true,
    supportsVision: false,
    costPerToken: 0.0001,
  };

  private constructor() {
    super();
    this.setupSystemMessage();
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  public async chat(
    message: string,
    functions?: AIFunction[],
    context?: Partial<AIContext>
  ): Promise<AIResponse> {
    try {
      // Add user message to context
      this.addMessage({
        role: 'user',
        content: message,
      });

      // Prepare request
      const request: AIRequest = {
        messages: this.context.messages,
        functions,
        model: this.defaultModel.id,
      };

      // Send request to API
const response = await TerminalApiClient.getInstance().post<AIResponse>(
        '/terminal/ai/chat',
        request
      );

      // Add response to context
      this.addMessage(response.message);

      // Track usage
      this.trackUsage(response);

      return response;
    } catch (error) {
      logger.error('AI chat failed:', error);
      throw error;
    }
  }

  public async getSuggestions(
    input: string,
    context?: AIContext
  ): Promise<AISuggestion[]> {
    try {
const response = await TerminalApiClient.getInstance().post<AISuggestion[]>(
        '/terminal/ai/suggest',
        {
          input,
          context: context || this.context,
        }
      );

      // Track suggestions
      AnalyticsService.trackEvent('ai.suggestions', {
        input,
        suggestions: response.length,
      });

      return response;
    } catch (error) {
      logger.error('Failed to get suggestions:', error);
      return [];
    }
  }

  public async getHelp(
    command: string,
    context?: AIContext
  ): Promise<AIHelp> {
    try {
const response = await TerminalApiClient.getInstance().post<AIHelp>(
        '/terminal/ai/help',
        {
          command,
          context: context || this.context,
        }
      );

      // Track help request
      AnalyticsService.trackEvent('ai.help', {
        command,
      });

      return response;
    } catch (error) {
      logger.error('Failed to get help:', error);
      throw error;
    }
  }

  public async getCompletion(
    input: string,
    context?: AIContext
  ): Promise<AICompletion> {
    try {
const response = await TerminalApiClient.getInstance().post<AICompletion>(
        '/terminal/ai/complete',
        {
          input,
          context: context || this.context,
        }
      );

      // Track completion
      AnalyticsService.trackEvent('ai.completion', {
        input,
        alternatives: response.alternatives.length,
      });

      return response;
    } catch (error) {
      logger.error('Failed to get completion:', error);
      throw error;
    }
  }

  public getContext(): AIContext {
    return { ...this.context };
  }

  public clearContext(): void {
    this.context = {
      messages: [],
      metadata: {},
    };
    this.setupSystemMessage();
  }

  private setupSystemMessage(): void {
    this.addMessage({
      role: 'system',
      content: `You are an AI assistant in the RinaWarp terminal. Help users with:
- Command suggestions and explanations
- Task automation and scripting
- Debugging and troubleshooting
- Development workflows
- Best practices and patterns

Be concise and focus on practical solutions. Use markdown for formatting when helpful.`,
    });
  }

  private addMessage(message: AIMessage): void {
    this.context.messages.push(message);

    // Trim context if too long
    if (this.context.messages.length > this.maxContextMessages) {
      // Keep system message and trim oldest messages
      const systemMessage = this.context.messages[0];
      this.context.messages = [
        systemMessage,
        ...this.context.messages.slice(-(this.maxContextMessages - 1)),
      ];
    }

    this.emit('message', message);
  }

  private trackUsage(response: AIResponse): void {
    // Track token usage
    UsageTrackingService.trackTokenUsage(
      response.usage.promptTokens,
      response.usage.completionTokens,
      {
        model: response.model.id,
        cost: response.usage.cost,
      }
    );

    // Track analytics
    AnalyticsService.trackEvent('ai.chat', {
      model: response.model.id,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      cost: response.usage.cost,
    });
  }
}

export default AIService.getInstance();
