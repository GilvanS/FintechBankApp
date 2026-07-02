import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Clock } from 'lucide-react';
import type { Transaction } from '../types';

interface Props { transactions: Transaction[]; theme: string; }
type HeatmapMetric = 'amount' | 'frequency';
type HeatmapCategory = 'Todas' | 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros';

const CAT_CONFIG: Array<{ id: HeatmapCategory; label: string; color: string }> = [
  { id: 'Todas', label: 'Todas', color: '' },
  { id: 'refeicao', label: 'Refeição', color: '#FF5C8D' },
  { id: 'mobilidade', label: 'Mobilidade', color: '#00E5FF' },
  { id: 'cultura', label: 'Cultura', color: '#FFAA00' },
  { id: 'saude', label: 'Saúde', color: '#B026FF' },
  { id: 'outros', label: 'Outros', color: '#22c55e' },
];

const MONTH_OPTIONS = [
  { value: 'rolling', label: 'Últimos 3 meses', months: [{ month: 3, year: 2026 }, { month: 4, year: 2026 }, { month: 5, year: 2026 }] },
  { value: 'jun2026', label: 'Junho 2026',  months: [{ month: 5, year: 2026 }] },
  { value: 'may2026', label: 'Maio 2026',   months: [{ month: 4, year: 2026 }] },
  { value: 'apr2026', label: 'Abril 2026',  months: [{ month: 3, year: 2026 }] },
];

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAY_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const LABEL_ROWS = [1, 3, 5];

function getColor(value: number, max: number, isMidnight: boolean, cat: HeatmapCategory): string {
  if (value === 0) return isMidnight ? '#18181b' : '#f4f4f5';
  const ratio = Math.min(1, value / Math.max(max, 1));
  const idx = ratio < 0.15 ? 0 : ratio < 0.40 ? 1 : ratio < 0.75 ? 2 : 3;
  const P: Record<HeatmapCategory, [string[], string[]]> = {
    'Todas':      [['#064e3b','#047857','#10b981','#00ff9d'], ['#ffedd5','#fed7aa','#fb923c','#ea580c']],
    'refeicao':   [['#7f1d1d','#991b1b','#dc2626','#ef4444'], ['#ffe4e6','#fca5a5','#f87171','#ef4444']],
    'mobilidade': [['#0c4a6e','#0369a1','#0284c7','#00E5FF'], ['#e0f7ff','#7dd3fc','#38bdf8','#00E5FF']],
    'cultura':    [['#451a03','#92400e','#d97706','#FFB800'], ['#fffbe0','#fde68a','#fbbf24','#FFAA00']],
    'saude':      [['#3b0764','#6b21a8','#9333ea','#C278FF'], ['#f3e8ff','#d8b4fe','#c084fc','#B026FF']],
    'outros':     [['#064e3b','#047857','#10b981','#00DF89'], ['#f0fdf4','#bbf7d0','#4ade80','#22c55e']],
  };
  return isMidnight ? P[cat][0][idx] : P[cat][1][idx];
}

