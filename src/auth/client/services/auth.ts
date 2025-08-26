import { TerminalApiClient } from '../../api/terminal';
import { TerminalAuth } from '../../api/types';
import { ApiError } from '../../api/client';
import {
  AuthCredentials,
  AuthOptions,
  AuthState,
  AuthEvents,
  TokenStorage,
} from '../types';
import { createStorage } from '../storage';
import logger from '../../utils/logger';

export class ClientAuthService {
  private static instance: AuthService;
  private storage: TokenStorage;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private state: AuthState = {
    isAuthenticated: false,
    auth: null,
    error: null,
  };
  private events: AuthEvents = {};

  private constructor(private options: AuthOptions = {}) {
    this.options = {
      persistToken: false,
      tokenStorage: 'memory',
      autoRefresh: true,
      ...options,
    };

    this.storage = createStorage(this.options.tokenStorage || 'memory');
    this.initializeFromStorage();
  }

  public static getInstance(options?: AuthOptions): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(options);
    }
    return AuthService.instance;
  }

  private async initializeFromStorage(): Promise<void> {
    const token = this.storage.getToken();
    const refreshToken = this.storage.getRefreshToken();

    if (token && refreshToken) {
      try {
        await this.refreshAuth(refreshToken);
      } catch (error) {
        this.clearAuth();
      }
    }
  }

  public async login(credentials: AuthCredentials): Promise<TerminalAuth> {
    try {
      const auth = await TerminalApiClient.getInstance().login(
        credentials.email,
        credentials.password
      );

      this.setAuth(auth);
      return auth;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  public async logout(): Promise<void> {
    this.clearAuth();
    this.events.onLogout?.();
  }

  public async validateAuth(): Promise<boolean> {
    if (!this.state.auth?.token) {
      return false;
    }

    try {
      const isValid = await TerminalApiClient.getInstance().validateAuth(
        this.state.auth.token
      );

      if (!isValid) {
        this.clearAuth();
      }

      return isValid;
    } catch (error) {
      this.clearAuth();
      return false;
    }
  }

  private async refreshAuth(refreshToken: string): Promise<void> {
    try {
      const auth =
        await TerminalApiClient.getInstance().refreshToken(refreshToken);
      this.setAuth(auth);
      this.events.onTokenRefresh?.(auth);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private setAuth(auth: TerminalAuth): void {
    // Update state
    this.state = {
      isAuthenticated: true,
      auth,
      error: null,
    };

    // Store tokens if persistence is enabled
    if (this.options.persistToken) {
      this.storage.setToken(auth.token);
      this.storage.setRefreshToken(auth.refreshToken);
    }

    // Set up auto refresh
    if (this.options.autoRefresh) {
      this.setupAutoRefresh(auth);
    }

    // Update API client
    TerminalApiClient.getInstance().setApiKey(auth.apiKey);

    // Trigger events
    this.events.onLogin?.(auth);
  }

  private clearAuth(): void {
    // Clear state
    this.state = {
      isAuthenticated: false,
      auth: null,
      error: null,
    };

    // Clear storage
    this.storage.clearToken();
    this.storage.clearRefreshToken();

    // Clear refresh timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }

    // Clear API client
    TerminalApiClient.getInstance().clearApiKey();
  }

  private setupAutoRefresh(auth: TerminalAuth): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    // Refresh 1 minute before expiration
    const refreshTime = (auth.expiresIn - 60) * 1000;
    this.refreshTimeout = setTimeout(() => {
      this.refreshAuth(auth.refreshToken).catch(error => {
        logger.error('Auto refresh failed:', error);
      });
    }, refreshTime);
  }

  private handleError(error: unknown): void {
    if (error instanceof ApiError) {
      this.state.error = error.message;

      // Clear auth on certain errors
      if (
        error.code === 'INVALID_TOKEN' ||
        error.code === 'TOKEN_EXPIRED' ||
        error.statusCode === 401
      ) {
        this.clearAuth();
      }
    }

    this.events.onError?.(error as Error);
  }

  // Public getters
  public getState(): AuthState {
    return this.state;
  }

  public isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  public getToken(): string | null {
    return this.state.auth?.token || null;
  }

  public getUser(): TerminalAuth['user'] | null {
    return this.state.auth?.user || null;
  }

  // Event handlers
  public on<K extends keyof AuthEvents>(
    event: K,
    handler: AuthEvents[K]
  ): void {
    this.events[event] = handler;
  }

  public off<K extends keyof AuthEvents>(event: K): void {
    delete this.events[event];
  }
}

export default ClientAuthService.getInstance();
