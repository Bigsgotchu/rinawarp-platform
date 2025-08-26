import { SubscriptionPlan } from './auth';

// Generic API response format
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// API error types
export interface ApiError extends Error {
  code: string;
  statusCode: number;
  details?: any;
}

// Terminal API types
export interface TerminalAuth {
  apiKey: string;
  userId: string;
  plan: SubscriptionPlan;
}

export interface UsageData {
  commandCount: number;
  workflowCount: number;
  lastActivity: Date;
  features: string[];
}

export interface TerminalConfig {
  defaultShell: string;
  promptTemplate: string;
  aiAssistance: boolean;
  theme: 'light' | 'dark';
}

// Auth Headers
export interface AuthHeaders {
  'x-api-key'?: string;
  authorization?: string;
}

// Rate Limit Response Headers
export interface RateLimitHeaders {
  'x-ratelimit-limit': string;
  'x-ratelimit-remaining': string;
  'x-ratelimit-reset': string;
}

// Common request query parameters
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface DateRangeQuery {
  start?: string;
  end?: string;
}

// Webhook Event Types
export type WebhookEventType = 
  | 'auth.login'
  | 'auth.logout' 
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.deleted'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted';

export interface WebhookEvent<T = any> {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  data: T;
}
