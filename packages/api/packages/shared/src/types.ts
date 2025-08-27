export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
  plan?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  subscription?: {
    plan: string;
    status: string;
  };
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
}

export interface Command {
  command: string;
  args?: string[];
  options?: Record<string, unknown>;
  context?: CommandContext;
}

export interface CommandContext {
  userId?: string;
  previousCommands?: string[];
  workspaceInfo?: WorkspaceInfo;
  env?: Record<string, string>;
}

export interface WorkspaceInfo {
  path: string;
  type: string;
  dependencies?: string[];
  gitInfo?: GitInfo;
}

export interface GitInfo {
  repo: string;
  branch: string;
  remote?: string;
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PRO = 'PRO',
  TEAM = 'TEAM',
  ENTERPRISE = 'ENTERPRISE',
}
