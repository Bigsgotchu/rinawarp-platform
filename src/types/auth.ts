import { type PrismaClient } from '@prisma/client';

export interface User {
  id: string;
  email: string;
  name: string;
  hashedPassword: string;
  role: UserRole;
  status: UserStatus;
  stripeCustomerId?: string;
  currentPlan?: SubscriptionPlan;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  preferences?: UserPreferences;
}

export type DB = {
  prisma: PrismaClient;
  user: User;
};

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  plan: SubscriptionPlan;
  name?: string | null;
  subscription?: {
    status: string;
    planId: string;
    features: string[];
  } | null;
}

export interface AuthRequest extends Request {
  user: AuthPayload;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    plan: SubscriptionPlan;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  sessionId?: string;
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export interface UserPreferences {
  emailNotifications: boolean;
  theme: 'light' | 'dark';
  commandSuggestions: boolean;
  aiAssistance: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegistrationData extends LoginCredentials {
  name: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

export interface PasswordResetToken {
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    device: string;
    location?: string;
  };
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
}

export interface PlanFeatures {
  maxCommands: number;
  maxWorkflows: number;
  aiAssistance: boolean;
  customWorkflows: boolean;
  teamMembers: number;
  priority: boolean;
}

export const PLAN_FEATURES: Record<SubscriptionPlan, PlanFeatures> = {
  [SubscriptionPlan.FREE]: {
    maxCommands: 100,
    maxWorkflows: 3,
    aiAssistance: false,
    customWorkflows: false,
    teamMembers: 1,
    priority: false,
  },
  [SubscriptionPlan.BASIC]: {
    maxCommands: 1000,
    maxWorkflows: 10,
    aiAssistance: true,
    customWorkflows: false,
    teamMembers: 1,
    priority: false,
  },
  [SubscriptionPlan.PRO]: {
    maxCommands: 10000,
    maxWorkflows: 50,
    aiAssistance: true,
    customWorkflows: true,
    teamMembers: 5,
    priority: true,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    maxCommands: -1, // unlimited
    maxWorkflows: -1, // unlimited
    aiAssistance: true,
    customWorkflows: true,
    teamMembers: -1, // unlimited
    priority: true,
  },
};
