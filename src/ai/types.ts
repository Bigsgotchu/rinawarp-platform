export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'groq' | 'anthropic';
  maxTokens: number;
  supportsFunctions: boolean;
  supportsVision: boolean;
  costPerToken: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
}

export interface AIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required?: string[];
  };
}

export interface AIRequest {
  messages: AIMessage[];
  functions?: AIFunction[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AIResponse {
  id: string;
  message: AIMessage;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  model: AIModel;
}

export interface AIContext {
  messages: AIMessage[];
  functions?: AIFunction[];
  metadata?: Record<string, any>;
}

export interface AISuggestion {
  command: string;
  args: string[];
  description: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface AIHelp {
  description: string;
  examples: string[];
  related: string[];
  metadata?: Record<string, any>;
}

export interface AICompletion {
  completion: string;
  alternatives: string[];
  metadata?: Record<string, any>;
}
