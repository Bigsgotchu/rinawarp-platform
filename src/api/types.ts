import { AuthPayload } from '../types/auth';

export interface TerminalAuth {
  apiKey: string;
  userId: string;
}

export interface UsageData {
  requests: number;
  tokenCount: number;
  completionTokens: number;
  promptTokens: number;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
}

export interface BaseRequest {
  auth?: AuthPayload;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface BaseResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
}
