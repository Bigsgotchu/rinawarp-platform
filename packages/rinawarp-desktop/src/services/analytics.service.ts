/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { doc, collection, addDoc, query, where, getDocs, updateDoc } from '@firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import {
  Analytics,
  CommandEntry,
  AnalyticsTimeframe,
  AnalyticsReport,
} from '../types/analytics';

export class AnalyticsService {
  private static instance: AnalyticsService;
  private currentSessionId: string | null = null;
  private sessionStartTime: Date | null = null;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  public async startSession(userId: string, mode: 'agent' | 'regular' | 'voice'): Promise<void> {
    try {
      const sessionRef = await addDoc(collection(db, 'sessions'), {
        userId,
        mode,
        startTime: new Date(),
        endTime: null,
        commandCount: 0,
        aiRequestCount: 0,
      });
      
      this.currentSessionId = sessionRef.id;
      this.sessionStartTime = new Date();
    } catch (error) {
      logger.error('Failed to start analytics session:', error);
      throw error;
    }
  }

  public async endSession(): Promise<void> {
    if (!this.currentSessionId || !this.sessionStartTime) return;

    try {
      const sessionRef = doc(db, 'sessions', this.currentSessionId);
      await updateDoc(sessionRef, {
        endTime: new Date(),
        duration: new Date().getTime() - this.sessionStartTime.getTime(),
      });

      this.currentSessionId = null;
      this.sessionStartTime = null;
    } catch (error) {
      logger.error('Failed to end analytics session:', error);
      throw error;
    }
  }

  public async trackCommand(command: CommandEntry): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      await addDoc(collection(db, 'commands'), {
        ...command,
        sessionId: this.currentSessionId,
      });

