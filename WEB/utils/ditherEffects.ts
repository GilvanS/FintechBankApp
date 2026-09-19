/** Dither utilities used as decorative accents (Analytics tab). See DESIGN.md / docs/plans/2026-09-05-dashboard-analytics-allure-dither.md */

/** Pure pixel logic (no canvas dependency) — mutates `data` (RGBA Uint8ClampedArray) in place. Testable without a real Canvas2D context. */
export function floydSteinbergData(data: Uint8ClampedArray, w: number, h: number): void {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const oldVal = gray[idx];
      const newVal = oldVal < 128 ? 0 : 255;
      const err = oldVal - newVal;
      gray[idx] = newVal;
      if (x + 1 < w) gray[idx + 1] += (err * 7) / 16;
      if (x - 1 >= 0 && y + 1 < h) gray[idx + w - 1] += (err * 3) / 16;
      if (y + 1 < h) gray[idx + w] += (err * 5) / 16;
      if (x + 1 < w && y + 1 < h) gray[idx + w + 1] += (err * 1) / 16;
    }
  }
  for (let i = 0; i < w * h; i++) {
    const v = gray[i] < 128 ? 0 : 255;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
  }
}

export function applyFloydSteinberg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  floydSteinbergData(imageData.data, w, h);
  ctx.putImageData(imageData, 0, 0);
}

const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

export function bayer8x8Data(data: Uint8ClampedArray, w: number, h: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const threshold = (BAYER_8X8[y % 8][x % 8] / 64) * 255;
      const v = gray < threshold ? 0 : 255;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
    }
  }
}

export function applyBayer8x8(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  bayer8x8Data(imageData.data, w, h);
  ctx.putImageData(imageData, 0, 0);
}

/** Maps a 0-255 brightness value to a character in `chars` (darkest first). Pure, testable without canvas. */
export function grayToAsciiChar(gray: number, chars: string): string {
  const clamped = Math.max(0, Math.min(255, gray));
  const charIdx = Math.floor((clamped / 255) * (chars.length - 1));
  return chars[charIdx];
}

export function applyAsciiHalftone(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { chars?: string; cellSize?: number; bg?: string; color?: string } = {}
): void {
  const chars = opts.chars ?? ' .:-=+*#%@';
  const cellSize = opts.cellSize ?? 8;
  const bg = opts.bg ?? '#000';
  const color = opts.color ?? '#D4FF3D';
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.font = `${cellSize}px monospace`;
  ctx.fillStyle = color;
  for (let y = 0; y < h; y += cellSize) {
    for (let x = 0; x < w; x += cellSize) {
      const idx = (y * w + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      ctx.fillText(grayToAsciiChar(gray, chars), x, y + cellSize);
    }
  }
}
