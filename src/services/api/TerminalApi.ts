import ApiClient from './ApiClient';
import { TerminalAuth } from '../../auth/types';

export interface UsageData {
  type: string;
  quantity: number;
  metadata?: Record<string, any>;
}

export class TerminalApi {
  private static instance: TerminalApi;

  private constructor() {}

  public static getInstance(): TerminalApi {
    if (!TerminalApi.instance) {
      TerminalApi.instance = new TerminalApi();
    }
    return TerminalApi.instance;
  }

  public async login(email: string, password: string): Promise<TerminalAuth> {
    return ApiClient.post<TerminalAuth>('/terminal/auth/login', {
      email,
      password,
    });
  }

  public async validateAuth(token: string): Promise<boolean> {
    try {
      await ApiClient.post('/terminal/auth/validate', { token });
      return true;
    } catch {
      return false;
    }
  }

  public async trackUsage(data: UsageData): Promise<void> {
    await ApiClient.post('/terminal/usage', data);
  }

  public async getUser(): Promise<TerminalAuth['user']> {
    const response = await ApiClient.get<{ user: TerminalAuth['user'] }>(
      '/terminal/user'
    );
    return response.user;
  }
}

export default TerminalApi.getInstance();
