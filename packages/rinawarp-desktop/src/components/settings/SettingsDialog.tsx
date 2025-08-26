/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React from 'react';
import { Dialog } from '@progress/kendo-react-dialogs';
import { TabStrip, TabStripTab } from '@progress/kendo-react-layout';
import { ThemeSelector } from './ThemeSelector';
import { LicenseService } from '../../services/license.service';
import { RinaWarpIcon } from '../icons/RinaWarpIcon';

interface SettingsDialogProps {
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }) => {
  const [selected, setSelected] = React.useState(0);
  const licenseService = LicenseService.getInstance();

  return (
    <Dialog
      title="RinaWarp Settings"
      onClose={onClose}
      width={800}
      height={600}
    >
      <div className="settings-dialog">
        <div className="settings-header">
          <RinaWarpIcon size={32} />
          <div className="header-text">
            <h2>RinaWarp</h2>
            <p className="version">Version 0.1.0</p>
            <p className="license-info">{licenseService.getLicenseType()} License</p>
          </div>
        </div>

        <TabStrip
          selected={selected}
          onSelect={(e) => setSelected(e.selected)}
          className="settings-tabs"
        >
          <TabStripTab title="Appearance">
            <div className="settings-section">
              <h3>Theme</h3>
              <ThemeSelector />
            </div>

            <div className="settings-section">
              <h3>Font</h3>
              <select className="settings-select">
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Fira Code">Fira Code</option>
                <option value="Hack">Hack</option>
              </select>
            </div>

            <div className="settings-section">
              <h3>Terminal Effects</h3>
              <label className="settings-checkbox">
                <input type="checkbox" defaultChecked />
                Matrix Rain Effect
              </label>
              <label className="settings-checkbox">
                <input type="checkbox" defaultChecked />
                Cursor Glow
              </label>
            </div>
          </TabStripTab>

          <TabStripTab title="Editor">
            <div className="settings-section">
              <h3>Behavior</h3>
              <label className="settings-checkbox">
                <input type="checkbox" defaultChecked />
                Auto Pair Brackets
              </label>
              <label className="settings-checkbox">
                <input type="checkbox" defaultChecked />
                Copy on Select
              </label>
            </div>
          </TabStripTab>

          <TabStripTab title="AI Features">
            <div className="settings-section">
              <h3>Voice Assistant</h3>
              <label className="settings-checkbox">
                <input type="checkbox" defaultChecked />
                Enable Voice Commands
              </label>
              <select className="settings-select">
                <option value="rina-ai">Rina AI (Default)</option>
                <option value="system">System Voice</option>
              </select>
            </div>
          </TabStripTab>

          <TabStripTab title="About">
            <div className="settings-section about">
              <p className="copyright">
                Copyright © 2025 RinaWarp Technologies, LLC. All Rights Reserved.
              </p>
              <p>
                RinaWarp and the RinaWarp logo are registered trademarks of
                RinaWarp Technologies, LLC.
              </p>
              <div className="company-info">
                RinaWarp Technologies, LLC<br />
                1035 N 1400 W<br />
                Salt Lake City, UT 84116<br />
                <a href="mailto:rinawarptechnologies25@gmail.com">
                  rinawarptechnologies25@gmail.com
                </a>
              </div>
            </div>
          </TabStripTab>
        </TabStrip>
      </div>

      <style>{`
        .settings-dialog {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .settings-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: linear-gradient(
            45deg,
            var(--rinawarp-hot-pink),
            var(--rinawarp-coral),
            var(--rinawarp-teal),
            var(--rinawarp-light-blue)
          );
          margin: -16px -16px 16px -16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header-text h2 {
          margin: 0;
          font-size: 24px;
          color: white;
        }

        .version {
          margin: 4px 0;
          font-size: 14px;
          opacity: 0.8;
          color: white;
        }

        .license-info {
          margin: 0;
          font-size: 12px;
          color: white;
          opacity: 0.7;
        }

        .settings-section {
          margin: 24px 0;
        }

        .settings-section h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: var(--rinawarp-hot-pink);
        }

        .settings-select {
          width: 100%;
          padding: 8px;
          border-radius: 4px;
          background: var(--rinawarp-bg-medium);
          border: 1px solid var(--rinawarp-bg-light);
          color: var(--rinawarp-text-primary);
        }

        .settings-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 0;
          cursor: pointer;
        }

        .about {
          text-align: center;
          padding: 24px;
        }

        .copyright {
          font-weight: bold;
          margin-bottom: 16px;
        }

        .company-info {
          margin-top: 24px;
          line-height: 1.6;
        }

        .company-info a {
          color: var(--rinawarp-hot-pink);
          text-decoration: none;
        }

        .company-info a:hover {
          text-decoration: underline;
        }

        .k-tabstrip {
          border: none;
          background: transparent;
        }

        .k-tabstrip > .k-tabstrip-items {
          background: var(--rinawarp-bg-medium);
          border-bottom: 1px solid var(--rinawarp-bg-light);
          padding: 0 16px;
        }

        .k-tabstrip-item {
          color: var(--rinawarp-text-secondary);
          border: none !important;
          margin: 0 4px;
        }

        .k-tabstrip-item.k-selected {
          color: var(--rinawarp-hot-pink);
          background: transparent;
        }

        .k-tabstrip-content {
          padding: 24px;
          background: transparent;
        }
      `}</style>
    </Dialog>
  );
};
