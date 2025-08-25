import { LoginCredentials } from '../types/auth';
import { TerminalAuth } from '../auth/types';
import { ApiError } from './api/ApiClient';
import TerminalApi from './api/TerminalApi';
import CacheService from './CacheService';
import logger from '../utils/logger';

class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async login(credentials: LoginCredentials): Promise<TerminalAuth> {
    try {
      const auth = await TerminalApi.login(credentials.email, credentials.password);
      
      // Cache the auth data
      CacheService.getInstance().setAuth(auth);
      
      return auth;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`Login failed: ${error.message}`);
        throw new Error(`Authentication failed: ${error.message}`);
      }
      throw error;
    }
  }

  public async validateAuth(): Promise<boolean> {
    const auth = CacheService.getInstance().getAuth();
    if (!auth) return false;

    try {
      const isValid = await TerminalApi.validateAuth(auth.token);
      if (!isValid) {
        CacheService.getInstance().clearAuth();
      }
      return isValid;
    } catch (error) {
      logger.error('Auth validation failed:', error);
      CacheService.getInstance().clearAuth();
      return false;
    }
  }

  public async logout(): Promise<void> {
    CacheService.getInstance().clearAuth();
  }

  public getCurrentUser(): TerminalAuth['user'] | null {
    const auth = CacheService.getInstance().getAuth();
    return auth?.user || null;
  }

  public async refreshUserData(): Promise<TerminalAuth['user']> {
    try {
      const user = await TerminalApi.getUser();
      const auth = CacheService.getInstance().getAuth();
      
      if (auth) {
        CacheService.getInstance().setAuth({
          ...auth,
          user,
        });
      }

      return user;
    } catch (error) {
      logger.error('Failed to refresh user data:', error);
      throw error;
    }
  }

  public getAuthToken(): string | null {
    return CacheService.getInstance().getAuth()?.token || null;
  }

  public getApiKey(): string | null {
    return CacheService.getInstance().getAuth()?.apiKey || null;
  }
}

export default AuthService.getInstance();
