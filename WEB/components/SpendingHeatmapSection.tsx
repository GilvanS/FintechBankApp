import React, { useState, useMemo } from 'react';
import type { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  theme: string;
}

type HeatmapMetric = 'amount' | 'frequency';
type HeatmapCategory = 'Todas' | 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros';

const DAY_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const CAT_LABELS: Record<HeatmapCategory, string> = {
  'Todas': 'Todas',
  'refeicao': '🍔 Refeição',
  'mobilidade': '🚗 Mobilidade',
  'cultura': '🎬 Cultura',
  'saude': '💊 Saúde',
  'outros': '📦 Outros',
};

function getColor(value: number, max: number, isMidnight: boolean, cat: HeatmapCategory): string {
  if (value === 0) return isMidnight ? '#18181b' : '#f4f4f5';
  const ratio = Math.min(1, value / Math.max(max, 1));
  const idx = ratio < 0.15 ? 0 : ratio < 0.40 ? 1 : ratio < 0.75 ? 2 : 3;
  const palettes: Record<HeatmapCategory, [string[], string[]]> = {
    'Todas':      [['#064e3b','#047857','#10b981','#00ff9d'], ['#ffedd5','#fed7aa','#fb923c','#ea580c']],
    'refeicao':   [['#7f1d1d','#991b1b','#dc2626','#ef4444'], ['#ffe4e6','#fca5a5','#f87171','#ef4444']],
    'mobilidade': [['#0c4a6e','#0369a1','#0284c7','#00E5FF'], ['#e0f7ff','#7dd3fc','#38bdf8','#00E5FF']],
    'cultura':    [['#451a03','#92400e','#d97706','#FFB800'], ['#fffbe0','#fde68a','#fbbf24','#FFAA00']],
    'saude':      [['#3b0764','#6b21a8','#9333ea','#C278FF'], ['#f3e8ff','#d8b4fe','#c084fc','#B026FF']],
    'outros':     [['#064e3b','#047857','#10b981','#00DF89'], ['#f0fdf4','#bbf7d0','#4ade80','#22c55e']],
  };
  const [dark, light] = palettes[cat];
  return isMidnight ? dark[idx] : light[idx];
}

