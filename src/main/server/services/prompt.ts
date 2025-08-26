import { execSync } from 'child_process';
import { hostname } from 'os';
import { CacheService } from './cache';
import { logger } from '../../utils/logger';

export interface PromptSegment {
  text: string;
  foreground?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface PromptConfig {
  segments: PromptSegment[];
  separator: string;
  newline?: boolean;
}

export interface Theme {
  id: string;
  name: string;
  description?: string;
  colors: {
    foreground: string;
    background: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
}

export class PromptService {
  private cache: CacheService;
  private readonly cachePrefix = 'prompt:';
  private readonly cacheTTL = 60; // 1 minute

  constructor() {
    this.cache = new CacheService();
  }

  /**
   * Get prompt segments
   */
  public async getPrompt(
    userId: string,
    config: PromptConfig,
    cwd: string
  ): Promise<string> {
    try {
      const segments = await Promise.all(
        config.segments.map(segment => this.renderSegment(segment, userId, cwd))
      );

      return segments.join(config.separator) + (config.newline ? '\n' : ' ');
    } catch (error) {
      logger.error('Failed to get prompt:', error);
      return '$ ';
    }
  }

  /**
   * Render prompt segment
   */
  private async renderSegment(
    segment: PromptSegment,
    userId: string,
    cwd: string
  ): Promise<string> {
    try {
      // Replace variables in text
      const text = await this.replaceVariables(segment.text, userId, cwd);

      // Apply styling
      return this.applyStyle(text, segment);
    } catch (error) {
      logger.error('Failed to render prompt segment:', error);
      return '';
    }
  }

  /**
   * Replace variables in text
   */
  private async replaceVariables(
    text: string,
    userId: string,
    cwd: string
  ): Promise<string> {
    try {
      // Get cache key
      const cacheKey = `${this.cachePrefix}vars:${userId}:${text}:${cwd}`;
      const cached = await this.cache.get<string>(cacheKey);
      if (cached) {
        return cached;
      }

      let result = text;

      // Replace built-in variables
      result = result
        .replace('\\u', process.env.USER || '')
        .replace('\\h', hostname())
        .replace('\\w', this.shortenPath(cwd))
        .replace('\\W', cwd.split('/').pop() || '')
        .replace('\\$', process.getuid() === 0 ? '#' : '$');

      // Replace Git variables
      if (result.includes('\\g')) {
        result = await this.replaceGitVariables(result, cwd);
      }

      // Cache result
      await this.cache.set(cacheKey, result, this.cacheTTL);

      return result;
    } catch (error) {
      logger.error('Failed to replace variables:', error);
      return text;
    }
  }

