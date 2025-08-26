/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import { EventEmitter } from 'events';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent1: string;
  accent2: string;
  background: string;
  text: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  description: string;
  isDark: boolean;
}

export const THEMES: { [key: string]: Theme } = {
  mermaid: {
    id: 'mermaid',
    name: 'Mermaid',
    description: 'RinaWarp\'s signature mermaid-inspired theme with hot pink, coral, teal, and light blue',
    isDark: true,
    colors: {
      primary: '#FF69B4',    // Hot Pink
      secondary: '#FF7F50',  // Coral
      accent1: '#40E0D0',    // Teal
      accent2: '#87CEEB',    // Light Blue
      background: '#0A0A0A',
      text: '#FFFFFF',
    },
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'High-contrast neon theme with vibrant colors',
    isDark: true,
    colors: {
      primary: '#00FF00',    // Neon Green
      secondary: '#FF00FF',  // Magenta
      accent1: '#00FFFF',    // Cyan
      accent2: '#FF0000',    // Red
      background: '#0A0A0A',
      text: '#FFFFFF',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    description: 'Calming deep sea colors',
    isDark: true,
    colors: {
      primary: '#006994',    // Ocean Blue
      secondary: '#00A5CF',  // Light Blue
      accent1: '#7FCDCD',    // Turquoise
      accent2: '#83C5BE',    // Sea Green
      background: '#05445E',
      text: '#FFFFFF',
    },
  },
  light: {
    id: 'light',
    name: 'Light',
    description: 'Light theme with soft colors',
    isDark: false,
    colors: {
      primary: '#FF69B4',    // Hot Pink
      secondary: '#FF7F50',  // Coral
      accent1: '#40E0D0',    // Teal
      accent2: '#87CEEB',    // Light Blue
      background: '#FFFFFF',
      text: '#000000',
    },
  },
};

export class ThemeService extends EventEmitter {
  private static instance: ThemeService;
  private currentTheme: Theme;

  private constructor() {
    super();
    this.currentTheme = THEMES.mermaid;
    this.applyTheme(this.currentTheme);
  }

  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  public getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  public getAvailableThemes(): Theme[] {
    return Object.values(THEMES);
  }

  public setTheme(themeId: string): void {
    const theme = THEMES[themeId];
    if (!theme) {
      throw new Error(`Theme "${themeId}" not found`);
    }

    this.currentTheme = theme;
    this.applyTheme(theme);
    this.emit('themeChanged', theme);

    // Save preference
    localStorage.setItem('selectedTheme', themeId);
  }

  private applyTheme(theme: Theme): void {
    // Update CSS variables
    const root = document.documentElement;
    root.style.setProperty('--rinawarp-hot-pink', theme.colors.primary);
    root.style.setProperty('--rinawarp-coral', theme.colors.secondary);
    root.style.setProperty('--rinawarp-teal', theme.colors.accent1);
    root.style.setProperty('--rinawarp-light-blue', theme.colors.accent2);
    root.style.setProperty('--rinawarp-bg-dark', theme.colors.background);
    root.style.setProperty('--rinawarp-text-primary', theme.colors.text);

    // Update data attribute for theme-specific styles
    document.body.dataset.theme = theme.id;
    document.body.dataset.isDark = theme.isDark.toString();

    // Apply theme class
    document.body.className = `theme-${theme.id}`;
  }

  public initialize(): void {
    // Load saved theme preference
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme && THEMES[savedTheme]) {
      this.setTheme(savedTheme);
    } else {
      // Default to system preference, fallback to mermaid
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.setTheme('mermaid');
      } else {
        this.setTheme('light');
      }
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', e => {
        if (!localStorage.getItem('selectedTheme')) {
          this.setTheme(e.matches ? 'mermaid' : 'light');
        }
      });
  }
}
