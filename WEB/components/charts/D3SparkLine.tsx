import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface D3SparkLineProps {
  data: { date: string; balance: number }[];
  theme: 'midnight' | 'yellow';
  width?: string | number;
  height?: string | number;
}

export default function D3SparkLine({ data, theme, width = '100%', height = '100%' }: D3SparkLineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;
    
    // Clear previous
    d3.select(containerRef.current).selectAll('*').remove();
    
    const clientRect = containerRef.current.getBoundingClientRect();
    const w = clientRect.width || 300; // fallback width
    const h = clientRect.height || 100; // fallback height
    
    const margin = { top: 10, right: 10, bottom: 20, left: 10 };

    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('preserveAspectRatio', 'none');

    // Create scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d.date)) as [Date, Date])
      .range([margin.left, w - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([
        Math.min(0, d3.min(data, d => d.balance) || 0),
        d3.max(data, d => d.balance) || 0
      ])
      .range([h - margin.bottom, margin.top]);

    // Create gradient
    const defs = svg.append("defs");
    const gradientId = `sparkline-gradient-${theme}`;
    const gradient = defs.append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    const color = theme === 'midnight' ? '#00ff9d' : '#000000';
    
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", color)
      .attr("stop-opacity", 0.3);
      
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", color)
      .attr("stop-opacity", 0.0);

    // Area generator
    const area = d3.area<{ date: string; balance: number }>()
      .x(d => xScale(new Date(d.date)))
      .y0(h - margin.bottom)
      .y1(d => yScale(d.balance))
      .curve(d3.curveMonotoneX);

    // Line generator
    const line = d3.line<{ date: string; balance: number }>()
      .x(d => xScale(new Date(d.date)))
      .y(d => yScale(d.balance))
      .curve(d3.curveMonotoneX);

    // Append Area
    const pathArea = svg.append("path")
      .datum(data)
      .attr("fill", `url(#${gradientId})`)
      .attr("d", area)
      .attr("opacity", 0);

    pathArea.transition()
      .duration(1000)
      .attr("opacity", 1);

    // Append Line
    const pathLine = svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 3)
      .attr("d", line);

    // Animate line
    const pathNode = pathLine.node() as SVGPathElement;
    const totalLength = typeof pathNode.getTotalLength === 'function' ? pathNode.getTotalLength() : 100;

    pathLine
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1500)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    // Add X-axis simple markers
    const dates = data.map(d => new Date(d.date));
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    
    if (firstDate && lastDate) {
       const xAxis = svg.append('g')
          .attr('transform', `translate(0, ${h - margin.bottom + 5})`);
          
       xAxis.append('text')
          .attr('x', margin.left)
          .attr('y', 10)
          .attr('fill', '#000000')
          .attr('font-size', '9px')
          .attr('font-weight', '900')
          .text(firstDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

       xAxis.append('text')
          .attr('x', w - margin.right)
          .attr('y', 10)
          .attr('text-anchor', 'end')
          .attr('fill', '#000000')
          .attr('font-size', '9px')
          .attr('font-weight', '900')
          .text(lastDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    }

    // Add overlay for Tooltip
    const tooltip = d3.select(containerRef.current)
      .append("div")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", theme === 'midnight' ? '#18181b' : '#FFFFFF')
      .style("border", "3px solid #000000")
      .style("border-radius", "12px")
      .style("box-shadow", "4px 4px 0px 0px rgba(0,0,0,1)")
      .style("padding", "5px 10px")
      .style("color", theme === 'midnight' ? '#FFFFFF' : '#000000')
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .style("pointer-events", "none")
      .style("z-index", 10);

    const overlay = svg.append("rect")
      .attr("width", w)
      .attr("height", h)
      .style("fill", "none")
      .style("pointer-events", "all");

    // Add focus circle
    const focus = svg.append("g")
      .style("display", "none");

    focus.append("circle")
      .attr("r", 5)
      .attr("fill", theme === 'midnight' ? '#00ff9d' : '#A2FF00')
      .attr("stroke", "#000000")
      .attr("stroke-width", 2);

    const bisectDate = d3.bisector<{date:string, balance:number}, Date>(d => new Date(d.date)).left;

    overlay.on("mouseover", () => {
        focus.style("display", null);
        tooltip.style("visibility", "visible");
      })
      .on("mouseout", () => {
        focus.style("display", "none");
        tooltip.style("visibility", "hidden");
      })
      .on("mousemove", (event) => {
        const x0 = xScale.invert(d3.pointer(event)[0]);
        const i = bisectDate(data, x0, 1);
        const d0 = data[i - 1];
        const d1 = data[i];
        if(!d0 || !d1) return;
        
        const d = x0.getTime() - new Date(d0.date).getTime() > new Date(d1.date).getTime() - x0.getTime() ? d1 : d0;
        
        focus.attr("transform", `translate(${xScale(new Date(d.date))},${yScale(d.balance)})`);
        
        tooltip
          .html(`R$ ${d.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
          .style("left", `${(event.pageX + 10)}px`)
          .style("top", `${(event.pageY - 28)}px`);
      });

  }, [data, theme]);

  return <div ref={containerRef} style={{ width, height, position: 'relative' }} />;
}