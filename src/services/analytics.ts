import { EventEmitter } from 'events';
import { env } from '../config/env';
import logger from '../utils/logger';
import MonitoringService from './monitoring';

export interface AnalyticsEvent {
  type: string;
  properties: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface UserSession {
  id: string;
  userId?: string;
  startTime: number;
  lastActive: number;
  events: string[];
  metadata: Record<string, any>;
}

export interface AnalyticsReport {
  timeRange: { start: number; end: number };
  metrics: {
    totalEvents: number;
    uniqueUsers: number;
    averageSessionDuration: number;
    topEvents: Array<{ name: string; count: number }>;
  };
  segments: Record<string, number>;
}

class AnalyticsService extends EventEmitter {
  private static instance: AnalyticsService;
  private events: AnalyticsEvent[] = [];
  private sessions: Map<string, UserSession> = new Map();
  private readonly sessionTimeout = env.SESSION_TIMEOUT || 1800000; // 30 minutes
  private readonly eventRetention = env.EVENT_RETENTION || 7 * 24 * 3600; // 7 days

  private constructor() {
    super();
    this.startCleanup();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  public trackEvent(
    type: string,
    properties: Record<string, any> = {},
    userId?: string,
    sessionId?: string
  ): void {
    const event: AnalyticsEvent = {
      type,
      properties,
      timestamp: Date.now(),
      userId,
      sessionId,
    };

    this.events.push(event);
    this.emit('event', event);

    // Update session if exists
    if (sessionId) {
      this.updateSession(sessionId, type);
    }

    // Record as metric
MonitoringService.recordMetric(`analytics.event.${type}`, 1, {
      ...(userId ? { userId } : {}),
      ...(sessionId ? { sessionId } : {}),
    });
  }

  public startSession(
    sessionId: string,
    userId?: string,
    metadata: Record<string, any> = {}
  ): void {
    const session: UserSession = {
      id: sessionId,
      userId,
      startTime: Date.now(),
      lastActive: Date.now(),
      events: [],
      metadata,
    };

    this.sessions.set(sessionId, session);
    this.emit('session_start', session);
  }

  public endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const duration = Date.now() - session.startTime;
    this.sessions.delete(sessionId);
    
    this.emit('session_end', {
      ...session,
      duration,
    });

    // Record session duration
MonitoringService.recordMetric('analytics.session.duration', duration, {
      ...(session.userId ? { userId: session.userId } : {}),
    });
  }

  public async generateReport(
    timeRange: { start: number; end: number }
  ): Promise<AnalyticsReport> {
    const events = this.getEvents(timeRange);
    const uniqueUsers = new Set(events.map((e) => e.userId).filter(Boolean)).size;
    const sessions = Array.from(this.sessions.values()).filter(
      (s) => s.startTime >= timeRange.start && s.lastActive <= timeRange.end
    );

    // Calculate average session duration
    const durations = sessions.map((s) => s.lastActive - s.startTime);
    const averageSessionDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    // Count events by type
    const eventCounts = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get top events
    const topEvents = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Calculate segments (you can customize this based on your needs)
    const segments = {
      newUsers: events.filter((e) => e.type === 'user.created').length,
      activeUsers: uniqueUsers,
      totalSessions: sessions.length,
    };

    return {
      timeRange,
      metrics: {
        totalEvents: events.length,
        uniqueUsers,
        averageSessionDuration,
        topEvents,
      },
      segments,
    };
  }

  private getEvents(timeRange: { start: number; end: number }): AnalyticsEvent[] {
    return this.events.filter(
      (event) =>
        event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    );
  }

  private updateSession(sessionId: string, eventType: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActive = Date.now();
    session.events.push(eventType);
  }

  private startCleanup(): void {
    setInterval(() => {
      this.cleanupSessions();
      this.cleanupEvents();
    }, 300000); // Run every 5 minutes
  }

  private cleanupSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActive > this.sessionTimeout) {
        this.endSession(id);
      }
    }
  }

  private cleanupEvents(): void {
    const cutoff = Date.now() - this.eventRetention * 1000;
    this.events = this.events.filter((event) => event.timestamp >= cutoff);
  }
}

export default AnalyticsService.getInstance();
