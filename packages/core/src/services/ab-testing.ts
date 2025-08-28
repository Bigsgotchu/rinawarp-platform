import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '@rinawarp/shared';

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  variants: ExperimentVariant[];
  targetAudience?: {
    userGroups?: string[];
    environments?: string[];
    customRules?: Record<string, any>;
  };
  startDate?: Date;
  endDate?: Date;
  metrics: {
    primary: string;
    secondary?: string[];
  };
}

interface ExperimentVariant {
  id: string;
  name: string;
  description: string;
  traffic: number; // Percentage of traffic (0-100)
  config: Record<string, any>;
}

interface ExperimentAssignment {
  userId: string;
  experimentId: string;
  variantId: string;
  assignedAt: Date;
}

interface ExperimentEvent {
  userId: string;
  experimentId: string;
  variantId: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
}

export class ABTestingService {
  private static instance: ABTestingService;
  private prisma: PrismaClient;
  private redis: Redis;
  private logger: Logger;

  private constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis(process.env.REDIS_URL || '');
    this.logger = new Logger('ABTestingService');
  }

  public static getInstance(): ABTestingService {
    if (!ABTestingService.instance) {
      ABTestingService.instance = new ABTestingService();
    }
    return ABTestingService.instance;
  }

  public async getExperiment(id: string): Promise<Experiment | null> {
    try {
      const experiment = await this.prisma.experiment.findUnique({
        where: { id },
        include: {
          variants: true,
          metrics: true,
          targetAudience: true
        }
      });

      if (!experiment) {
        return null;
      }

      return this.mapExperimentFromDB(experiment);
    } catch (error) {
      this.logger.error('Error fetching experiment', { error, id });
      return null;
    }
  }

  public async createExperiment(experiment: Omit<Experiment, 'id'>): Promise<Experiment> {
    try {
      const created = await this.prisma.experiment.create({
        data: {
          name: experiment.name,
          description: experiment.description,
          status: experiment.status,
          startDate: experiment.startDate,
          endDate: experiment.endDate,
          variants: {
            create: experiment.variants.map(v => ({
              name: v.name,
              description: v.description,
              traffic: v.traffic,
              config: v.config
            }))
          },
          metrics: {
            create: {
              primary: experiment.metrics.primary,
              secondary: experiment.metrics.secondary
            }
          },
          targetAudience: experiment.targetAudience ? {
            create: experiment.targetAudience
          } : undefined
        },
        include: {
          variants: true,
          metrics: true,
          targetAudience: true
        }
      });

      return this.mapExperimentFromDB(created);
    } catch (error) {
      this.logger.error('Error creating experiment', { error, experiment });
      throw error;
    }
  }

  public async getVariantForUser(
    experimentId: string,
    userId: string,
    context: Record<string, any> = {}
  ): Promise<ExperimentVariant | null> {
    try {
      // Check cache first
      const cachedAssignment = await this.getAssignmentFromCache(experimentId, userId);
      if (cachedAssignment) {
        return cachedAssignment;
      }

      // Get experiment
      const experiment = await this.getExperiment(experimentId);
      if (!experiment || experiment.status !== 'ACTIVE') {
        return null;
      }

      // Check if user is in target audience
      if (!this.isUserInTargetAudience(experiment, userId, context)) {
        return null;
      }

      // Assign variant
      const variant = this.assignVariant(experiment, userId);
      if (!variant) {
        return null;
      }

      // Save assignment
      await this.saveAssignment({
        userId,
        experimentId,
        variantId: variant.id,
        assignedAt: new Date()
      });

      return variant;
    } catch (error) {
      this.logger.error('Error getting variant for user', { error, experimentId, userId });
      return null;
    }
  }

  public async trackEvent(event: Omit<ExperimentEvent, 'timestamp'>): Promise<void> {
    try {
      await this.prisma.experimentEvent.create({
        data: {
          ...event,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.logger.error('Error tracking experiment event', { error, event });
    }
  }

  private async getAssignmentFromCache(
    experimentId: string,
    userId: string
  ): Promise<ExperimentVariant | null> {
    const key = `experiment:${experimentId}:user:${userId}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  private async saveAssignment(assignment: ExperimentAssignment): Promise<void> {
    try {
      // Save to database
      await this.prisma.experimentAssignment.create({
        data: assignment
      });

      // Save to cache
      const key = `experiment:${assignment.experimentId}:user:${assignment.userId}`;
      await this.redis.set(key, JSON.stringify(assignment), 'EX', 86400); // 24 hours
    } catch (error) {
      this.logger.error('Error saving assignment', { error, assignment });
    }
  }

  private isUserInTargetAudience(
    experiment: Experiment,
    userId: string,
    context: Record<string, any>
  ): boolean {
    if (!experiment.targetAudience) {
      return true;
    }

    const { userGroups, environments, customRules } = experiment.targetAudience;

    // Check user groups
    if (userGroups?.length && !userGroups.some(g => context.userGroups?.includes(g))) {
      return false;
    }

    // Check environment
    if (environments?.length && !environments.includes(context.environment)) {
      return false;
    }

    // Check custom rules
    if (customRules) {
      // Implement custom rule checking logic here
      // This could involve evaluating complex conditions based on user attributes
    }

    return true;
  }

  private assignVariant(experiment: Experiment, userId: string): ExperimentVariant | null {
    // Use consistent hashing to ensure the same user always gets the same variant
    const hash = this.hashString(`${experiment.id}:${userId}`);
    const normalizedHash = hash % 100;

    let accumulatedPercentage = 0;
    for (const variant of experiment.variants) {
      accumulatedPercentage += variant.traffic;
      if (normalizedHash < accumulatedPercentage) {
        return variant;
      }
    }

    return null;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private mapExperimentFromDB(dbExperiment: any): Experiment {
    return {
      id: dbExperiment.id,
      name: dbExperiment.name,
      description: dbExperiment.description,
      status: dbExperiment.status,
      variants: dbExperiment.variants,
      targetAudience: dbExperiment.targetAudience,
      startDate: dbExperiment.startDate,
      endDate: dbExperiment.endDate,
      metrics: {
        primary: dbExperiment.metrics.primary,
        secondary: dbExperiment.metrics.secondary
      }
    };
  }

  public async getExperimentResults(experimentId: string): Promise<any> {
    try {
      const experiment = await this.getExperiment(experimentId);
      if (!experiment) {
        throw new Error('Experiment not found');
      }

      const events = await this.prisma.experimentEvent.findMany({
        where: {
          experimentId,
          eventType: experiment.metrics.primary
        },
        include: {
          variant: true
        }
      });

      // Calculate results for each variant
      const results = experiment.variants.map(variant => {
        const variantEvents = events.filter(e => e.variantId === variant.id);
        
        return {
          variantId: variant.id,
          variantName: variant.name,
          sampleSize: variantEvents.length,
          conversionRate: this.calculateConversionRate(variantEvents),
          confidence: this.calculateConfidenceInterval(variantEvents)
        };
      });

      return {
        experimentId,
        experimentName: experiment.name,
        status: experiment.status,
        startDate: experiment.startDate,
        endDate: experiment.endDate,
        results
      };
    } catch (error) {
      this.logger.error('Error getting experiment results', { error, experimentId });
      throw error;
    }
  }

  private calculateConversionRate(events: any[]): number {
    if (events.length === 0) return 0;
    const conversions = events.filter(e => e.eventData.converted).length;
    return (conversions / events.length) * 100;
  }

  private calculateConfidenceInterval(events: any[]): { lower: number; upper: number } {
    // Implement confidence interval calculation
    // This would typically use a statistical formula like Wilson score interval
    return { lower: 0, upper: 0 };
  }
}
