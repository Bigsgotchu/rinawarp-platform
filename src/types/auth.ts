import { Request } from 'express';
import { type User as PrismaUser } from '@prisma/client';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

// Core session user type that represents the currently logged in user
export interface SessionUser
  extends Pick<PrismaUser, 'id' | 'email' | 'name' | 'role'> {
  subscription?: {
    status: string;
    planId: string;
    features: string[];
  } | null;
}

// Extended user type that includes full Prisma User fields plus custom fields
export interface User extends PrismaUser {
  status: UserStatus;
  currentPlan?: SubscriptionPlan;
  lastLoginAt?: Date;
  preferences?: UserPreferences;
}

// Auth token payload structure
export interface AuthPayload {
  userId: string;
  email: string;
  name: string | null;
  role: UserRole;
  plan: SubscriptionPlan;
  subscription?: {
    status: string;
    planId: string;
    features: string[];
  } | null;
}

// Request type with authenticated user
export interface AuthRequest extends Request {
  user?: AuthPayload;
}

// Auth API response structure
export interface AuthResponse {
  user: SessionUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  sessionId?: string;
}

// User preferences
export interface UserPreferences {
  emailNotifications: boolean;
  theme: 'light' | 'dark';
  commandSuggestions: boolean;
  aiAssistance: boolean;
}

// Authentication types
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

// Session management
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

// Subscription plan features
// Plan management types
export type PlanKey = keyof typeof SubscriptionPlan;

export interface PlanFeatures {
  maxCommands: number;
  maxWorkflows: number;
  aiAssistance: boolean;
  customWorkflows: boolean;
  teamMembers: number;
  priority: boolean;
}

export interface SubscriptionStatus {
  active: boolean;
  endsAt?: Date;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
}

export interface BillingDetails {
  customerId: string;
  subscriptionId?: string;
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  paymentMethods?: Array<{
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
  }>;
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
