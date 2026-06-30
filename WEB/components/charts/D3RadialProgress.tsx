import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface D3RadialProgressProps {
  value: number;
  total: number;
  theme: 'midnight' | 'yellow';
  size?: number;
}

export default function D3RadialProgress({ value, total, theme, size = 60 }: D3RadialProgressProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear previous
    d3.select(containerRef.current).selectAll('*').remove();
    
    const percentage = total > 0 ? Math.min(value / total, 1) : 0;
    
    const radius = size / 2;
    const strokeWidth = 8;
    
    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', size)
      .attr('height', size)
      .append('g')
      .attr('transform', `translate(${radius},${radius})`);

    // Background Arc
    const bgArc = d3.arc()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(0)
      .endAngle(2 * Math.PI);

    svg.append('path')
      .attr('d', bgArc as any)
      .attr('fill', theme === 'midnight' ? '#333333' : '#E5E7EB');

    // Foreground Arc Generator
    const fgArc = d3.arc()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .cornerRadius(strokeWidth / 2)
      .startAngle(0);

    const fgColor = theme === 'midnight' ? '#00ff9d' : '#000000';

    const path = svg.append('path')
      .datum({ endAngle: 0 })
      .attr('fill', fgColor)
      .attr('d', fgArc as any);

    // Animate
    path.transition()
      .duration(1500)
      .ease(d3.easeElasticOut.amplitude(1).period(0.5))
      .attrTween('d', function(d: any) {
        const interpolate = d3.interpolate(d.endAngle, 2 * Math.PI * percentage);
        return function(t) {
          d.endAngle = interpolate(t);
          return fgArc(d as any) || '';
        };
      });

  }, [value, total, theme, size]);

  return <div ref={containerRef} style={{ width: size, height: size, display: 'inline-block' }} />;
}