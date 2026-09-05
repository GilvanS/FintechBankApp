import React, { useEffect, useRef } from 'react';
import { applyAsciiHalftone } from '../../utils/ditherEffects';

interface Props {
  theme: 'yellow' | 'midnight';
  opacity?: number;
}

/**
 * Textura ASCII/Halftone como plano de fundo sutil (opt-in).
 * Desenha uma textura em tile para minimizar o custo de CPU e renderização.
 */
export const AsciiBackdrop: React.FC<Props> = ({ theme, opacity = 0.04 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMidnight = theme === 'midnight';
  const accentColor = isMidnight ? '#00ff9d' : '#000000';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tileSize = 120;
    canvas.width = tileSize;
    canvas.height = tileSize;

    // Desenha gradiente de amostragem no tile
    const gradient = ctx.createLinearGradient(0, 0, tileSize, tileSize);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, tileSize, tileSize);

    // Aplica o dither ASCII/Halftone no tile
    applyAsciiHalftone(ctx, tileSize, tileSize);
  }, [theme, accentColor]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      style={{ opacity }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};

export default React.memo(AsciiBackdrop);
