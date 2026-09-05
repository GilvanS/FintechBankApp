import { describe, it, expect } from 'vitest';
import { floydSteinbergData, bayer8x8Data, grayToAsciiChar } from '../utils/ditherEffects';

function makeGradientRGBA(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const v = Math.round((x / (w - 1)) * 255);
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return data;
}

describe('floydSteinbergData', () => {
  it('produces only pure black/white pixels', () => {
    const data = makeGradientRGBA(32, 32);
    floydSteinbergData(data, 32, 32);
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i]);
    }
  });
});

describe('bayer8x8Data', () => {
  it('produces only pure black/white pixels', () => {
    const data = makeGradientRGBA(32, 32);
    bayer8x8Data(data, 32, 32);
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i]);
    }
  });
});

describe('grayToAsciiChar', () => {
  it('maps 0 to the first (darkest) char', () => {
    expect(grayToAsciiChar(0, ' .:-=+*#%@')).toBe(' ');
  });

  it('maps 255 to the last (brightest) char', () => {
    expect(grayToAsciiChar(255, ' .:-=+*#%@')).toBe('@');
  });

  it('clamps out-of-range values', () => {
    expect(grayToAsciiChar(-50, ' .:-=+*#%@')).toBe(' ');
    expect(grayToAsciiChar(500, ' .:-=+*#%@')).toBe('@');
  });
});
