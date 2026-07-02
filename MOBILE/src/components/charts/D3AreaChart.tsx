import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface D3AreaChartProps {
  data: { monthName: string; income: number; expenses: number }[];
  theme: 'midnight' | 'yellow';
  width?: string | number;
  height?: string | number;
}

export default function D3AreaChart({ data, theme, width = '100%', height = '100%' }: D3AreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;
    
    // Clear previous
    d3.select(containerRef.current).selectAll('*').remove();
    
    const clientRect = containerRef.current.getBoundingClientRect();
    const w = clientRect.width || 400;
    const h = clientRect.height || 200;
    
    const margin = { top: 20, right: 10, bottom: 20, left: 30 };
    const innerWidth = w - margin.left - margin.right;
    const innerHeight = h - margin.top - margin.bottom;

    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('preserveAspectRatio', 'none');

    // Scales
    const xScale = d3.scalePoint()
      .domain(data.map(d => d.monthName))
      .range([margin.left, w - margin.right])
      .padding(0);

    const maxY = d3.max(data, d => Math.max(d.income, d.expenses)) || 0;

    const yScale = d3.scaleLinear()
      .domain([0, maxY * 1.1])
      .range([h - margin.bottom, margin.top]);

    // Colors
    const incomeColor = theme === 'midnight' ? '#00ff9d' : '#000000';
    const expenseColor = theme === 'midnight' ? '#FF3B30' : '#FF3B30';

    // Gradients
    const defs = svg.append("defs");
    
    const createGradient = (id: string, color: string) => {
      const gradient = defs.append("linearGradient")
        .attr("id", id)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      gradient.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.4);
      gradient.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0.0);
    };

    createGradient(`gradient-income-${theme}`, incomeColor);
    createGradient(`gradient-expense-${theme}`, expenseColor);

    // Area & Line Generators
    const areaGenerator = (key: 'income' | 'expenses') => d3.area<any>()
      .x(d => xScale(d.monthName) || 0)
      .y0(h - margin.bottom)
      .y1(d => yScale(d[key]))
      .curve(d3.curveMonotoneX);

    const lineGenerator = (key: 'income' | 'expenses') => d3.line<any>()
      .x(d => xScale(d.monthName) || 0)
      .y(d => yScale(d[key]))
      .curve(d3.curveMonotoneX);

    // Append Area - Income
    const incomeArea = svg.append("path")
      .datum(data)
      .attr("fill", `url(#gradient-income-${theme})`)
      .attr("d", areaGenerator('income'))
      .attr("opacity", 0);
      
    incomeArea.transition().duration(1000).attr("opacity", 1);

    // Append Line - Income
    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", incomeColor)
      .attr("stroke-width", 2)
      .attr("d", lineGenerator('income'))
      .attr("stroke-dasharray", function() {
         const len = (this as SVGPathElement).getTotalLength();
         return `${len} ${len}`;
      })
      .attr("stroke-dashoffset", function() {
         return (this as SVGPathElement).getTotalLength();
      })
      .transition()
      .duration(1500)
      .attr("stroke-dashoffset", 0);

    // Append Area - Expense
    const expenseArea = svg.append("path")
      .datum(data)
      .attr("fill", `url(#gradient-expense-${theme})`)
      .attr("d", areaGenerator('expenses'))
      .attr("opacity", 0);
      
    expenseArea.transition().duration(1000).attr("opacity", 1).delay(500);

    // Append Line - Expense
    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", expenseColor)
      .attr("stroke-width", 2)
      .attr("d", lineGenerator('expenses'))
      .attr("stroke-dasharray", function() {
         const len = (this as SVGPathElement).getTotalLength();
         return `${len} ${len}`;
      })
      .attr("stroke-dashoffset", function() {
         return (this as SVGPathElement).getTotalLength();
      })
      .transition()
      .delay(500)
      .duration(1500)
      .attr("stroke-dashoffset", 0);

    // X Axis
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    svg.append('g')
       .attr('transform', `translate(0, ${h - margin.bottom})`)
       .call(xAxis)
       .select(".domain").attr("stroke", theme === 'midnight' ? '#333' : '#e5e7eb').attr("stroke-width", 2);
    
    svg.selectAll(".tick text")
       .attr("fill", theme === 'midnight' ? '#9CA3AF' : '#6B7280')
       .attr("font-size", "10px")
       .attr("font-weight", "bold");

    // Tooltip logic
    const tooltip = d3.select(containerRef.current)
      .append("div")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", theme === 'midnight' ? '#18181b' : '#FFFFFF')
      .style("border", `2px solid ${theme === 'midnight' ? '#333' : '#e5e7eb'}`)
      .style("border-radius", "8px")
      .style("padding", "8px")
      .style("color", theme === 'midnight' ? '#FFFFFF' : '#000000')
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("pointer-events", "none")
      .style("z-index", 10)
      .style("box-shadow", "0 4px 6px -1px rgba(0,0,0,0.1)");

    const focusLine = svg.append("line")
      .style("stroke", theme === 'midnight' ? '#333' : '#e5e7eb')
      .style("stroke-width", 1)
      .style("stroke-dasharray", "4,4")
      .style("display", "none")
      .attr("y1", margin.top)
      .attr("y2", h - margin.bottom);

    const overlay = svg.append("rect")
      .attr("width", w)
      .attr("height", h)
      .style("fill", "none")
      .style("pointer-events", "all");

    overlay.on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const domain = xScale.domain();
        const range = xScale.range();
        const step = xScale.step();
        
        let closestDomain = domain[0];
        let minDiff = Infinity;
        domain.forEach(d => {
            const x = xScale(d) || 0;
            if(Math.abs(mx - x) < minDiff) {
                minDiff = Math.abs(mx - x);
                closestDomain = d;
            }
        });

        const xPos = xScale(closestDomain) || 0;
        focusLine.style("display", null).attr("x1", xPos).attr("x2", xPos);
        
        const d = data.find(item => item.monthName === closestDomain);
        if(!d) return;

        tooltip
          .html(`
            <div style="margin-bottom:4px;font-weight:bold;">${d.monthName}</div>
            <div style="color:${incomeColor}">Receita: R$ ${d.income.toFixed(2)}</div>
            <div style="color:${expenseColor}">Despesa: R$ ${d.expenses.toFixed(2)}</div>
          `)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 28}px`)
          .style("visibility", "visible");
      })
      .on("mouseout", () => {
        focusLine.style("display", "none");
        tooltip.style("visibility", "hidden");
      });

  }, [data, theme]);

  return <div ref={containerRef} style={{ width, height, position: 'relative' }} />;
}