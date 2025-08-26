/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React from 'react';

interface RinaWarpIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const RinaWarpIcon: React.FC<RinaWarpIconProps> = ({
  size = 24,
  color = '#FF69B4',
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ color }}
    >
      {/* Terminal outline */}
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      
      {/* Stylized "R" for Rina */}
      <path
        d="M7 8h3c1.1 0 2 .9 2 2s-.9 2-2 2H7v4"
        stroke={color}
        strokeWidth="2"
      />
      <path
        d="M10 12l2.5 4"
        stroke={color}
        strokeWidth="2"
      />
      
      {/* Warp effect lines */}
      <path
        d="M14 8c2 2.5 2 5.5 0 8"
        stroke={color}
        strokeWidth="2"
        opacity="0.8"
      />
      <path
        d="M16 8c2.5 2.5 2.5 5.5 0 8"
        stroke={color}
        strokeWidth="2"
        opacity="0.6"
      />
      <path
        d="M18 8c3 2.5 3 5.5 0 8"
        stroke={color}
        strokeWidth="2"
        opacity="0.4"
      />
    </svg>
  );
};
