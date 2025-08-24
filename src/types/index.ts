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
