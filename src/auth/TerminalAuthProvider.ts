import axios, { AxiosInstance } from 'axios';
import { WebsiteAPIConfig, AuthResponse, TerminalAuth } from './types';

export class TerminalAuthProvider {
  private static instance: TerminalAuthProvider;
  private client: AxiosInstance;
  private auth: TerminalAuth | null = null;

  private constructor(config: WebsiteAPIConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
    });

    this.client.interceptors.request.use((config) => {
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
      const response = await this.client.post<AuthResponse>('/terminal/auth/login', {
        email,
        password,
      });

      this.auth = {
        apiKey: response.data.apiKey,
        token: response.data.token,
        user: response.data.user,
      };

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
