/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */

import React, { useEffect, useRef } from 'react';
import { LicenseService } from '../../services/license.service';

interface BrandElementsProps {
  opacity?: number;
  showWatermark?: boolean;
  showPoweredBy?: boolean;
}

export const BrandElements: React.FC<BrandElementsProps> = ({
  opacity = 0.05,
  showWatermark = true,
  showPoweredBy = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const licenseService = LicenseService.getInstance();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Draw watermark pattern
    const drawWatermark = () => {
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set transparency
      ctx.globalAlpha = opacity;

      // Draw RinaWarp text watermark pattern
      ctx.save();
      ctx.font = '12px JetBrains Mono';
      ctx.fillStyle = '#FF69B4';
      
      // Create diagonal pattern
      for (let y = -100; y < canvas.height + 100; y += 100) {
        for (let x = -100; x < canvas.width + 100; x += 200) {
          ctx.save();
          ctx.translate(x + (y % 200), y);
          ctx.rotate(-Math.PI / 4);
          ctx.fillText('RinaWarp®', 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
    };

    drawWatermark();

    // Redraw on resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawWatermark();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [opacity]);

  const getLicenseLabel = () => {
    const type = licenseService.getLicenseType();
    if (!type) return 'Unregistered';
    return `${type.charAt(0).toUpperCase() + type.slice(1)} Edition`;
  };

  return (
    <>
      {showWatermark && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
      )}

      {showPoweredBy && (
        <div
          style={{
            position: 'fixed',
            bottom: 8,
            right: 8,
            fontSize: '10px',
            color: '#666',
            fontFamily: 'JetBrains Mono',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          RinaWarp® {getLicenseLabel()}
        </div>
      )}
    </>
  );
};
