import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import ChartCard from './ChartCard';

interface Props {
  data: { category: string; value: number; color: string }[];
  theme: 'yellow' | 'midnight';
  onExpand?: () => void;
}

const CategoryBarCard: React.FC<Props> = ({ data, theme, onExpand }) => {
  const isMidnight = theme === 'midnight';
  return (
    <ChartCard title="Gastos por categoria" theme={theme} onExpand={onExpand}>
      <div className="w-full h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fill: isMidnight ? '#b9cbbc' : '#374151', fontSize: 10, fontWeight: 700 }}
              width={90}
              tickLine={false}
              axisLine={false}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default CategoryBarCard;