const SpendingHeatmapSection: React.FC<Props> = ({ transactions, theme }) => {
  const isMidnight = theme === 'midnight';
  const [metric, setMetric] = useState<HeatmapMetric>('amount');
  const [category, setCategory] = useState<HeatmapCategory>('Todas');
  const [selectedMonth, setSelectedMonth] = useState('rolling');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const activeOpt = MONTH_OPTIONS.find(o => o.value === selectedMonth) || MONTH_OPTIONS[0];

  const calendarData = useMemo(() => {
    const today = new Date(2026, 5, 27);
    return activeOpt.months.flatMap(({ month, year }) => {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const date = new Date(year, month, day);
        const dateStr = date.toDateString();
        const isFuture = date > today;
        const dayTxs = transactions.filter(tx => {
          const d = new Date(tx.date);
          return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
            && tx.amount < 0
            && (category === 'Todas' || (tx as any).category === category);
        });
        return { day, month, year, date, dateStr, isFuture, totalAmount: dayTxs.reduce((s, t) => s + Math.abs(t.amount), 0), count: dayTxs.length, txs: dayTxs };
      });
    });
  }, [transactions, category, activeOpt]);

  const maxValue = useMemo(() => {
    const vals = calendarData.filter(d => !d.isFuture).map(d => metric === 'amount' ? d.totalAmount : d.count);
    return Math.max(...vals, 1);
  }, [calendarData, metric]);

  const stats = useMemo(() => {
    const past = calendarData.filter(d => !d.isFuture);
    const shoppingDays = past.filter(d => d.count > 0).length;
    const maxDaily = Math.max(...past.map(d => d.totalAmount), 0);
    let streak = 0;
    for (const d of [...past].reverse()) { if (d.count > 0) streak++; else break; }
    return { shoppingDays, maxDaily, streak };
  }, [calendarData]);

  const anomalies = useMemo(() => {
    const active = calendarData.filter(d => !d.isFuture && d.totalAmount > 0);
    if (!active.length) return { high: [] as typeof active, low: [] as typeof active };
    const avg = active.reduce((s, d) => s + d.totalAmount, 0) / active.length;
    return { high: active.filter(d => d.totalAmount > avg * 2), low: active.filter(d => d.totalAmount < avg * 0.25) };
  }, [calendarData]);

  // Build week-column grid aligned to Sunday
  const { heatmapWeeks, colMonths } = useMemo(() => {
    if (!calendarData.length) return { heatmapWeeks: [] as (typeof calendarData[0] | null)[][], colMonths: [] as (number | null)[] };
    const first = calendarData[0].date;
    const firstSun = new Date(first); firstSun.setDate(first.getDate() - first.getDay());
    const last = calendarData[calendarData.length - 1].date;
    const lastSat = new Date(last); lastSat.setDate(last.getDate() + (6 - last.getDay()));
    const byDate = new Map(calendarData.map(d => [d.dateStr, d]));
    const cells: (typeof calendarData[0] | null)[] = [];
    const cur = new Date(firstSun);
    while (cur <= lastSat) { cells.push(byDate.get(cur.toDateString()) || null); cur.setDate(cur.getDate() + 1); }
    const numWeeks = cells.length / 7;
    const weeks = Array.from({ length: numWeeks }, (_, c) => Array.from({ length: 7 }, (_, r) => cells[c * 7 + r]));
    // Track which month each column starts
    const colM = weeks.map((week) => { const first = week.find(d => d !== null); return first ? first.month : null; });
    return { heatmapWeeks: weeks, colMonths: colM };
  }, [calendarData]);

  const cellSize = 14; const cellGap = 3; const stride = cellSize + cellGap;
  const labelOffset = 32;
  const svgWidth = labelOffset + heatmapWeeks.length * stride;
  const svgHeight = 18 + 7 * stride;
  const fillColor = isMidnight ? '#71717a' : '#6b7280';
  const selectedData = selectedDay ? calendarData.find(d => d.dateStr === selectedDay) || null : null;

  return (
    <section className={`rounded-2xl border-2 p-5 flex flex-col gap-4 ${
      isMidnight ? 'bg-zinc-900/40 border-zinc-800 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.15)]'
                 : 'bg-white border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
    }`}>

      {/* Header */}
      <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${isMidnight ? 'bg-[#00ff9d] text-black' : 'bg-[#FFED86] text-black'}`}>📅</div>
          <div>
            <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>Mapa de Calor de Gastos</h3>
            <p className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>
              {selectedMonth === 'rolling' ? 'Frequência e intensidade de despesas diárias nos últimos 3 meses' : `Frequência e intensidade de despesas em ${activeOpt.label}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          <div className="relative">
            <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setSelectedDay(null); }}
              className={`text-[9px] font-black uppercase tracking-wider pl-2.5 pr-7 py-2 rounded-lg border-2 border-black cursor-pointer appearance-none shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] focus:outline-none ${isMidnight ? 'bg-zinc-950 text-white border-zinc-800' : 'bg-white text-black border-black'}`}>
              {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-zinc-400">
              <svg className="fill-current h-3 w-3" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
          <div className={`flex items-center rounded-lg border-2 overflow-hidden shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] p-0.5 ${isMidnight ? 'bg-zinc-950 border-zinc-800' : 'bg-black/5 border-black'}`}>
            {([{ key: 'amount' as HeatmapMetric, label: 'Intensidade', Icon: TrendingUp }, { key: 'frequency' as HeatmapMetric, label: 'Frequência', Icon: Clock }]).map(({ key, label, Icon }) => (
              <button key={key} type="button" onClick={() => { setMetric(key); setSelectedDay(null); }}
                className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1 ${metric === key ? (isMidnight ? 'bg-[#00ff9d] text-zinc-950' : 'bg-[#FFED86] text-black') : 'text-zinc-400 hover:text-zinc-200'}`}>
                <Icon size={10} />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CAT_CONFIG.map(cat => (
          <button key={cat.id} type="button" onClick={() => { setCategory(cat.id); setSelectedDay(null); }}
            className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border-2 ${
              category === cat.id
                ? isMidnight ? 'bg-[#00ff9d] text-zinc-950 border-[#00ff9d] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'bg-[#FFED86] text-black border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]'
                : isMidnight ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white' : 'bg-white text-gray-700 border-black/10 hover:border-black/30'
            }`}>
            {cat.color && <span className="w-1.5 h-1.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: cat.color }} />}
            {cat.label}
          </button>
        ))}
      </div>

      {/* SVG Calendar (scrollable horizontally) */}
      <div className="w-full overflow-x-auto scrollbar-none pb-1 -mx-5 px-5">
        <svg width={svgWidth} height={svgHeight} className="overflow-visible select-none" style={{ minWidth: svgWidth }}>
          {/* Month labels at top — show when month changes */}
          {colMonths.map((m, colIdx) => {
            if (m === null) return null;
            if (colIdx > 0 && colMonths[colIdx - 1] === m) return null;
            return (
              <text key={`ml-${colIdx}`} x={labelOffset + colIdx * stride} y="12" style={{ fontSize: '9px', fontWeight: 900, fill: fillColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {MONTH_NAMES[m]}
              </text>
            );
          })}
          {/* Day-of-week labels */}
          {LABEL_ROWS.map(rowIdx => (
            <text key={`dl-${rowIdx}`} x="0" y={18 + rowIdx * stride + cellSize / 2 + 3} style={{ fontSize: '9px', fontWeight: 900, fill: fillColor }}>
              {DAY_LABELS[rowIdx]}
            </text>
          ))}
          {/* Cells */}
          {heatmapWeeks.map((week, colIdx) =>
            week.map((day, rowIdx) => {
              if (!day) return null;
              const xPos = labelOffset + colIdx * stride;
              const yPos = 18 + rowIdx * stride;
              const value = metric === 'amount' ? day.totalAmount : day.count;
              const cellColor = day.isFuture ? (isMidnight ? '#121214' : '#f9fafb') : getColor(value, maxValue, isMidnight, category);
              const isSelected = selectedDay === day.dateStr;
              const isHovered = hoveredDay === day.dateStr;
              return (
                <motion.rect key={`cell-${day.dateStr}`} x={xPos} y={yPos} width={cellSize} height={cellSize} rx="2.5" className="cursor-pointer"
                  animate={{ fill: cellColor, stroke: isSelected ? (isMidnight ? '#00ff9d' : '#000') : isHovered ? (isMidnight ? '#fff' : '#333') : (isMidnight ? '#27272a' : '#e4e4e7'), strokeWidth: isSelected ? 2 : isHovered ? 1.5 : day.isFuture ? 0.5 : 1, opacity: day.isFuture ? 0.4 : 1, scale: isSelected ? 1.15 : isHovered ? 1.1 : 1 }}
                  transition={{ fill: { duration: 0.3, delay: day.isFuture ? 0 : colIdx * 0.01 }, scale: { type: 'spring', stiffness: 350, damping: 18 } }}
                  style={{ transformOrigin: `${xPos + 7}px ${yPos + 7}px` }}
                  onMouseEnter={() => !day.isFuture && setHoveredDay(day.dateStr)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => !day.isFuture && setSelectedDay(isSelected ? null : day.dateStr)}
                />
              );
            })
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2">
        <span className={`text-[8px] font-black uppercase ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>Menos</span>
        <div className="flex gap-0.5">
          {[0, 0.2, 0.45, 0.75, 1].map((r, i) => (
            <div key={i} className="w-3.5 h-3.5 rounded border border-black/20" style={{ backgroundColor: getColor(r * maxValue, maxValue, isMidnight, category) }} />
          ))}
        </div>
        <span className={`text-[8px] font-black uppercase ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>Mais</span>
        <span className={`ml-auto text-[8px] font-bold ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>{metric === 'amount' ? 'por valor (R$)' : 'por frequência'}</span>
      </div>

      {/* Day detail or placeholder */}
      <AnimatePresence mode="wait">
        {selectedData ? (
          <motion.div key="detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className={`p-3 rounded-xl border-2 border-black ${isMidnight ? 'bg-zinc-900' : 'bg-[#FFED86] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}>
              <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${isMidnight ? 'text-white' : 'text-black'}`}>
                {selectedData.day} de {MONTH_NAMES[selectedData.month]} — {selectedData.count} {selectedData.count === 1 ? 'transação' : 'transações'}
              </p>
              {selectedData.count === 0 ? (
                <p className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>Nenhum gasto neste dia</p>
              ) : (
                <>
                  <p className={`text-sm font-black mb-2 ${isMidnight ? 'text-white' : 'text-black'}`}>R$ {selectedData.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} gastos</p>
                  <div className="flex flex-col gap-1 max-h-28 overflow-y-auto scrollbar-none">
                    {selectedData.txs.slice(0, 6).map((tx, idx) => (
                      <div key={idx} className={`flex justify-between items-center text-[9px] font-bold py-0.5 border-b ${isMidnight ? 'border-zinc-800 text-zinc-300' : 'border-black/10 text-gray-700'}`}>
                        <span className="truncate flex-1">{(tx as any).description || (tx as any).title || tx.type}</span>
                        <span className="font-black text-[#FF5C8D] ml-2 shrink-0">-R$ {Math.abs(tx.amount).toFixed(2)}</span>
                      </div>
                    ))}
                    {selectedData.count > 6 && <p className={`text-[8px] font-bold mt-1 ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>+{selectedData.count - 6} transações adicionais</p>}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.p key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`text-[10px] font-bold text-center py-1 ${isMidnight ? 'text-zinc-600' : 'text-gray-400'}`}>
            Toque em um dia para detalhar transações.
          </motion.p>
        )}
      </AnimatePresence>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Dias de Compras', value: `${stats.shoppingDays} dias` },
          { label: 'Maior Gasto Diário', value: `R$ ${stats.maxDaily.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
          { label: 'Streak Ativo', value: `${stats.streak} dias` },
        ].map(({ label, value }) => (
          <div key={label} className={`p-2.5 rounded-xl text-center ${isMidnight ? 'bg-zinc-900 border border-zinc-800' : 'bg-zinc-50 border-2 border-black/10'}`}>
            <p className={`text-[8px] font-black uppercase tracking-wider mb-0.5 ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>{label}</p>
            <p className={`text-[10px] font-black ${isMidnight ? 'text-white' : 'text-black'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Anomalias de Gasto */}
      <div className={`p-3 rounded-xl border-2 ${isMidnight ? 'border-zinc-800 bg-zinc-900/50' : 'border-black/10 bg-zinc-50'}`}>
        <p className={`text-[9px] font-black uppercase tracking-wider mb-2 ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>Anomalias de Gasto</p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isMidnight ? 'bg-[#ff0055]' : 'bg-orange-500'}`} />
              <span className={`text-[9px] font-bold ${isMidnight ? 'text-zinc-300' : 'text-gray-700'}`}>Gasto Alto (&gt;2.0x média)</span>
            </div>
            <span className={`text-[9px] font-black ${isMidnight ? 'text-[#ff0055]' : 'text-orange-600'}`}>{anomalies.high.length} dias</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isMidnight ? 'bg-[#00d2ff]' : 'bg-blue-500'}`} />
              <span className={`text-[9px] font-bold ${isMidnight ? 'text-zinc-300' : 'text-gray-700'}`}>Gasto Baixo (&lt;25% média)</span>
            </div>
            <span className={`text-[9px] font-black ${isMidnight ? 'text-[#00d2ff]' : 'text-blue-600'}`}>{anomalies.low.length} dias</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpendingHeatmapSection;
