export interface TerminalUser {
  id: string;
  email: string;
  name: string | null;
  subscription: {
    status: string;
    planId: string;
    features: string[];
  } | null;
  usageStats: {
    aiRequestsUsed: number;
    codebasesIndexed: number;
    lastResetDate: string;
  } | null;
}

export interface TerminalAuth {
  token: string;
  refreshToken: string;
  apiKey: string;
  expiresIn: number;
  user: TerminalUser;
}

export interface UsageData {
  type: string;
  quantity: number;
  metadata?: {
    duration?: number;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    [key: string]: any;
  };
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  };
}

export interface ErrorResponse {
  error: string;
  code: string;
  meta?: Record<string, any>;
}

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  constraints?: {
    plan?: string[];
    usage?: number;
    [key: string]: any;
  };
}
