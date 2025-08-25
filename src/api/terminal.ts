import { ApiClient } from './client';
import { TerminalAuth, UsageData } from './types';
import logger from '../utils/logger';

export class TerminalApiClient extends ApiClient {
  private static instance: TerminalApiClient;

  private constructor() {
    super();
    // Add terminal-specific headers
    this.client.defaults.headers.common['x-client-type'] = 'terminal';
  }

  public static override getInstance(): TerminalApiClient {
    if (!TerminalApiClient.instance) {
      TerminalApiClient.instance = new TerminalApiClient();
    }
    return TerminalApiClient.instance;
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
    const response = await this.get<{ user: TerminalAuth['user'] }>('/terminal/user');
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
    const response = await this.get<{ features: string[] }>('/terminal/features');
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
}

export default TerminalApiClient.getInstance();
