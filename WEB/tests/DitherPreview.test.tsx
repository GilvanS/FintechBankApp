import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DitherPreview from '../components/Analytics/DitherPreview';

describe('DitherPreview', () => {
  it('renders 3 canvases (one per method) with no imageSrc', () => {
    const { container } = render(<DitherPreview theme="midnight" />);
    expect(container.querySelectorAll('canvas').length).toBe(3);
  });

  it('renders the 3 method labels', () => {
    const { getByText } = render(<DitherPreview theme="yellow" />);
    expect(getByText('Floyd-Steinberg')).toBeInTheDocument();
    expect(getByText('Bayer 8x8')).toBeInTheDocument();
    expect(getByText('ASCII / Halftone')).toBeInTheDocument();
  });
});
