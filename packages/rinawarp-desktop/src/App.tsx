/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useEffect } from 'react';
import { BrandElements } from './components/brand/BrandElements';
import { useAuth } from './contexts/AuthContext';
import { AuthContainer } from './components/auth/AuthContainer';
import { Splitter } from '@progress/kendo-react-layout';
import { Button } from '@progress/kendo-react-buttons';
import { DropDownList } from '@progress/kendo-react-dropdowns';
import AdvancedTerminal from './components/terminal/AdvancedTerminal';
import Sidebar from './components/Sidebar';

const App: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <AuthContainer />;
  }
  const [panes, setPanes] = React.useState([
    { size: '20%', min: '150px', collapsible: true },
    {}
  ]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <BrandElements />
      <div style={{ padding: 8, borderBottom: '1px solid #ccc' }}>
        <Button>New Terminal</Button>
        <DropDownList
          style={{ width: 150, marginLeft: 8 }}
          data={['bash', 'zsh', 'fish']}
          defaultValue="bash"
        />
      </div>
      <Splitter
        style={{ flex: 1 }}
        panes={panes}
        onChange={(updatedPanes) => setPanes(updatedPanes)}
      >
        <Sidebar />
        <AdvancedTerminal />
      </Splitter>
    </div>
  );
};

export default App;
