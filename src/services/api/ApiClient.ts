import axios, { AxiosInstance, AxiosError } from 'axios';
import config from '../../config/base';
import logger from '../../utils/logger';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private static instance: ApiClient;
  private client: AxiosInstance;
  private apiKey: string | null = null;

  private constructor() {
    this.client = axios.create({
      baseURL: config.websiteApi.baseUrl,
      timeout: config.websiteApi.timeout,
    });

    // Add request interceptor for API key
    this.client.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers['x-api-key'] = this.apiKey;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const { status, data } = error.response;
          throw new ApiError(
            (data as any)?.message || 'API request failed',
            status,
            (data as any)?.code || 'UNKNOWN_ERROR'
          );
        }
        throw error;
      }
    );
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  public clearApiKey() {
    this.apiKey = null;
  }

  public async get<T>(path: string) {
    try {
      const response = await this.client.get<T>(path);
      return response.data;
    } catch (error) {
      logger.error(`GET ${path} failed:`, error);
      throw error;
    }
  }

  public async post<T>(path: string, data?: any) {
    try {
      const response = await this.client.post<T>(path, data);
      return response.data;
    } catch (error) {
      logger.error(`POST ${path} failed:`, error);
      throw error;
    }
  }

  public async put<T>(path: string, data?: any) {
    try {
      const response = await this.client.put<T>(path, data);
      return response.data;
    } catch (error) {
      logger.error(`PUT ${path} failed:`, error);
      throw error;
    }
  }

  public async delete<T>(path: string) {
    try {
      const response = await this.client.delete<T>(path);
      return response.data;
    } catch (error) {
      logger.error(`DELETE ${path} failed:`, error);
      throw error;
    }
  }
}

export default ApiClient.getInstance();