const SpendingHeatmapSection: React.FC<Props> = ({ transactions, theme }) => {
  const isMidnight = theme === 'midnight';
  const [metric, setMetric] = useState<HeatmapMetric>('amount');
  const [category, setCategory] = useState<HeatmapCategory>('Todas');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const calendarData = useMemo(() => {
    const month = 5;
    const year = 2026;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date(2026, 5, 27);

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const isFuture = new Date(year, month, day) > today;
      const dayTxs = transactions.filter(tx => {
        const d = new Date(tx.date);
        return (
          d.getDate() === day && d.getMonth() === month && d.getFullYear() === year &&
          tx.amount < 0 &&
          (category === 'Todas' || (tx as any).category === category)
        );
      });
      return {
        day,
        isFuture,
        totalAmount: dayTxs.reduce((s, tx) => s + Math.abs(tx.amount), 0),
        count: dayTxs.length,
        txs: dayTxs,
      };
    });
  }, [transactions, category]);

  const maxValue = useMemo(() => {
    const values = calendarData.filter(d => !d.isFuture).map(d => metric === 'amount' ? d.totalAmount : d.count);
    return Math.max(...values, 1);
  }, [calendarData, metric]);

  const firstDayOffset = new Date(2026, 5, 1).getDay();
  const cells: (typeof calendarData[0] | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...calendarData,
  ];

  const selectedData = selectedDay !== null ? calendarData[selectedDay - 1] : null;

  return (
    <section className={`rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4 ${
      isMidnight ? 'bg-volt-surface' : 'bg-white'
    }`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#B026FF] border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs text-white">
            🗓
          </div>
          <div>
            <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>Mapa de Calor de Gastos</h3>
            <p className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>Distribuição diária — Junho/2026</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(['amount','frequency'] as HeatmapMetric[]).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full border-2 border-black transition-all cursor-pointer ${
                metric === m
                  ? isMidnight ? 'bg-[#00ff9d] text-black' : 'bg-[#A2FF00] text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                  : isMidnight ? 'bg-zinc-900 text-zinc-400 border-zinc-700' : 'bg-white text-gray-600 border-black/20'
              }`}
            >
              {m === 'amount' ? 'R$' : '#'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {(Object.keys(CAT_LABELS) as HeatmapCategory[]).map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`text-[9px] font-black px-2.5 py-1 rounded-full shrink-0 border-2 border-black transition-all cursor-pointer ${
              category === cat
                ? isMidnight ? 'bg-[#00ff9d] text-black' : 'bg-[#FFED86] text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                : isMidnight ? 'bg-zinc-900 text-zinc-400 border-zinc-700' : 'bg-white text-gray-600 border-black/20'
            }`}
          >
            {CAT_LABELS[cat]}
          </button>
        ))}
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {DAY_LABELS.map(d => (
            <div key={d} className={`text-[8px] font-black text-center uppercase tracking-wider ${isMidnight ? 'text-zinc-500' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`e-${i}`} />;
            const value = metric === 'amount' ? cell.totalAmount : cell.count;
            const bg = cell.isFuture ? (isMidnight ? '#09090b' : '#f9fafb') : getColor(value, maxValue, isMidnight, category);
            const isSelected = selectedDay === cell.day;
            return (
              <button
                key={cell.day}
                onClick={() => setSelectedDay(isSelected ? null : cell.day)}
                disabled={cell.isFuture}
                title={!cell.isFuture ? `${cell.day}/Jun — R$ ${cell.totalAmount.toFixed(2)} (${cell.count} transações)` : undefined}
                className={`aspect-square rounded-md flex items-center justify-center text-[9px] font-black transition-all ${
                  isSelected ? 'ring-2 ring-black scale-110' : 'hover:scale-105 active:scale-90'
                } ${cell.isFuture ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ backgroundColor: bg }}
              >
                <span className={value > 0 && !cell.isFuture ? 'text-black' : (isMidnight ? 'text-zinc-600' : 'text-gray-400')}>
                  {cell.day}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-[8px] font-black uppercase ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>Menos</span>
        <div className="flex gap-0.5">
          {[0, 0.2, 0.45, 0.75, 1].map((r, i) => (
            <div key={i} className="w-4 h-4 rounded border border-black/20"
              style={{ backgroundColor: getColor(r * maxValue, maxValue, isMidnight, category) }} />
          ))}
        </div>
        <span className={`text-[8px] font-black uppercase ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>Mais</span>
        <span className={`ml-auto text-[8px] font-bold ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>
          {metric === 'amount' ? 'por valor (R$)' : 'por frequência'}
        </span>
      </div>

      {selectedData && (
        <div className={`p-3 rounded-xl border-2 border-black ${
          isMidnight ? 'bg-zinc-900' : 'bg-[#FFED86] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
        }`}>
          <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${isMidnight ? 'text-white' : 'text-black'}`}>
            {selectedData.day} de Junho — {selectedData.count} {selectedData.count === 1 ? 'transação' : 'transações'}
          </p>
          {selectedData.count === 0 ? (
            <p className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>Nenhum gasto neste dia</p>
          ) : (
            <>
              <p className={`text-sm font-black mb-2 ${isMidnight ? 'text-white' : 'text-black'}`}>
                R$ {selectedData.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} gastos
              </p>
              <div className="flex flex-col gap-1 max-h-28 overflow-y-auto scrollbar-none">
                {selectedData.txs.slice(0, 6).map((tx, idx) => (
                  <div key={idx} className={`flex justify-between items-center text-[9px] font-bold py-0.5 border-b ${
                    isMidnight ? 'border-zinc-800 text-zinc-300' : 'border-black/10 text-gray-700'
                  }`}>
                    <span className="truncate flex-1">{(tx as any).description || (tx as any).title || tx.type}</span>
                    <span className="font-black text-[#FF5C8D] ml-2 shrink-0">-R$ {Math.abs(tx.amount).toFixed(2)}</span>
                  </div>
                ))}
                {selectedData.count > 6 && (
                  <p className={`text-[8px] font-bold mt-1 ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>
                    +{selectedData.count - 6} transações adicionais
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default SpendingHeatmapSection;
