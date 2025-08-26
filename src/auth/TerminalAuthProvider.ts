import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse } from '../api/types';
import type { TerminalAuth } from './types';

export interface WebsiteAPIConfig {
  baseUrl: string;
  timeout?: number;
}

export class TerminalAuthProvider {
  private static instance: TerminalAuthProvider;
  private client: AxiosInstance;
  private auth: TerminalAuth | null = null;

  private constructor(config: WebsiteAPIConfig) {
    this.client = axios.create({
      // @ts-ignore: Type mismatch with axios.create return type
      baseURL: config.baseUrl,
      timeout: config.timeout,
    });

    this.client.interceptors.request.use((config: AxiosRequestConfig) => {
      if (this.auth?.apiKey) {
        config.headers['x-api-key'] = this.auth.apiKey;
      }
      return config;
    });
  }

  public static getInstance(config?: WebsiteAPIConfig): TerminalAuthProvider {
    if (!TerminalAuthProvider.instance) {
      if (!config) {
        throw new Error('Config required for initialization');
      }
      TerminalAuthProvider.instance = new TerminalAuthProvider(config);
    }
    return TerminalAuthProvider.instance;
  }

  public async login(email: string, password: string): Promise<TerminalAuth> {
    try {
      const response = await this.client.post<ApiResponse<TerminalAuth>>(
        '/terminal/auth/login',
        {
          email,
          password,
        }
      );

      const auth = response.data.data;
      this.auth = auth;

      return this.auth;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  public async validateAuth(): Promise<boolean> {
    if (!this.auth) {
      return false;
    }

    try {
      await this.client.post('/terminal/auth/validate', {
        token: this.auth.token,
      });
      return true;
    } catch {
      return false;
    }
  }

  public getAuth(): TerminalAuth | null {
    return this.auth;
  }

  public clearAuth(): void {
    this.auth = null;
  }
}