      const sessionRef = doc(db, 'sessions', this.currentSessionId);
      await updateDoc(sessionRef, {
        commandCount: increment(1),
      });
    } catch (error) {
      logger.error('Failed to track command:', error);
      throw error;
    }
  }

  public async trackAIRequest(
    type: string,
    tokensUsed: number,
    duration: number,
    success: boolean
  ): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      await addDoc(collection(db, 'ai_requests'), {
        sessionId: this.currentSessionId,
        type,
        tokensUsed,
        duration,
        success,
        timestamp: new Date(),
      });

      const sessionRef = doc(db, 'sessions', this.currentSessionId);
      await updateDoc(sessionRef, {
        aiRequestCount: increment(1),
      });
    } catch (error) {
      logger.error('Failed to track AI request:', error);
      throw error;
    }
  }

  public async trackVoiceCommand(
    command: string,
    duration: number,
    accuracy: number
  ): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      await addDoc(collection(db, 'voice_commands'), {
        sessionId: this.currentSessionId,
        command,
        duration,
        accuracy,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to track voice command:', error);
      throw error;
    }
  }

  public async getAnalytics(
    userId: string,
    timeframe: AnalyticsTimeframe
  ): Promise<AnalyticsReport> {
    try {
      // Get all relevant data within timeframe
      const [commands, aiRequests, sessions, voiceCommands] = await Promise.all([
        this.getCommandsData(userId, timeframe),
        this.getAIRequestsData(userId, timeframe),
        this.getSessionsData(userId, timeframe),
        this.getVoiceCommandsData(userId, timeframe),
      ]);

      // Calculate trends by comparing with previous period
      const previousTimeframe = this.getPreviousTimeframe(timeframe);
      const [prevCommands, prevAIRequests, prevSessions] = await Promise.all([
        this.getCommandsData(userId, previousTimeframe),
        this.getAIRequestsData(userId, previousTimeframe),
        this.getSessionsData(userId, previousTimeframe),
      ]);

      const trends = {
        commandGrowth: this.calculateGrowth(commands.length, prevCommands.length),
        aiUsageGrowth: this.calculateGrowth(aiRequests.length, prevAIRequests.length),
        performanceChange: 0, // Calculate based on response times
        userGrowth: this.calculateGrowth(sessions.length, prevSessions.length),
      };

      return {
        timeframe,
        data: this.aggregateAnalytics(commands, aiRequests, sessions, voiceCommands),
        trends,
      };
    } catch (error) {
      logger.error('Failed to get analytics:', error);
      throw error;
    }
  }

  private async getCommandsData(userId: string, timeframe: AnalyticsTimeframe) {
    const q = query(
      collection(db, 'commands'),
      where('timestamp', '>=', timeframe.start),
      where('timestamp', '<=', timeframe.end),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }

  private async getAIRequestsData(userId: string, timeframe: AnalyticsTimeframe) {
    const q = query(
      collection(db, 'ai_requests'),
      where('timestamp', '>=', timeframe.start),
      where('timestamp', '<=', timeframe.end),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }

  private async getSessionsData(userId: string, timeframe: AnalyticsTimeframe) {
    const q = query(
      collection(db, 'sessions'),
      where('startTime', '>=', timeframe.start),
      where('startTime', '<=', timeframe.end),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }

  private async getVoiceCommandsData(userId: string, timeframe: AnalyticsTimeframe) {
    const q = query(
      collection(db, 'voice_commands'),
      where('timestamp', '>=', timeframe.start),
      where('timestamp', '<=', timeframe.end),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }

  private aggregateAnalytics(commands: any[], aiRequests: any[], sessions: any[], voiceCommands: any[]): Analytics {
    return {
      commands: {
        totalCommands: commands.length,
        commandHistory: commands,
        mostUsedCommands: this.getMostUsed(commands, 'command'),
        averageResponseTime: this.calculateAverage(commands, 'duration'),
        successRate: this.calculateSuccessRate(commands),
      },
      aiUsage: {
        totalRequests: aiRequests.length,
        requestsPerMode: this.getRequestsPerMode(aiRequests),
        tokensUsed: aiRequests.reduce((sum, req) => sum + req.tokensUsed, 0),
        averageResponseTime: this.calculateAverage(aiRequests, 'duration'),
        mostCommonQueries: this.getMostCommonQueries(aiRequests),
        successRate: this.calculateSuccessRate(aiRequests),
      },
      performance: {
        averageCpuUsage: 0, // Would need system metrics
        averageMemoryUsage: 0, // Would need system metrics
        responseLatency: this.calculateAverage(commands.concat(aiRequests), 'duration'),
        errorRate: this.calculateErrorRate(commands.concat(aiRequests)),
        uptime: this.calculateUptime(sessions),
      },
      voice: {
        totalVoiceCommands: voiceCommands.length,
        voiceCommandDuration: voiceCommands.reduce((sum, cmd) => sum + cmd.duration, 0),
        recognitionAccuracy: this.calculateAverage(voiceCommands, 'accuracy'),
        mostUsedVoiceCommands: this.getMostUsed(voiceCommands, 'command'),
        averageProcessingTime: this.calculateAverage(voiceCommands, 'duration'),
      },
      sessions: {
        totalSessions: sessions.length,
        averageSessionDuration: this.calculateAverageSessionDuration(sessions),
        activeUsers: new Set(sessions.map(s => s.userId)).size,
        peakUsageTimes: this.findPeakUsageTimes(sessions),
        sessionsByMode: this.getSessionsByMode(sessions),
      },
    };
  }

  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return 100;
    return ((current - previous) / previous) * 100;
  }

  private getPreviousTimeframe(timeframe: AnalyticsTimeframe): AnalyticsTimeframe {
    const duration = timeframe.end.getTime() - timeframe.start.getTime();
    return {
      start: new Date(timeframe.start.getTime() - duration),
      end: new Date(timeframe.end.getTime() - duration),
      interval: timeframe.interval,
    };
  }

  // Helper methods for calculations
  private getMostUsed(items: any[], field: string): { [key: string]: number } {
    return items.reduce((acc, item) => {
      acc[item[field]] = (acc[item[field]] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateAverage(items: any[], field: string): number {
    if (items.length === 0) return 0;
    return items.reduce((sum, item) => sum + item[field], 0) / items.length;
  }

  private calculateSuccessRate(items: any[]): number {
    if (items.length === 0) return 0;
    const successful = items.filter(item => !item.error && item.exitCode === 0).length;
    return (successful / items.length) * 100;
  }

  private calculateErrorRate(items: any[]): number {
    if (items.length === 0) return 0;
    const errors = items.filter(item => item.error || item.exitCode !== 0).length;
    return (errors / items.length) * 100;
  }

  private calculateUptime(sessions: any[]): number {
    return sessions.reduce((total, session) => {
      return total + (session.endTime - session.startTime);
    }, 0);
  }

  private calculateAverageSessionDuration(sessions: any[]): number {
    if (sessions.length === 0) return 0;
    return sessions.reduce((total, session) => {
      return total + (session.endTime - session.startTime);
    }, 0) / sessions.length;
  }

  private findPeakUsageTimes(sessions: any[]): Date[] {
    // Group sessions by hour and find peaks
    const hourlyUsage = sessions.reduce((acc, session) => {
      const hour = new Date(session.startTime).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    // Return top 3 peak hours
    return Object.entries(hourlyUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => new Date().setHours(parseInt(hour)));
  }

  private getSessionsByMode(sessions: any[]): { agent: number; regular: number; voice: number } {
    return sessions.reduce((acc, session) => {
      acc[session.mode] = (acc[session.mode] || 0) + 1;
      return acc;
    }, { agent: 0, regular: 0, voice: 0 });
  }

  private getRequestsPerMode(requests: any[]): { agent: number; regular: number; voice: number } {
    return requests.reduce((acc, request) => {
      acc[request.mode] = (acc[request.mode] || 0) + 1;
      return acc;
    }, { agent: 0, regular: 0, voice: 0 });
  }

  private getMostCommonQueries(requests: any[]): string[] {
    const queries = this.getMostUsed(requests, 'query');
    return Object.entries(queries)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([query]) => query);
  }
}
