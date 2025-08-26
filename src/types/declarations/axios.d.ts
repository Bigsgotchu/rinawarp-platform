declare module 'axios' {
  export interface AxiosError extends Error {
    response?: {
      status: number;
      data: any;
      headers: Record<string, string>;
    };
  }

  export interface AxiosRequestConfig {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, any>;
  }

  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    headers: Record<string, string>;
  }

  export interface AxiosInstance {
    request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    get<T = any>(
      url: string,
      config?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>>;
    post<T = any>(
      url: string,
      data?: any,
      config?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>>;
    put<T = any>(
      url: string,
      data?: any,
      config?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>>;
    delete<T = any>(
      url: string,
      config?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>>;
    interceptors: {
      request: {
        use(
          onFulfilled?: (
            config: AxiosRequestConfig
          ) => AxiosRequestConfig | Promise<AxiosRequestConfig>,
          onRejected?: (error: any) => any
        ): void;
      };
      response: {
        use(
          onFulfilled?: (
            response: AxiosResponse
          ) => AxiosResponse | Promise<AxiosResponse>,
          onRejected?: (error: any) => any
        ): void;
      };
    };
    defaults: {
      headers: {
        common: Record<string, string>;
      };
    };
  }

  export interface AxiosStatic {
    create(config?: AxiosRequestConfig): AxiosInstance;
  }

  const axios: AxiosStatic;
  export default axios;
}
