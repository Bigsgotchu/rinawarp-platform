import { UserRole, SubscriptionPlan, AuthPayload } from './auth';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TerminalAuthResponse {
  token: string;
  refreshToken: string;
  apiKey: string;
  expiresIn: number;
  user: TerminalUser;
}

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

export const convertTerminalUserToAuthPayload = (user: TerminalUser): AuthPayload => {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: UserRole.USER, // Default to USER role unless explicitly set
    plan: user.subscription?.planId as SubscriptionPlan || SubscriptionPlan.FREE,
    subscription: user.subscription,
  };
};
