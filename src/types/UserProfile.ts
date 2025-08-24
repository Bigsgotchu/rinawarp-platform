export interface CommandCategory {
  name: string;
  usageCount: number;
  successRate: number;
  lastUsed: Date;
}

export interface CommandMetrics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageComplexity: number;
  categories: Record<string, CommandCategory>;
}

export interface UserPreferences {
  verbosityLevel: 'basic' | 'detailed' | 'expert';
  preferredShell: string;
  commonDirectories: string[];
  favoriteCommands: string[];
  riskTolerance: 'low' | 'medium' | 'high';
}

export interface SkillLevel {
  overall: number; // 0-100
  categoryLevels: Record<string, number>;
  learningRate: number;
  lastUpdated: Date;
}

export interface UserProfile {
  id: string;
  metrics: CommandMetrics;
  preferences: UserPreferences;
  skillLevel: SkillLevel;
  lastActive: Date;
}
