/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React from 'react';

interface WelcomeMessageProps {
  mode: string;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ mode }) => {
  const welcomeText = `
╔═══════════════════════════════════════════════╗
║                  RINAWARP                      ║
║                                               ║
║  • Press Cmd/Ctrl+P for command palette       ║
║  • Type "help" for available commands         ║
║  • Current mode: ${mode.padEnd(23)} ║
║                                               ║
║  AI-Powered Terminal                          ║
╚═══════════════════════════════════════════════╝

`;

  return welcomeText;
};
