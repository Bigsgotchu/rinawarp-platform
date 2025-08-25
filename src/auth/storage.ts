import { TokenStorage } from './types';

// Memory-based storage
export class MemoryStorage implements TokenStorage {
  private token: string | null = null;
  private refreshToken: string | null = null;

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  clearRefreshToken(): void {
    this.refreshToken = null;
  }
}

// Local storage based storage
export class LocalStorage implements TokenStorage {
  private readonly tokenKey = 'rinawarp_token';
  private readonly refreshTokenKey = 'rinawarp_refresh_token';

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem(this.refreshTokenKey, token);
  }

  clearRefreshToken(): void {
    localStorage.removeItem(this.refreshTokenKey);
  }
}

// Create storage factory
export function createStorage(type: 'memory' | 'localStorage'): TokenStorage {
  switch (type) {
    case 'localStorage':
      return new LocalStorage();
    case 'memory':
    default:
      return new MemoryStorage();
  }
}
