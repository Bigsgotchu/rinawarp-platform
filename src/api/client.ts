import axios from 'axios';
import type {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public meta?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private static instance: ApiClient;
  protected client: AxiosInstance;
  protected apiKey: string | null = null;

  private constructor(baseURL?: string) {
    this.client = axios.create({
      // @ts-ignore: Type mismatch with axios.create return type
      baseURL: baseURL || env.WEBSITE_API_URL,
      timeout: env.API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: AxiosRequestConfig) => {
        if (this.apiKey) {
          config.headers = config.headers || {};
          config.headers['x-api-key'] = this.apiKey;
        }
        return config;
      },
      (error: AxiosError) => {
        logger.error('API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response) {
          const { status, data } = error.response;
          throw new ApiError(
            (data as any)?.message || 'API request failed',
            status,
            (data as any)?.code || 'UNKNOWN_ERROR',
            (data as any)?.meta
          );
        }
        throw error;
      }
    );
  }

  public static getInstance(baseURL?: string): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient(baseURL);
    }
    return ApiClient.instance;
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  public clearApiKey() {
    this.apiKey = null;
  }

  public async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    try {
      const response = await this.client.get<AxiosResponse<T>>(path, {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error(`GET ${path} failed:`, error);
      throw error;
    }
  }

  public async post<T>(path: string, data?: any): Promise<T> {
    try {
      const response = await this.client.post<AxiosResponse<T>>(path, data);
      return response.data;
    } catch (error) {
      logger.error(`POST ${path} failed:`, error);
      throw error;
    }
  }

  public async put<T>(path: string, data?: any): Promise<T> {
    try {
      const response = await this.client.put<AxiosResponse<T>>(path, data);
      return response.data;
    } catch (error) {
      logger.error(`PUT ${path} failed:`, error);
      throw error;
    }
  }

  public async delete<T>(path: string): Promise<T> {
    try {
      const response = await this.client.delete<AxiosResponse<T>>(path);
      return response.data;
    } catch (error) {
      logger.error(`DELETE ${path} failed:`, error);
      throw error;
    }
  }
}

export default ApiClient.getInstance();
