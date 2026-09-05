import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';

interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutDatum[];
  centerLabel: string;
  theme: 'yellow' | 'midnight';
  onExpand?: () => void;
}

/** DESIGN.md "One Wire Rule": in Midnight, only volt-green (#00ff9d) is the primary wire — pass it as the first entry's color for the dominant series. */
const DonutStatusCard: React.FC<Props> = ({ data, centerLabel, theme, onExpand }) => {
  const isMidnight = theme === 'midnight';
  return (
    <ChartCard title="Status" theme={theme} onExpand={onExpand}>
      <div className="relative w-full h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="95%" startAngle={90} endAngle={-270}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center px-8">
          <span className={`text-base font-black text-center leading-tight ${isMidnight ? 'text-on-surface' : 'text-black'}`}>
            {centerLabel}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.map((d) => (
          <span key={d.label} className={`flex items-center gap-1 text-[10px] font-bold ${isMidnight ? 'text-on-surface-variant' : 'text-gray-700'}`}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.label}
          </span>
        ))}
      </div>
    </ChartCard>
  );
};

export default DonutStatusCard;
