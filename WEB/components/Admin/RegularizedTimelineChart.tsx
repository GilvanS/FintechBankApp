import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { adminGetRegularizedTimeline } from '../../services/api';

interface TimelineDay {
  date: string;
  label: string;
  count: number;
  totalAmount: number;
}

const RegularizedTimelineChart: React.FC = () => {
  const { theme } = useAppState();
  const isMidnight = theme === 'midnight';
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const result = await adminGetRegularizedTimeline();
      if (result.success) {
        setTimeline(result.timeline || []);
        setTotal(result.total || 0);
      }
    } catch {
      // Silêncio
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
    // Auto-refresh a cada 30s (sincronizado com o polling de regularizações)
    const interval = setInterval(fetchTimeline, 30000);
    return () => clearInterval(interval);
  }, []);

  const hasData = total > 0 && timeline.length > 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload as TimelineDay;
    return (
      <div className={`px-3 py-2 rounded-xl shadow-lg text-xs border ${
        isMidnight ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-white text-black border-gray-200'
      }`}>
        <p className="font-black mb-1">{data.label}</p>
        <p className="text-emerald-500 font-bold">{data.count} massa(s)</p>
        {data.totalAmount > 0 && (
          <p className="opacity-70">
            R$ {data.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-500" />
          <span className="text-xs font-black uppercase tracking-wider">
            Regularizações (7 dias)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-[10px] font-bold opacity-50">{total} total</span>
          )}
          <button
            onClick={fetchTimeline}
            disabled={loading}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-30"
            title="Atualizar gráfico"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-24 flex items-center justify-center">
          <div className={`w-5 h-5 rounded-full border-2 border-t-transparent animate-spin ${
            isMidnight ? 'border-white/30' : 'border-black/20'
          }`} />
        </div>
      ) : !hasData ? (
        <div className="h-24 flex items-center justify-center opacity-40">
          <p className="text-[10px] font-bold">Nenhum pagamento nos últimos 7 dias</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={timeline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: isMidnight ? '#a1a1aa' : '#71717a', fontWeight: 700 }}
              interval={0}
            />
            <YAxis hide domain={[0, Math.max(Math.max(...timeline.map(d => d.count), 1) + 1, 3)]} />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {timeline.map((entry, idx) => {
                const isToday = idx === timeline.length - 1;
                const isEmpty = entry.count === 0;
                if (isToday) {
                  return <Cell key={idx} fill={isEmpty ? (isMidnight ? '#27272a' : '#e4e4e7') : isMidnight ? '#a3e635' : '#10b981'} />;
                }
                return <Cell key={idx} fill={isEmpty ? (isMidnight ? '#27272a' : '#e4e4e7') : isMidnight ? '#34d399' : '#059669'} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {!loading && timeline.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${isMidnight ? 'bg-[#34d399]' : 'bg-[#059669]'}`} />
            <span className="text-[9px] font-bold opacity-50">Dias anteriores</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${isMidnight ? 'bg-[#a3e635]' : 'bg-[#10b981]'}`} />
            <span className="text-[9px] font-bold opacity-50">Hoje</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${isMidnight ? 'bg-[#27272a]' : 'bg-[#e4e4e7]'}`} />
            <span className="text-[9px] font-bold opacity-50">Sem dados</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegularizedTimelineChart;
