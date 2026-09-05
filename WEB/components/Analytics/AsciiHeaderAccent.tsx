import React, { useEffect, useRef } from 'react';
import { applyAsciiHalftone } from '../../utils/ditherEffects';

interface Props {
  theme: 'yellow' | 'midnight';
  width?: number;
  height?: number;
}

function drawSamplePattern(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, '#000000');
  gradient.addColorStop(1, '#ffffff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Decorative ASCII/Halftone header accent for the Analytics view — chosen from the 3 dither
 * methods in WEB/utils/ditherEffects.ts (see docs/plans/2026-09-05-dashboard-analytics-allure-dither.md
 * Task 5). A single static render, not a loop — this is texture, not data, so it never needs to
 * update. aria-hidden + pointer-events:none, same convention as Hero3D in this same header.
 */
const AsciiHeaderAccent: React.FC<Props> = ({ theme, width = 120, height = 40 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accentColor = theme === 'midnight' ? '#00ff9d' : '#000000';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawSamplePattern(ctx, width, height);
    applyAsciiHalftone(ctx, width, height, { cellSize: 6 });
    // applyAsciiHalftone paints a solid black background with characters in a fixed color.
    // Recolor characters to the theme accent (One Wire Rule: volt-green in midnight, black in
    // yellow) AND make the background transparent instead of opaque black — otherwise the yellow
    // theme's black-on-black text renders invisible against its own background.
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const [r, g, b] = accentColor.match(/[0-9a-f]{2}/gi)!.map((h) => parseInt(h, 16));
    for (let i = 0; i < data.length; i += 4) {
      const isBackground = data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0;
      if (isBackground) {
        data[i + 3] = 0;
      } else {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [theme, width, height, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      aria-hidden="true"
      style={{ width, height, pointerEvents: 'none', opacity: 0.7 }}
      className="rounded-md hidden sm:block"
    />
  );
};

export default React.memo(AsciiHeaderAccent);
