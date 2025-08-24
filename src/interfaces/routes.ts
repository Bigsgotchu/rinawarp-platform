import { Request } from 'express';
import { User } from '@prisma/client';

// Generic authenticated request interface
export interface AuthenticatedRequest extends Request {
  user: User;
}

// Auth routes
export interface LoginRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

export interface RegisterRequest extends Request {
  body: {
    email: string;
    password: string;
    name: string;
  };
}

export interface RefreshTokenRequest extends Request {
  body: {
    refreshToken: string;
  };
}

// User routes
export interface UpdateProfileRequest extends AuthenticatedRequest {
  body: {
    name?: string;
    email?: string;
    preferences?: Record<string, any>;
  };
}

export interface UpdatePreferencesRequest extends AuthenticatedRequest {
  body: {
    emailNotifications?: boolean;
    theme?: 'light' | 'dark';
    commandSuggestions?: boolean;
    aiAssistance?: boolean;
  };
}

// Analytics routes
export interface AnalyticsQueryRequest extends AuthenticatedRequest {
  query: {
    startDate?: string;
    endDate?: string;
    interval?: 'daily' | 'weekly' | 'monthly';
    metrics?: string[];
  };
}

// Workflow routes
export interface CreateWorkflowRequest extends AuthenticatedRequest {
  body: {
    name: string;
    description?: string;
    steps: Array<{
      type: string;
      config: Record<string, any>;
    }>;
  };
}

export interface UpdateWorkflowRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  body: {
    name?: string;
    description?: string;
    steps?: Array<{
      type: string;
      config: Record<string, any>;
    }>;
  };
}

// Billing routes
export interface CreateSubscriptionRequest extends AuthenticatedRequest {
  body: {
    plan: 'basic' | 'pro' | 'enterprise';
    paymentMethodId: string;
  };
}

export interface UpdateSubscriptionRequest extends AuthenticatedRequest {
  body: {
    plan: 'basic' | 'pro' | 'enterprise';
  };
}

// Portal routes
export interface PortalSettingsRequest extends AuthenticatedRequest {
  body: {
    theme?: string;
    layout?: string;
    defaultView?: string;
    notifications?: {
      email?: boolean;
      push?: boolean;
      slack?: boolean;
    };
  };
}
