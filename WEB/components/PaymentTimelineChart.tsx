/**
 * Gráfico de pagamentos do cliente (7 dias).
 * Lê GET /users/:cpf/statement, filtra INVOICE_PAYMENT e agrupa por dia.
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { useAppState } from '../contexts/AppStateContext';
import { getUserStatement } from '../services/api';

interface TimelineDay {
  date: string;
  label: string;
  count: number;
  totalAmount: number;
}

interface Props {
  userCpf: string;
}

const PaymentTimelineChart: React.FC<Props> = ({ userCpf }) => {
  const { theme } = useAppState();
  const isMidnight = theme === 'midnight';
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const result = await getUserStatement(userCpf);
      if (result.success && result.transactions) {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const dayMap = new Map<string, { count: number; totalAmount: number }>();
        let totalCount = 0;
        for (const tx of result.transactions) {
          if (tx.type !== 'INVOICE_PAYMENT' || !tx.date) continue;
          const d = new Date(tx.date);
          if (isNaN(d.getTime()) || d.getTime() < cutoff) continue;
          const day = d.toISOString().slice(0, 10);
          if (!dayMap.has(day)) dayMap.set(day, { count: 0, totalAmount: 0 });
          const entry = dayMap.get(day)!;
          entry.count++;
          entry.totalAmount += Math.abs(parseFloat(String(tx.amount)) || 0);
          totalCount++;
        }
        const days: TimelineDay[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const dayKey = d.toISOString().slice(0, 10);
          const data = dayMap.get(dayKey);
          days.push({
            date: dayKey,
            label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            count: data ? data.count : 0,
            totalAmount: data ? Math.round(data.totalAmount * 100) / 100 : 0,
          });
        }
        setTimeline(days);
        setTotal(totalCount);
      }
    } catch {
      // Silencio
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCpf]);

  const hasData = total > 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload as TimelineDay;
    return (
      <div className={`px-3 py-2 rounded-xl shadow-lg text-xs border ${
        isMidnight ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-white text-black border-gray-200'
      }`}>
        <p className="font-black mb-1">{data.label}</p>
        <p className="text-emerald-500 font-bold">{data.count} pagamento(s)</p>
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-500" />
          <span className="text-xs font-black uppercase tracking-wider">
            Meus Pagamentos (7 dias)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-[10px] font-bold opacity-50">{total} no total</span>
          )}
          <button
            onClick={fetchTimeline}
            disabled={loading}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-30"
            title="Atualizar"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-24 flex items-center justify-center">
          <div className={`w-5 h-5 rounded-full border-2 border-t-transparent animate-spin ${
            isMidnight ? 'border-white/30' : 'border-black/20'
          }`} />
        </div>
      ) : !hasData ? (
        <div className="h-24 flex items-center justify-center opacity-40">
          <p className="text-[10px] font-bold">Nenhum pagamento nos ultimos 7 dias</p>
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
            <YAxis hide domain={[0, Math.max(...timeline.map(d => d.count), 1) + 1]} />
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
    </div>
  );
};

export default PaymentTimelineChart;
