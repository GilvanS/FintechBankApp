import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard';

interface Props {
  data: { month: string; entradas: number; saidas: number }[];
  theme: 'yellow' | 'midnight';
  onExpand?: () => void;
}

const TrendLineCard: React.FC<Props> = ({ data, theme, onExpand }) => {
  const isMidnight = theme === 'midnight';
  const entradasColor = isMidnight ? '#00ff9d' : '#000000';
  const saidasColor = isMidnight ? '#FF5C8D' : '#FFD700';

  return (
    <ChartCard title="Tendencia (6 meses)" subtitle="Entradas x Saidas" theme={theme} onExpand={onExpand}>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isMidnight ? '#353534' : '#e5e7eb'} />
            <XAxis dataKey="month" tick={{ fill: isMidnight ? '#b9cbbc' : '#374151', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
            <YAxis
              width={70}
              tick={{ fill: isMidnight ? '#b9cbbc' : '#374151', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                return `${v}`;
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className={`p-3 rounded-xl border-2 border-black text-[11px] font-black ${isMidnight ? 'bg-volt-surface text-on-surface' : 'bg-white text-black'}`}>
                      <p className="mb-1">{label}</p>
                      {payload.map((entry, idx) => (
                        <div key={idx} style={{ color: entry.color as string }}>
                          {entry.name}: R$ {Number(entry.value).toFixed(2)}
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line type="monotone" dataKey="entradas" name="Entradas" stroke={entradasColor} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="saidas" name="Saidas" stroke={saidasColor} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default TrendLineCard;
