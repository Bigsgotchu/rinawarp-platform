/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

export interface Analytics {
  commands: CommandAnalytics;
  aiUsage: AIUsageAnalytics;
  performance: PerformanceMetrics;
  voice: VoiceAnalytics;
  sessions: SessionAnalytics;
}

export interface CommandAnalytics {
  totalCommands: number;
  commandHistory: CommandEntry[];
  mostUsedCommands: { [key: string]: number };
  averageResponseTime: number;
  successRate: number;
}

export interface CommandEntry {
  id: string;
  command: string;
  timestamp: Date;
  mode: 'agent' | 'regular' | 'voice';
  duration: number;
  exitCode: number;
  output: string;
  aiAssisted: boolean;
}

export interface AIUsageAnalytics {
  totalRequests: number;
  requestsPerMode: {
    agent: number;
    regular: number;
    voice: number;
  };
  tokensUsed: number;
  averageResponseTime: number;
  mostCommonQueries: string[];
  successRate: number;
}

export interface PerformanceMetrics {
  averageCpuUsage: number;
  averageMemoryUsage: number;
  responseLatency: number;
  errorRate: number;
  uptime: number;
}

export interface VoiceAnalytics {
  totalVoiceCommands: number;
  voiceCommandDuration: number;
  recognitionAccuracy: number;
  mostUsedVoiceCommands: string[];
  averageProcessingTime: number;
}

export interface SessionAnalytics {
  totalSessions: number;
  averageSessionDuration: number;
  activeUsers: number;
  peakUsageTimes: Date[];
  sessionsByMode: {
    agent: number;
    regular: number;
    voice: number;
  };
}

export interface AnalyticsTimeframe {
  start: Date;
  end: Date;
  interval: 'hour' | 'day' | 'week' | 'month';
}

export interface AnalyticsReport {
  timeframe: AnalyticsTimeframe;
  data: Analytics;
  trends: AnalyticsTrends;
}

export interface AnalyticsTrends {
  commandGrowth: number;
  aiUsageGrowth: number;
  performanceChange: number;
  userGrowth: number;
}
