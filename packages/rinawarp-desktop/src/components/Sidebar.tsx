/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useState } from 'react';
import { AnalyticsDashboard } from './analytics/AnalyticsDashboard';
import { useAuth } from '../contexts/AuthContext';
import { ProfileEditor } from './profile/ProfileEditor';
import { SubscriptionManager } from './subscription/SubscriptionManager';
import { Button } from '@progress/kendo-react-buttons';
import { PanelBar, PanelBarItem } from '@progress/kendo-react-layout';
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showSubscriptionManager, setShowSubscriptionManager] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  return (
    <>
      <PanelBar>
        <PanelBarItem title="Account" expanded={true}>
          <div style={{ padding: 16 }}>
            <h4>{user?.displayName || 'User'}</h4>
            <p>{user?.email}</p>
            <Button
              look="flat"
              onClick={() => setShowProfileEditor(true)}
              style={{ marginRight: 8 }}
            >
              Edit Profile
            </Button>
            <Button
              look="flat"
              onClick={() => setShowSubscriptionManager(true)}
            >
              Manage Subscription
            </Button>
            <Button
              look="flat"
              onClick={() => setShowAnalytics(true)}
            >
              View Analytics
            </Button>
          </div>
        </PanelBarItem>
        <PanelBarItem title="Terminal Settings" expanded={false}>
        <div style={{ padding: 16 }}>
          <h4>Shell Type</h4>
          <p>Current: bash</p>
          
          <h4>Font Size</h4>
          <p>14px</p>
          
          <h4>Theme</h4>
          <p>Dark</p>
        </div>
      </PanelBarItem>
      <PanelBarItem title="Sessions">
        <div style={{ padding: 16 }}>
          <p>Terminal 1 (bash)</p>
          <p>Terminal 2 (zsh)</p>
        </div>
      </PanelBarItem>
      <PanelBarItem title="History">
        <div style={{ padding: 16 }}>
          <p>No history yet</p>
        </div>
      </PanelBarItem>
    </PanelBar>

      {showProfileEditor && (
        <ProfileEditor onClose={() => setShowProfileEditor(false)} />
      )}
      
      {showSubscriptionManager && (
        <SubscriptionManager onClose={() => setShowSubscriptionManager(false)} />
      )}
      {showAnalytics && (
        <Dialog title="Analytics Dashboard" width={1200}>
          <AnalyticsDashboard />
          <DialogActionsBar>
            <Button onClick={() => setShowAnalytics(false)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </>
  );
};

export default Sidebar;
