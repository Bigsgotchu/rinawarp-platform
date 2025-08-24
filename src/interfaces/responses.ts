// Base response interface
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  errors?: Array<{
    field?: string;
    message: string;
  }>;
}

// Auth responses
export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export interface AuthResponse extends ApiResponse<{
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  tokens: AuthTokens;
}> {}

// User responses
export interface UserProfileResponse extends ApiResponse<{
  id: string;
  email: string;
  name: string;
  role: string;
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}> {}

export interface UsageMetricsResponse extends ApiResponse<{
  period: string;
  metrics: {
    commandsExecuted: number;
    aiInteractions: number;
    customWorkflows: number;
    apiCalls: number;
  };
}> {}

// Analytics responses
export interface AnalyticsDataResponse extends ApiResponse<{
  timeframe: {
    start: string;
    end: string;
    interval: string;
  };
  metrics: Array<{
    timestamp: string;
    values: Record<string, number>;
  }>;
}> {}

// Workflow responses
export interface WorkflowResponse extends ApiResponse<{
  id: string;
  name: string;
  description?: string;
  steps: Array<{
    type: string;
    config: Record<string, any>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}> {}

export interface WorkflowListResponse extends ApiResponse<{
  workflows: Array<{
    id: string;
    name: string;
    description?: string;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {}

// Billing responses
export interface SubscriptionResponse extends ApiResponse<{
  id: string;
  plan: string;
  status: string;
  currentPeriod: {
    start: Date;
    end: Date;
  };
  features: string[];
}> {}

export interface BillingHistoryResponse extends ApiResponse<{
  transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    date: Date;
    description: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {}

// Portal responses
export interface PortalSettingsResponse extends ApiResponse<{
  theme: string;
  layout: string;
  defaultView: string;
  notifications: {
    email: boolean;
    push: boolean;
    slack: boolean;
  };
}> {}
