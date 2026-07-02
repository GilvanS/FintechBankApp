import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface HeatmapData {
  date: string; // YYYY-MM-DD
  value: number; // amount spent
}

interface D3HeatmapProps {
  data: HeatmapData[];
  theme: 'midnight' | 'yellow';
  width?: string | number;
  height?: string | number;
}

export default function D3Heatmap({ data, theme, width = '100%', height = '100%' }: D3HeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;
    
    // Clear previous
    d3.select(containerRef.current).selectAll('*').remove();
    
    const clientRect = containerRef.current.getBoundingClientRect();
    const w = clientRect.width || 300;
    const h = clientRect.height || 150;
    
    const margin = { top: 10, right: 10, bottom: 20, left: 20 };
    const innerWidth = w - margin.left - margin.right;
    const innerHeight = h - margin.top - margin.bottom;

    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Days of week (0 = Sunday)
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // Process data to get week index and day index
    // Assuming data is within a single month for simplicity, or we map to a grid
    // For a generic heatmap, we can map date -> x (week of month) and y (day of week)
    const parsedData = data.map(d => {
      const date = new Date(d.date);
      return {
        ...d,
        dayOfWeek: date.getDay(),
        weekOfMonth: Math.floor((date.getDate() - 1) / 7),
        parsedDate: date
      };
    });

    const maxWeek = d3.max(parsedData, d => d.weekOfMonth) || 4;
    
    const cellSize = Math.min(innerWidth / (maxWeek + 1), innerHeight / 7) - 4;
    
    const colorScale = d3.scaleSequential()
      .interpolator(theme === 'midnight' ? d3.interpolateGreens : d3.interpolateOranges)
      .domain([0, d3.max(data, d => d.value) || 100]);

    const emptyColor = theme === 'midnight' ? '#333333' : '#E5E7EB';

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Draw cells
    const cells = g.selectAll('rect')
      .data(parsedData, (d: any) => d.date)
      .enter()
      .append('rect')
      .attr('x', d => d.weekOfMonth * (cellSize + 4))
      .attr('y', d => d.dayOfWeek * (cellSize + 4))
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', emptyColor)
      .attr('stroke', theme === 'midnight' ? '#000000' : '#FFFFFF')
      .attr('stroke-width', 1);

    cells.transition()
      .duration(1000)
      .delay((d, i) => i * 20)
      .attr('fill', d => d.value > 0 ? colorScale(d.value) : emptyColor);
      
    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .append("div")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", theme === 'midnight' ? '#18181b' : '#FFFFFF')
      .style("border", `1px solid ${theme === 'midnight' ? '#333' : '#e5e7eb'}`)
      .style("border-radius", "4px")
      .style("padding", "4px 8px")
      .style("color", theme === 'midnight' ? '#FFFFFF' : '#000000')
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .style("z-index", 10);

    cells
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget).attr("stroke", theme === 'midnight' ? '#00ff9d' : '#000000').attr("stroke-width", 2);
        tooltip.html(`Dia ${d.parsedDate.getDate()}: R$ ${d.value.toFixed(2)}`)
               .style("visibility", "visible");
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.pageX + 10}px`)
               .style("top", `${event.pageY - 20}px`);
      })
      .on("mouseout", (event) => {
        d3.select(event.currentTarget).attr("stroke", theme === 'midnight' ? '#000000' : '#FFFFFF').attr("stroke-width", 1);
        tooltip.style("visibility", "hidden");
      });

  }, [data, theme]);

  return <div ref={containerRef} style={{ width, height, position: 'relative' }} />;
}