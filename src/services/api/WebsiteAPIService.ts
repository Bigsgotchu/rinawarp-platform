/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import axios, { AxiosInstance } from 'axios';
import config from '../config/base';
import logger from '../utils/logger';

export interface LoginResponse {
  token: string;
  apiKey: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    subscription: {
      status: string;
      planId: string;
    } | null;
    usageStats: {
      aiRequestsUsed: number;
      codebasesIndexed: number;
    } | null;
  };
}

export class WebsiteAPIService {
  private static instance: WebsiteAPIService;
  private client: AxiosInstance;
  private apiKey: string | null = null;

  private constructor() {
    this.client = axios.create({
      baseURL: process.env.WEBSITE_API_URL || 'http://localhost:3000/api',
      timeout: 10000,
    });

    // Add request interceptor for API key
    this.client.interceptors.request.use(config => {
      if (this.apiKey) {
        config.headers['x-api-key'] = this.apiKey;
      }
      return config;
    });
  }

  public static getInstance(): WebsiteAPIService {
    if (!WebsiteAPIService.instance) {
      WebsiteAPIService.instance = new WebsiteAPIService();
    }
    return WebsiteAPIService.instance;
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await this.client.post('/terminal/auth/login', {
        email,
        password,
      });

      if (response.data.apiKey) {
        this.setApiKey(response.data.apiKey);
      }

      return response.data;
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  public async validateToken(token: string): Promise<boolean> {
    try {
      const response = await this.client.post('/terminal/auth/validate', {
        token,
      });
      return response.data.valid;
    } catch (error) {
      logger.error('Token validation failed:', error);
      return false;
    }
  }

  public async trackUsage(type: string, quantity: number): Promise<void> {
    try {
      await this.client.post('/terminal/usage', {
        type,
        quantity,
      });
    } catch (error) {
      logger.error('Usage tracking failed:', error);
      throw error;
    }
  }

  public async getUser(): Promise<LoginResponse['user']> {
    try {
      const response = await this.client.get('/terminal/user');
      return response.data.user;
    } catch (error) {
      logger.error('Failed to get user:', error);
      throw error;
    }
  }
}
