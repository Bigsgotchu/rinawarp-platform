import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { CommandHistoryService } from './command-history';
import { logger } from '../../utils/logger';
import { CacheService } from './cache';

const execAsync = promisify(exec);

export interface CompletionContext {
  command: string;     // Current command
  cursorPos: number;   // Cursor position
  line: string;        // Full line
  cwd: string;        // Current working directory
  env?: NodeJS.ProcessEnv; // Environment variables
}

export interface CompletionResult {
  suggestions: string[];
  displayType?: 'list' | 'grid' | 'detailed';
  details?: Record<string, string>;
  partial?: string;
}

export class CompletionService {
  private history: CommandHistoryService;
  private cache: CacheService;
  private readonly cachePrefix = 'completion:';
  private readonly cacheTTL = 300; // 5 minutes

  constructor() {
    this.history = new CommandHistoryService();
    this.cache = new CacheService();
  }

  /**
   * Get completions
   */
  public async getCompletions(
    userId: string,
    context: CompletionContext
  ): Promise<CompletionResult> {
    try {
      // Parse command line
      const parts = context.line.slice(0, context.cursorPos).split(' ');
      const currentWord = parts[parts.length - 1];
      const command = parts[0];

      // Get appropriate completion handler
      if (parts.length === 1) {
        return this.getCommandCompletions(userId, currentWord, context);
      } else {
        return this.getArgumentCompletions(command, currentWord, context);
      }
    } catch (error) {
      logger.error('Failed to get completions:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Get command completions
   */
  private async getCommandCompletions(
    userId: string,
    partial: string,
    context: CompletionContext
  ): Promise<CompletionResult> {
    try {
      const results: Set<string> = new Set();

      // Get from history
      const historySuggestions = await this.history.getCommandSuggestions(
        userId,
        partial,
        context.cwd
      );
      historySuggestions.forEach(s => results.add(s));

      // Get from PATH
      const pathSuggestions = await this.getPathCompletions(partial);
      pathSuggestions.forEach(s => results.add(s));

      // Get aliases
      const aliasSuggestions = await this.getAliasCompletions(partial);
      aliasSuggestions.forEach(s => results.add(s));

      return {
        suggestions: Array.from(results),
        displayType: 'list',
      };
    } catch (error) {
      logger.error('Failed to get command completions:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Get argument completions
   */
  private async getArgumentCompletions(
    command: string,
    partial: string,
    context: CompletionContext
  ): Promise<CompletionResult> {
    try {
      switch (command) {
        case 'cd':
          return this.getDirectoryCompletions(partial, context.cwd);
        
        case 'git':
          return this.getGitCompletions(partial, context);
        
        default:
          return this.getFileCompletions(partial, context.cwd);
      }
    } catch (error) {
      logger.error('Failed to get argument completions:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Get completions from PATH
   */
  private async getPathCompletions(
    partial: string
  ): Promise<string[]> {
    try {
      const cacheKey = `${this.cachePrefix}path:${partial}`;
      const cached = await this.cache.get<string[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const paths = process.env.PATH?.split(':') || [];
      const executables: Set<string> = new Set();

      for (const path of paths) {
        try {
          const files = await readdir(path);
          files
            .filter(f => f.startsWith(partial))
            .forEach(f => executables.add(f));
        } catch {
          // Ignore inaccessible directories
          continue;
        }
      }

      const results = Array.from(executables);
      await this.cache.set(cacheKey, results, this.cacheTTL);

      return results;
    } catch (error) {
      logger.error('Failed to get PATH completions:', error);
      return [];
    }
  }

  /**
   * Get directory completions
   */
  private async getDirectoryCompletions(
    partial: string,
    cwd: string
  ): Promise<CompletionResult> {
    try {
      const path = partial.startsWith('/')
        ? partial
        : join(cwd, partial);

      const dir = dirname(path);
      const base = basename(path);

      const entries = await readdir(dir, { withFileTypes: true });
      const directories = entries
        .filter(e => e.isDirectory() && e.name.startsWith(base))
        .map(e => join(dir, e.name));

      return {
        suggestions: directories,
        displayType: 'list',
      };
    } catch (error) {
      logger.error('Failed to get directory completions:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Get file completions
   */
  private async getFileCompletions(
    partial: string,
    cwd: string
  ): Promise<CompletionResult> {
    try {
      const path = partial.startsWith('/')
        ? partial
        : join(cwd, partial);

      const dir = dirname(path);
      const base = basename(path);

      const entries = await readdir(dir, { withFileTypes: true });
      const files = entries
        .filter(e => e.name.startsWith(base))
        .map(e => ({
          name: join(dir, e.name),
          type: e.isDirectory() ? 'directory' : 'file',
        }));

      return {
        suggestions: files.map(f => f.name),
        displayType: 'detailed',
        details: Object.fromEntries(
          files.map(f => [f.name, f.type])
        ),
      };
    } catch (error) {
      logger.error('Failed to get file completions:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Get Git completions
   */
  private async getGitCompletions(
    partial: string,
    context: CompletionContext
  ): Promise<CompletionResult> {
    try {
      const parts = context.line.split(' ');
      const subcommand = parts[1];

      switch (subcommand) {
        case 'checkout':
        case 'switch':
          return this.getGitBranchCompletions(partial, context.cwd);
        
        case 'add':
          return this.getGitAddCompletions(partial, context.cwd);
        
        default:
          return this.getGitCommandCompletions(partial);
      }
    } catch (error) {
      logger.error('Failed to get Git completions:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Get Git branch completions
   */
  private async getGitBranchCompletions(
    partial: string,
    cwd: string
  ): Promise<CompletionResult> {
    try {
      const { stdout } = await execAsync('git branch', { cwd });
      const branches = stdout
        .split('\n')
        .map(b => b.trim().replace('* ', ''))
        .filter(b => b && b.startsWith(partial));

      return {
        suggestions: branches,
        displayType: 'list',
      };
    } catch (error) {
      logger.error('Failed to get Git branch completions:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Get Git add completions
   */
  private async getGitAddCompletions(
    partial: string,
    cwd: string
  ): Promise<CompletionResult> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd });
      const files = stdout
        .split('\n')
        .map(line => line.slice(3).trim())
        .filter(f => f && f.startsWith(partial));

      return {
        suggestions: files,
        displayType: 'list',
      };
    } catch (error) {
      logger.error('Failed to get Git add completions:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Get Git command completions
   */
  private async getGitCommandCompletions(
    partial: string
  ): Promise<CompletionResult> {
    try {
      const commands = [
        'add',
        'branch',
        'checkout',
        'clone',
        'commit',
        'diff',
        'fetch',
        'init',
        'log',
        'merge',
        'pull',
        'push',
        'rebase',
        'reset',
        'status',
      ];

      const matches = commands.filter(c => c.startsWith(partial));

      return {
        suggestions: matches,
        displayType: 'list',
      };
    } catch (error) {
      logger.error('Failed to get Git command completions:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Get alias completions
   */
  private async getAliasCompletions(
    partial: string
  ): Promise<string[]> {
    try {
      // This would be populated from user preferences
      const aliases: Record<string, string> = {
        // Example aliases
        'g': 'git',
        'gc': 'git commit',
        'gp': 'git push',
        'll': 'ls -la',
      };

      return Object.keys(aliases)
        .filter(a => a.startsWith(partial));
    } catch (error) {
      logger.error('Failed to get alias completions:', error);
      return [];
    }
  }
}
