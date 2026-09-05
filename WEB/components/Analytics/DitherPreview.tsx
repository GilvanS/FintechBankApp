import React, { useEffect, useRef } from 'react';
import { applyFloydSteinberg, applyBayer8x8, applyAsciiHalftone } from '../../utils/ditherEffects';
import ChartCard from './ChartCard';

interface Props {
  /** Optional source image to dither. When omitted, a synthetic gradient+circle sample is drawn
   * instead — the project has no photographic assets to spare, and a generated tonal sample shows
   * each method's banding/pattern behavior just as clearly as a photo would. */
  imageSrc?: string;
  theme: 'yellow' | 'midnight';
}

const METHODS = [
  { key: 'floyd', label: 'Floyd-Steinberg', apply: applyFloydSteinberg },
  { key: 'bayer', label: 'Bayer 8x8', apply: applyBayer8x8 },
  { key: 'ascii', label: 'ASCII / Halftone', apply: (ctx: CanvasRenderingContext2D, w: number, h: number) => applyAsciiHalftone(ctx, w, h) },
] as const;

const SAMPLE_SIZE = 240;

function drawSamplePattern(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, '#000000');
  gradient.addColorStop(1, '#ffffff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 3, 0, Math.PI * 2);
  ctx.fillStyle = '#808080';
  ctx.fill();
}

const DitherPreview: React.FC<Props> = ({ imageSrc, theme }) => {
  const refs = useRef<Array<HTMLCanvasElement | null>>([null, null, null]);

  useEffect(() => {
    const renderInto = (canvas: HTMLCanvasElement, apply: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawSamplePattern(ctx, SAMPLE_SIZE, SAMPLE_SIZE);
      apply(ctx, SAMPLE_SIZE, SAMPLE_SIZE);
    };

    if (!imageSrc) {
      METHODS.forEach((method, i) => {
        const canvas = refs.current[i];
        if (canvas) renderInto(canvas, method.apply);
      });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      METHODS.forEach((method, i) => {
        const canvas = refs.current[i];
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        method.apply(ctx, img.width, img.height);
      });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {METHODS.map((method, i) => (
        <ChartCard key={method.key} title={method.label} theme={theme}>
          <canvas ref={(el) => { refs.current[i] = el; }} className="w-full h-auto rounded-lg" />
        </ChartCard>
      ))}
    </div>
  );
};

export default DitherPreview;
