import { TerminalAuth } from '../auth/types';

export class CacheService {
  private static instance: CacheService;
  private cache: Map<string, any>;
  private authCache: TerminalAuth | null = null;

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  // Auth-specific methods
  public setAuth(auth: TerminalAuth) {
    this.authCache = auth;
  }

  public getAuth(): TerminalAuth | null {
    return this.authCache;
  }

  public clearAuth() {
    this.authCache = null;
  }

  // General cache methods
  public set(key: string, value: any, ttl?: number) {
    this.cache.set(key, {
      value,
      expiresAt: ttl ? Date.now() + ttl : null,
    });
  }

  public get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  public delete(key: string) {
    this.cache.delete(key);
  }

  public clear() {
    this.cache.clear();
    this.authCache = null;
  }
}

export default CacheService.getInstance();
