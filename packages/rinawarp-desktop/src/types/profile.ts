/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  preferences: UserPreferences;
  subscription: SubscriptionDetails;
  billing: BillingDetails;
  usage: UsageMetrics;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  fontFamily: string;
  terminalType: string;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  desktopNotifications: boolean;
  updateNotifications: boolean;
  securityAlerts: boolean;
}

export interface SubscriptionDetails {
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  features: string[];
}

export interface BillingDetails {
  customerId?: string;
  defaultPaymentMethod?: string;
  invoices: Invoice[];
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'unpaid' | 'void';
  date: Date;
  pdfUrl?: string;
}

export interface UsageMetrics {
  commandsExecuted: number;
  aiRequestsMade: number;
  storageUsed: number;
  lastActive: Date;
  sessionsCount: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    aiRequests: number;
    storage: number;
    teamMembers: number;
  };
}
