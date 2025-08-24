export interface ErrorPattern {
  id: string;
  commandPattern: string;
  errorPattern: string;
  frequency: number;
  recoveryActions: {
    command: string;
    successRate: number;
  }[];
  context: {
    operatingSystem?: string;
    projectType?: string;
    dependencies?: string[];
  };
}

export interface ErrorContext {
  recentCommands: string[];
  projectContext: any;
  systemState: any;
}

export interface ErrorAnalysis {
  errorType: string;
  rootCause: string;
  suggestedFixes: string[];
  relatedPatterns: Array<{
    command: string;
    similarity: number;
  }>;
}

export interface RecoverySuggestion {
  command: string;
  confidence: number;
  explanation: string;
}

export interface ErrorStats {
  totalErrors: number;
  commonPatterns: Array<{
    commandPattern: string;
    frequency: number;
    topRecoveryActions: Array<{
      command: string;
      successRate: number;
    }>;
  }>;
  recoveryStats: {
    totalAttempts: number;
    successfulRecoveries: number;
  };
}

export interface RetryConfig {
  maxRetries: number;
  delayMs: number;
  shouldRetry?: (error: any) => boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  delayMs: 1000,
  shouldRetry: (error: any) => {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EPIPE',
      'EAI_AGAIN',
    ];
    return retryableErrors.some(code => error.code === code);
  },
};
