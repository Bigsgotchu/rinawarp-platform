import { User, Subscription, SubscriptionPlan } from '@prisma/client';

// Re-export canonical auth types
export type { AuthPayload, AuthRequest, AuthResponse } from './auth';

export interface PaymentMethodResponse {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface SubscriptionDetails {
  id: string;
  plan: SubscriptionPlan;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  features: Record<string, any>;
  usage: {
    commands: {
      used: number;
      limit: number;
    };
    workflows: {
      used: number;
      limit: number;
    };
  };
}

export interface BillingHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'FAILED' | 'PENDING';
  description: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export type { User, Subscription, SubscriptionPlan };

export * from './errors';

export interface Command {
  command: string;
  args?: string[];
  cwd?: string;
}

export interface CommandResult {
  output: string;
  exitCode: number;
  error?: string;
}

export interface HistoryEntry {
  id: string;
  command: string;
  timestamp: Date;
  result: CommandResult;
}

export interface CommandContext {
  previousCommands?: string[];
  currentDirectory?: string;
  operatingSystem?: string;
  errorOutput?: string;
  exitCode?: number;
}

export interface CommandExplanation {
  description: string;
  examples: string[];
  warnings?: string[];
  seeAlso?: string[];
}

export interface CommandSuggestion {
  command: string;
  explanation: string;
  context?: string;
  risk?: 'low' | 'medium' | 'high';
}

export interface ErrorResolution {
  error: string;
  possibleCauses: string[];
  suggestedFixes: CommandSuggestion[];
}

export interface AIResponse {
  suggestion: string;
  explanation?: CommandExplanation;
  alternatives?: CommandSuggestion[];
  errorResolution?: ErrorResolution;
  commandChains?: CommandSuggestion[];
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: any;
}