  /**
   * Replace Git variables
   */
  private async replaceGitVariables(
    text: string,
    cwd: string
  ): Promise<string> {
    try {
      let result = text;

      // Get Git branch
      if (result.includes('\\g')) {
        try {
          const branch = execSync('git branch --show-current', {
            cwd,
            stdio: ['ignore', 'pipe', 'ignore'],
          })
            .toString()
            .trim();

          result = result.replace('\\g', branch);
        } catch {
          result = result.replace('\\g', '');
        }
      }

      // Get Git status indicators
      if (result.includes('\\G')) {
        try {
          const status = execSync('git status --porcelain', {
            cwd,
            stdio: ['ignore', 'pipe', 'ignore'],
          })
            .toString()
            .trim();

          const indicators = [];
          if (status.match(/^\s*M/m)) indicators.push('*');
          if (status.match(/^\s*A/m)) indicators.push('+');
          if (status.match(/^\s*D/m)) indicators.push('-');
          if (status.match(/^\s*\?\?/m)) indicators.push('?');

          result = result.replace('\\G', indicators.join(''));
        } catch {
          result = result.replace('\\G', '');
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to replace Git variables:', error);
      return text;
    }
  }

  /**
   * Apply ANSI styling
   */
  private applyStyle(text: string, style: PromptSegment): string {
    const codes: number[] = [];

    if (style.bold) codes.push(1);
    if (style.italic) codes.push(3);
    if (style.underline) codes.push(4);

    if (style.foreground) {
      codes.push(...this.getColorCode(style.foreground));
    }

    if (style.background) {
      codes.push(...this.getColorCode(style.background, true));
    }

    if (codes.length === 0) {
      return text;
    }

    return `\x1b[${codes.join(';')}m${text}\x1b[0m`;
  }

  /**
   * Get ANSI color code
   */
  private getColorCode(color: string, background: boolean = false): number[] {
    // Check if it's a 256-color code
    if (color.match(/^\d{1,3}$/)) {
      return [background ? 48 : 38, 5, parseInt(color)];
    }

    // Check if it's an RGB color
    const rgb = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (rgb) {
      return [
        background ? 48 : 38,
        2,
        parseInt(rgb[1], 16),
        parseInt(rgb[2], 16),
        parseInt(rgb[3], 16),
      ];
    }

    // Basic colors
    const basicColors: Record<string, number> = {
      black: 30,
      red: 31,
      green: 32,
      yellow: 33,
      blue: 34,
      magenta: 35,
      cyan: 36,
      white: 37,
      brightBlack: 90,
      brightRed: 91,
      brightGreen: 92,
      brightYellow: 93,
      brightBlue: 94,
      brightMagenta: 95,
      brightCyan: 96,
      brightWhite: 97,
    };

    const code = basicColors[color];
    return [code ? (background ? code + 10 : code) : 39];
  }

  /**
   * Shorten path for display
   */
  private shortenPath(path: string): string {
    const home = process.env.HOME;
    if (home && path.startsWith(home)) {
      return '~' + path.slice(home.length);
    }
    return path;
  }

  /**
   * Get available themes
   */
  public getThemes(): Theme[] {
    return [
      {
        id: 'default',
        name: 'Default',
        description: 'Default light theme',
        colors: {
          foreground: '#2c3e50',
          background: '#ffffff',
          black: '#000000',
          red: '#e74c3c',
          green: '#2ecc71',
          yellow: '#f1c40f',
          blue: '#3498db',
          magenta: '#9b59b6',
          cyan: '#1abc9c',
          white: '#ecf0f1',
          brightBlack: '#95a5a6',
          brightRed: '#c0392b',
          brightGreen: '#27ae60',
          brightYellow: '#f39c12',
          brightBlue: '#2980b9',
          brightMagenta: '#8e44ad',
          brightCyan: '#16a085',
          brightWhite: '#ffffff',
        },
      },
      {
        id: 'dark',
        name: 'Dark',
        description: 'Default dark theme',
        colors: {
          foreground: '#ecf0f1',
          background: '#2c3e50',
          black: '#2c3e50',
          red: '#e74c3c',
          green: '#2ecc71',
          yellow: '#f1c40f',
          blue: '#3498db',
          magenta: '#9b59b6',
          cyan: '#1abc9c',
          white: '#ecf0f1',
          brightBlack: '#95a5a6',
          brightRed: '#c0392b',
          brightGreen: '#27ae60',
          brightYellow: '#f39c12',
          brightBlue: '#2980b9',
          brightMagenta: '#8e44ad',
          brightCyan: '#16a085',
          brightWhite: '#ffffff',
        },
      },
      {
        id: 'solarized-light',
        name: 'Solarized Light',
        description: 'Light variant of Solarized theme',
        colors: {
          foreground: '#657b83',
          background: '#fdf6e3',
          black: '#073642',
          red: '#dc322f',
          green: '#859900',
          yellow: '#b58900',
          blue: '#268bd2',
          magenta: '#d33682',
          cyan: '#2aa198',
          white: '#eee8d5',
          brightBlack: '#002b36',
          brightRed: '#cb4b16',
          brightGreen: '#586e75',
          brightYellow: '#657b83',
          brightBlue: '#839496',
          brightMagenta: '#6c71c4',
          brightCyan: '#93a1a1',
          brightWhite: '#fdf6e3',
        },
      },
      {
        id: 'solarized-dark',
        name: 'Solarized Dark',
        description: 'Dark variant of Solarized theme',
        colors: {
          foreground: '#839496',
          background: '#002b36',
          black: '#073642',
          red: '#dc322f',
          green: '#859900',
          yellow: '#b58900',
          blue: '#268bd2',
          magenta: '#d33682',
          cyan: '#2aa198',
          white: '#eee8d5',
          brightBlack: '#002b36',
          brightRed: '#cb4b16',
          brightGreen: '#586e75',
          brightYellow: '#657b83',
          brightBlue: '#839496',
          brightMagenta: '#6c71c4',
          brightCyan: '#93a1a1',
          brightWhite: '#fdf6e3',
        },
      },
    ];
  }

  /**
   * Get theme by ID
   */
  public getTheme(id: string): Theme | undefined {
    return this.getThemes().find(theme => theme.id === id);
  }

  /**
   * Get default prompt config
   */
  public getDefaultPromptConfig(): PromptConfig {
    return {
      segments: [
        {
          text: '\\u@\\h',
          foreground: 'green',
          bold: true,
        },
        {
          text: '\\w',
          foreground: 'blue',
        },
        {
          text: '\\g',
          foreground: 'magenta',
          italic: true,
        },
        {
          text: '\\G',
          foreground: 'yellow',
        },
        {
          text: '\\$',
          foreground: 'red',
          bold: true,
        },
      ],
      separator: ' ',
      newline: false,
    };
  }
}
