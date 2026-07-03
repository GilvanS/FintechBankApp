import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import type { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  theme: string;
}

type InsightTab = 'Todas' | 'Refeição' | 'Mobilidade' | 'Cultura' | 'Saúde' | 'Outros';

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const SEEDED: Record<string, number[]> = {
  refeicao:   [45.0, 60.0, 35.0, 90.0, 55.0, 0],
  mobilidade: [30.0, 50.0, 25.0, 70.0, 45.0, 0],
  cultura:    [20.0, 40.0, 15.0, 50.0, 30.0, 0],
  saude:      [15.0, 30.0, 10.0, 40.0, 25.0, 0],
  outros:     [75.5, 60.2, 65.0, 60.8, 70.45, 0],
};
const TABS: InsightTab[] = ['Todas','Refeição','Mobilidade','Cultura','Saúde','Outros'];

const SpendingTrendsSection: React.FC<Props> = ({ transactions, theme }) => {
  const isMidnight = theme === 'midnight';
  const [activeTab, setActiveTab] = useState<InsightTab>('Todas');
  const [chartVisible, setChartVisible] = useState(() =>
    localStorage.getItem('volt_spending_insights_visible') !== 'false'
  );

  const categoryColors: Record<InsightTab, string> = useMemo(() => ({
    'Todas':      isMidnight ? '#00ff9d' : '#A2FF00',
    'Refeição':   isMidnight ? '#FF5E5E' : '#FF5C8D',
    'Mobilidade': isMidnight ? '#0084FF' : '#00E5FF',
    'Cultura':    isMidnight ? '#FFB800' : '#FFAA00',
    'Saúde':      isMidnight ? '#C278FF' : '#B026FF',
    'Outros':     isMidnight ? '#00DF89' : '#22c55e',
  }), [isMidnight]);

  const trendsData = useMemo(() => {
    const now = new Date(2026, 5, 24);
    return Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const mi = d.getMonth();
      const yr = d.getFullYear();
      const sums: Record<string, number> = { refeicao:0, mobilidade:0, cultura:0, saude:0, outros:0 };
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === mi && txDate.getFullYear() === yr && tx.amount < 0) {
          const cat = (tx as any).category || 'outros';
          if (cat in sums) sums[cat] += Math.abs(tx.amount); else sums.outros += Math.abs(tx.amount);
        }
      });
      const getVal = (key: string) => {
        const actual = sums[key];
        return parseFloat((actual > 0 ? actual : (SEEDED[key][i] || 0)).toFixed(2));
      };
      return {
        month: `${MONTH_NAMES[mi]}/${String(yr).slice(-2)}`,
        'Refeição': getVal('refeicao'),
        'Mobilidade': getVal('mobilidade'),
        'Cultura': getVal('cultura'),
        'Saúde': getVal('saude'),
        'Outros': getVal('outros'),
        total: ['refeicao','mobilidade','cultura','saude','outros'].reduce((s, k) => s + getVal(k), 0),
      };
    });
  }, [transactions]);

  const tooltipStyle = {
    backgroundColor: isMidnight ? '#18181b' : '#fff',
    border: `2px solid ${isMidnight ? '#27272a' : '#000'}`,
    borderRadius: '8px',
    color: isMidnight ? '#fff' : '#000',
    fontSize: '10px',
    fontWeight: 'bold' as const,
  };

  const last = trendsData[5];
  const prev = trendsData[4];
  const currVal = activeTab === 'Todas' ? last.total : (last[activeTab] as number) || 0;
  const prevVal = activeTab === 'Todas' ? prev.total : (prev[activeTab] as number) || 0;
  const delta = prevVal > 0 ? ((currVal - prevVal) / prevVal) * 100 : 0;

  return (
    <section className={`rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4 ${
      isMidnight ? 'bg-volt-surface' : 'bg-white'
    }`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#FFAA00] border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs text-black">
            📈
          </div>
          <div>
            <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>Tendências de Gastos</h3>
            <p className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>Evolução mensal por categoria (6 meses)</p>
          </div>
        </div>
        <button
          onClick={() => {
            const next = !chartVisible;
            setChartVisible(next);
            localStorage.setItem('volt_spending_insights_visible', String(next));
          }}
          className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] hover:scale-95 transition-all cursor-pointer flex items-center gap-1.5 ${
            isMidnight ? 'bg-zinc-900 text-zinc-300 border-zinc-700' : 'bg-gray-100 text-black'
          }`}
        >
          {chartVisible ? <><EyeOff size={11} /><span>Ocultar</span></> : <><Eye size={11} /><span>Exibir</span></>}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {chartVisible && (
          <motion.div
            key="chart"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col gap-4 overflow-hidden"
          >
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {TABS.map(tab => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full shrink-0 cursor-pointer flex items-center gap-1 border-2 transition-all ${
                      isActive
                        ? isMidnight
                          ? 'bg-volt-green text-zinc-950 border-volt-green'
                          : 'bg-[#FFED86] text-black border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                        : isMidnight
                          ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                          : 'bg-white text-gray-700 border-black/20 hover:border-black/50'
                    }`}
                  >
                    {tab !== 'Todas' && (
                      <span className="w-1.5 h-1.5 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: categoryColors[tab] }} />
                    )}
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="w-full h-44">
              <ResponsiveContainer width="100%" height="100%">
                {activeTab === 'Todas' ? (
                  <LineChart data={trendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isMidnight ? '#27272a' : '#e5e7eb'} />
                    <XAxis dataKey="month" tick={{ fill: isMidnight ? '#71717a' : '#6b7280', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: isMidnight ? '#71717a' : '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `R$${v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, '']} />
                    {(['Refeição','Mobilidade','Cultura','Saúde','Outros'] as InsightTab[]).map(cat => (
                      <Line key={cat} type="monotone" dataKey={cat} stroke={categoryColors[cat]} strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 2, fill: isMidnight ? '#09090b' : '#fff' }} activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                ) : (
                  <AreaChart data={trendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradAreaTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={categoryColors[activeTab]} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={categoryColors[activeTab]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isMidnight ? '#27272a' : '#e5e7eb'} />
                    <XAxis dataKey="month" tick={{ fill: isMidnight ? '#71717a' : '#6b7280', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: isMidnight ? '#71717a' : '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `R$${v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, activeTab]} />
                    <Area type="monotone" dataKey={activeTab} stroke={categoryColors[activeTab]} strokeWidth={2.5}
                      fill="url(#gradAreaTrend)" activeDot={{ r: 5 }} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Este mês', value: `R$ ${currVal.toFixed(2)}`, color: isMidnight ? 'text-white' : 'text-black' },
                { label: 'Mês anterior', value: `R$ ${prevVal.toFixed(2)}`, color: isMidnight ? 'text-zinc-300' : 'text-gray-700' },
                { label: 'Variação', value: `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`, color: delta > 0 ? 'text-[#FF5C8D]' : 'text-[#00CC7A]' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`p-2.5 rounded-xl text-center ${
                  isMidnight ? 'bg-zinc-900 border border-zinc-800' : 'bg-[#FFED86] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                }`}>
                  <p className={`text-[8px] font-black uppercase tracking-wider mb-0.5 ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>{label}</p>
                  <p className={`text-[10px] font-black ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default SpendingTrendsSection;
