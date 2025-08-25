import { TerminalAuth } from '../api/types';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  auth: TerminalAuth | null;
  error: string | null;
}

export interface AuthOptions {
  persistToken?: boolean;
  tokenStorage?: 'memory' | 'localStorage';
  autoRefresh?: boolean;
}

export interface TokenStorage {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  clearRefreshToken(): void;
}

export interface AuthEvents {
  onLogin?: (auth: TerminalAuth) => void;
  onLogout?: () => void;
  onError?: (error: Error) => void;
  onTokenRefresh?: (auth: TerminalAuth) => void;
}
