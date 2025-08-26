import { ApiClient } from './client';
import type { TerminalAuth, UsageData } from './types';
import logger from '../utils/logger';

export class TerminalApiClient {
  private static instance: TerminalApiClient;
  private readonly baseClient: ApiClient;

  private constructor(baseURL?: string) {
    this.baseClient = ApiClient.getInstance(baseURL);
    // Add terminal-specific headers
    this.baseClient.setApiKey('terminal-client');
  }

  public static getInstance(baseURL?: string): TerminalApiClient {
    if (!TerminalApiClient.instance) {
      TerminalApiClient.instance = new TerminalApiClient(baseURL);
    }
    return TerminalApiClient.instance;
  }

  public setApiKey(apiKey: string): void {
    this.baseClient.setApiKey(apiKey);
  }

  public clearApiKey(): void {
    this.baseClient.clearApiKey();
  }

  // Auth endpoints
  public async login(email: string, password: string): Promise<TerminalAuth> {
    return this.post<TerminalAuth>('/terminal/auth/login', { email, password });
  }

  public async validateAuth(token: string): Promise<boolean> {
    try {
      await this.post('/terminal/auth/validate', { token });
      return true;
    } catch (error) {
      logger.error('Auth validation failed:', error);
      return false;
    }
  }

  public async refreshToken(refreshToken: string): Promise<TerminalAuth> {
    return this.post<TerminalAuth>('/terminal/auth/refresh', { refreshToken });
  }

  // User endpoints
  public async getUser(): Promise<TerminalAuth['user']> {
    const response = await this.get<{ user: TerminalAuth['user'] }>(
      '/terminal/user'
    );
    return response.user;
  }

  // Usage tracking
  public async trackUsage(data: UsageData): Promise<void> {
    await this.post('/terminal/usage', data);
  }

  public async batchTrackUsage(data: UsageData[]): Promise<void> {
    await this.post('/terminal/usage/batch', { items: data });
  }

  // Feature endpoints
  public async getFeatures(): Promise<string[]> {
    const response = await this.get<{ features: string[] }>(
      '/terminal/features'
    );
    return response.features;
  }

  public async validateFeature(feature: string): Promise<boolean> {
    try {
      await this.post('/terminal/features/validate', { feature });
      return true;
    } catch {
      return false;
    }
  }

  // HTTP method implementations
  public async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    return this.baseClient.get<T>(path, params);
  }

  public async post<T>(path: string, data?: any): Promise<T> {
    return this.baseClient.post<T>(path, data);
  }

  public async put<T>(path: string, data?: any): Promise<T> {
    return this.baseClient.put<T>(path, data);
  }

  public async delete<T>(path: string): Promise<T> {
    return this.baseClient.delete<T>(path);
  }
}

export default TerminalApiClient.getInstance();
