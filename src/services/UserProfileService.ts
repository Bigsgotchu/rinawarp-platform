import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  UserProfile,
  CommandMetrics,
  UserPreferences,
  SkillLevel,
  CommandCategory
} from '../types/UserProfile';
import { Command, CommandResult } from '../types';
import logger from '../utils/logger';

class UserProfileService {
  private redis: Redis;
  private readonly PROFILE_KEY_PREFIX = 'user_profile:';
  private readonly DEFAULT_CATEGORIES = [
    'file_operations',
    'system_admin',
    'network',
    'process_management',
    'git',
    'package_management',
    'text_processing',
  ];

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async createProfile(userId: string): Promise<UserProfile> {
    const profile: UserProfile = {
      id: userId,
      metrics: this.initializeMetrics(),
      preferences: this.initializePreferences(),
      skillLevel: this.initializeSkillLevel(),
      lastActive: new Date(),
    };

    await this.saveProfile(profile);
    return profile;
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const key = `${this.PROFILE_KEY_PREFIX}${userId}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return this.createProfile(userId);
    }

    return JSON.parse(data);
  }

  async updateFromCommand(
    userId: string,
    command: Command,
    result: CommandResult
  ): Promise<void> {
    const profile = await this.getProfile(userId);
    const category = this.categorizeCommand(command);
    const complexity = this.calculateCommandComplexity(command);

    // Update metrics
    profile.metrics.totalCommands++;
    if (result.exitCode === 0) {
      profile.metrics.successfulCommands++;
    } else {
      profile.metrics.failedCommands++;
    }

    // Update category metrics
    if (!profile.metrics.categories[category]) {
      profile.metrics.categories[category] = {
        name: category,
        usageCount: 0,
        successRate: 0,
        lastUsed: new Date(),
      };
    }

    const cat = profile.metrics.categories[category];
    cat.usageCount++;
    cat.successRate = (cat.successRate * (cat.usageCount - 1) + (result.exitCode === 0 ? 1 : 0)) / cat.usageCount;
    cat.lastUsed = new Date();

    // Update skill level
    this.updateSkillLevel(profile, command, result);

    // Update preferences
    this.updatePreferences(profile, command);

    // Save updated profile
    await this.saveProfile(profile);
  }

  private initializeMetrics(): CommandMetrics {
    return {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageComplexity: 0,
      categories: {},
    };
  }

  private initializePreferences(): UserPreferences {
    return {
      verbosityLevel: 'basic',
      preferredShell: process.env.SHELL || 'bash',
      commonDirectories: [],
      favoriteCommands: [],
      riskTolerance: 'low',
    };
  }

  private initializeSkillLevel(): SkillLevel {
    const categoryLevels: Record<string, number> = {};
    this.DEFAULT_CATEGORIES.forEach(cat => {
      categoryLevels[cat] = 0;
    });

    return {
      overall: 0,
      categoryLevels,
      learningRate: 1.0,
      lastUpdated: new Date(),
    };
  }

  private async saveProfile(profile: UserProfile): Promise<void> {
    const key = `${this.PROFILE_KEY_PREFIX}${profile.id}`;
    await this.redis.set(key, JSON.stringify(profile));
  }

  private categorizeCommand(command: Command): string {
    const cmd = command.command.toLowerCase();
    
    // Simple categorization rules
    if (['ls', 'cd', 'cp', 'mv', 'rm', 'mkdir', 'touch'].includes(cmd)) {
      return 'file_operations';
    }
    if (['sudo', 'chmod', 'chown', 'systemctl'].includes(cmd)) {
      return 'system_admin';
    }
    if (['curl', 'wget', 'ping', 'netstat', 'ssh'].includes(cmd)) {
      return 'network';
    }
    if (['ps', 'kill', 'top', 'htop'].includes(cmd)) {
      return 'process_management';
    }
    if (cmd.startsWith('git')) {
      return 'git';
    }
    if (['npm', 'yarn', 'pip', 'brew'].includes(cmd)) {
      return 'package_management';
    }
    if (['grep', 'sed', 'awk', 'cat', 'less'].includes(cmd)) {
      return 'text_processing';
    }

    return 'other';
  }

  private calculateCommandComplexity(command: Command): number {
    let complexity = 1;

    // Add complexity for arguments
    if (command.args) {
      complexity += command.args.length * 0.5;
      
      // Add complexity for flags
      const flags = command.args.filter(arg => arg.startsWith('-'));
      complexity += flags.length * 0.3;
    }

    // Add complexity for pipes
    if (command.command.includes('|')) {
      complexity += command.command.split('|').length * 1.5;
    }

    // Add complexity for redirection
    if (command.command.includes('>') || command.command.includes('<')) {
      complexity += 1;
    }

    return Math.min(complexity, 10); // Cap at 10
  }

  private updateSkillLevel(
    profile: UserProfile,
    command: Command,
    result: CommandResult
  ): void {
    const category = this.categorizeCommand(command);
    const complexity = this.calculateCommandComplexity(command);
    const success = result.exitCode === 0;

    // Update category skill level
    const currentLevel = profile.skillLevel.categoryLevels[category] || 0;
    const learningFactor = success ? 1 : -0.5;
    const complexityFactor = complexity / 10;
    
    profile.skillLevel.categoryLevels[category] = Math.min(
      100,
      Math.max(0, currentLevel + (learningFactor * complexityFactor * profile.skillLevel.learningRate))
    );

    // Update overall skill level
    const categoryLevels = Object.values(profile.skillLevel.categoryLevels);
    profile.skillLevel.overall = categoryLevels.reduce((sum, level) => sum + level, 0) / categoryLevels.length;

    // Update learning rate
    const timeSinceLastUpdate = Date.now() - profile.skillLevel.lastUpdated.getTime();
    const daysSinceLastUpdate = timeSinceLastUpdate / (1000 * 60 * 60 * 24);
    profile.skillLevel.learningRate = Math.max(0.5, 1 - (daysSinceLastUpdate * 0.1));
    
    profile.skillLevel.lastUpdated = new Date();
  }

  private updatePreferences(profile: UserProfile, command: Command): void {
    // Update common directories
    if (command.cwd) {
      const commonDirs = new Set(profile.preferences.commonDirectories);
      commonDirs.add(command.cwd);
      profile.preferences.commonDirectories = Array.from(commonDirs).slice(-10);
    }

    // Update favorite commands
    const commandStr = `${command.command} ${command.args?.join(' ') || ''}`.trim();
    const favorites = new Set(profile.preferences.favoriteCommands);
    favorites.add(commandStr);
    profile.preferences.favoriteCommands = Array.from(favorites).slice(-20);

    // Update verbosity level based on command complexity
    const complexity = this.calculateCommandComplexity(command);
    if (complexity > 7 && profile.preferences.verbosityLevel === 'basic') {
      profile.preferences.verbosityLevel = 'detailed';
    } else if (complexity > 9 && profile.preferences.verbosityLevel === 'detailed') {
      profile.preferences.verbosityLevel = 'expert';
    }

    // Update risk tolerance based on command patterns
    const riskyPatterns = [/rm\s+-rf/, /chmod\s+777/, /dd/];
    const usesRiskyCommand = riskyPatterns.some(pattern => 
      pattern.test(`${command.command} ${command.args?.join(' ') || ''}`)
    );
    
    if (usesRiskyCommand && profile.preferences.riskTolerance === 'low') {
      profile.preferences.riskTolerance = 'medium';
    }
  }

  async getProfileStats(userId: string): Promise<any> {
    const profile = await this.getProfile(userId);
    
    return {
      commandStats: {
        total: profile.metrics.totalCommands,
        successRate: profile.metrics.successfulCommands / profile.metrics.totalCommands,
        categoryBreakdown: Object.values(profile.metrics.categories)
          .map(cat => ({
            name: cat.name,
            usage: cat.usageCount,
            successRate: cat.successRate
          }))
      },
      skillLevels: {
        overall: profile.skillLevel.overall,
        categories: profile.skillLevel.categoryLevels
      },
      preferences: {
        verbosity: profile.preferences.verbosityLevel,
        riskTolerance: profile.preferences.riskTolerance,
        topCommands: profile.preferences.favoriteCommands.slice(0, 5)
      }
    };
  }
}

export default new UserProfileService();
