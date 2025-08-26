/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@progress/kendo-theme-default/dist/all.css';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
