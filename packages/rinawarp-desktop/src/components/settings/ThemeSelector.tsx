/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useEffect, useState } from 'react';
import { DropDownList } from '@progress/kendo-react-dropdowns';
import { ThemeService, Theme, THEMES } from '../../services/theme.service';

interface ThemeItem {
  id: string;
  name: string;
  description: string;
  preview: string;
}

export const ThemeSelector: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState<ThemeItem | null>(null);
  const themeService = ThemeService.getInstance();

  // Convert themes to format needed for dropdown
  const themeItems = Object.values(THEMES).map(theme => ({
    id: theme.id,
    name: theme.name,
    description: theme.description,
    preview: `linear-gradient(45deg, ${theme.colors.primary}, ${theme.colors.secondary}, ${theme.colors.accent1}, ${theme.colors.accent2})`,
  }));

  useEffect(() => {
    const currentTheme = themeService.getCurrentTheme();
    setSelectedTheme(themeItems.find(item => item.id === currentTheme.id) || null);

    const handleThemeChange = (theme: Theme) => {
      setSelectedTheme(themeItems.find(item => item.id === theme.id) || null);
    };

    themeService.on('themeChanged', handleThemeChange);
    return () => {
      themeService.off('themeChanged', handleThemeChange);
    };
  }, []);

  return (
    <div className="theme-selector">
      <DropDownList
        data={themeItems}
        value={selectedTheme}
        onChange={(e) => {
          if (e.value) {
            themeService.setTheme(e.value.id);
          }
        }}
        textField="name"
        dataItemKey="id"
        itemRender={(li, itemProps) => (
          <div className="theme-item">
            <div
              className="theme-preview"
              style={{ background: itemProps.dataItem.preview }}
            />
            <div className="theme-info">
              <div className="theme-name">{itemProps.dataItem.name}</div>
              <div className="theme-description">{itemProps.dataItem.description}</div>
            </div>
          </div>
        )}
      />

      <style>{`
        .theme-selector {
          margin: 16px 0;
        }

        .theme-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
        }

        .theme-preview {
          width: 48px;
          height: 24px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .theme-info {
          flex: 1;
        }

        .theme-name {
          font-weight: bold;
          margin-bottom: 4px;
        }

        .theme-description {
          font-size: 0.9em;
          opacity: 0.8;
        }

        .k-dropdown {
          width: 100%;
          background: var(--rinawarp-bg-medium);
          border: 1px solid var(--rinawarp-bg-light);
          border-radius: 8px;
          overflow: hidden;
        }

        .k-dropdown .k-input {
          padding: 8px 12px;
          color: var(--rinawarp-text-primary);
        }

        .k-dropdown .k-select {
          background: var(--rinawarp-bg-light);
          border-left: 1px solid var(--rinawarp-bg-light);
        }

        .k-list-container {
          background: var(--rinawarp-bg-medium);
          border: 1px solid var(--rinawarp-bg-light);
          border-radius: 8px;
          padding: 8px;
          max-height: 400px;
          overflow-y: auto;
        }

        .k-list .k-item:hover {
          background: var(--rinawarp-bg-light);
        }

        .k-list .k-item.k-selected {
          background: var(--rinawarp-bg-light);
          color: var(--rinawarp-hot-pink);
        }
      `}</style>
    </div>
  );
};
