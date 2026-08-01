import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, ArrowDownCircle, Calendar, DollarSign, Filter, CalendarDays, Download, ChevronDown } from 'lucide-react';
import { PaymentEntry } from '../types';
import { useAppState } from '../contexts/AppStateContext';
import PaymentTypeFilter from './PaymentTypeFilter';

interface PaymentHistoryModalProps {
  open: boolean;
  onClose: () => void;
  payments: PaymentEntry[];
  totalDue?: number;
}

type PaymentFilter = 'ALL' | 'TOTAL' | 'MINIMO' | 'PARCIAL';
type PeriodFilter = 'ALL' | '7D' | '30D' | '90D';

const MONTHS_PT: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

const fmt = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '').toUpperCase();
  } catch {
    return dateStr;
  }
};

const fmtTime = (iso: string) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
};

const paymentTypeConfig = {
  TOTAL: {
    label: 'Pagamento Total',
    icon: CheckCircle2,
    color: 'emerald',
    desc: 'Fatura quitada integralmente',
  },
  MINIMO: {
    label: 'Pagamento Mínimo',
    icon: AlertTriangle,
    color: 'amber',
    desc: 'Multa e juros de mora estacionados',
  },
  PARCIAL: {
    label: 'Pagamento Parcial',
    icon: ArrowDownCircle,
    color: 'rose',
    desc: 'Encargos continuam sobre o saldo',
  },
};

const paymentTypeDotClass = (type: string) => {
    switch (type) {
        case 'TOTAL': return 'bg-emerald-500';
        case 'MINIMO': return 'bg-amber-500';
        case 'PARCIAL': return 'bg-blue-500';
        default: return 'bg-zinc-400';
    }
};

const paymentTypeLabel = (type: string) => {
    switch (type) {
        case 'TOTAL': return 'Total';
        case 'MINIMO': return 'Mínimo';
        case 'PARCIAL': return 'Parcial';
        default: return type;
    }
};

const getMonthKey = (iso: string) => {
    if (!iso) return '0000-00';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (key: string) => {
    const [, m] = key.split('-');
    const monthName = MONTHS_PT[m] || m;
    return `${monthName}/${key.split('-')[0]}`;
};

const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  open,
  onClose,
  payments,
  totalDue,
}) => {
  const { theme } = useAppState();
  const isMidnight = theme === 'midnight';

  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  // Reset filter + collapse state when modal opens
  React.useEffect(() => {
      setPaymentFilter('ALL');
      setPeriodFilter('ALL');
      if (payments.length > 0) {
          const newestKey = getMonthKey(payments[0].date);
          const allKeys = new Set(payments.map(p => getMonthKey(p.date)));
          allKeys.delete(newestKey);
          setCollapsedMonths(allKeys);
      } else {
          setCollapsedMonths(new Set());
      }
  }, [open]);

  // Filtra primeiro por período, depois por tipo de pagamento
  const periodFilteredPayments = useMemo(() => {
    if (periodFilter === 'ALL') return payments;
    const daysMap = { '7D': 7, '30D': 30, '90D': 90 };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysMap[periodFilter]);
    return payments.filter(p => {
      if (!p.date) return false;
      const pmtDate = new Date(p.date);
      return pmtDate >= cutoff;
    });
  }, [payments, periodFilter]);

  const filteredPayments = paymentFilter === 'ALL'
    ? periodFilteredPayments
    : periodFilteredPayments.filter(p => p.paymentType === paymentFilter);

  const totalPago = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const pctPago = totalDue && totalDue > 0 ? Math.round((totalPago / totalDue) * 100) : 0;

  // Contagens baseadas no período ATIVO (não no total)
  const filterCounts = useMemo(() => ({
    TOTAL: periodFilteredPayments.filter(p => p.paymentType === 'TOTAL').length,
    MINIMO: periodFilteredPayments.filter(p => p.paymentType === 'MINIMO').length,
    PARCIAL: periodFilteredPayments.filter(p => p.paymentType === 'PARCIAL').length,
  }), [periodFilteredPayments]);

  // Group filtered payments by month (descending)
  const groupedPayments = useMemo(() => {
      const groups = new Map<string, typeof filteredPayments>();
      for (const pmt of filteredPayments) {
          const key = getMonthKey(pmt.date);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(pmt);
      }
      return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredPayments]);

  const toggleMonth = (key: string) => {
      setCollapsedMonths(prev => {
          const next = new Set(prev);
          if (next.has(key)) { next.delete(key); }
          else { next.add(key); }
          return next;
      });
  };

  // Count total payments per type for badge display
  const typeCounts = useMemo(() => {
      const counts = { TOTAL: 0, MINIMO: 0, PARCIAL: 0 };
      for (const p of payments) {
          if (counts[p.paymentType] !== undefined) counts[p.paymentType]++;
      }
      return counts;
  }, [payments]);

  // ── CSV Export ──
  const generateCSV = () => {
      const BOM = '\uFEFF';
      const header = 'sep=,\r\n"Data","Hora","Valor","Tipo","Descricao","%Fatura"\r\n';
      const rows = filteredPayments.map(p => {
          const raw = p.date ? new Date(p.date) : null;
          const d = (raw instanceof Date && !isNaN(raw.getTime())) ? raw : null;
          const dateStr = d ? d.toLocaleDateString('pt-BR') : '';
          const timeStr = d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
          const pct = totalDue && totalDue > 0 ? ((p.amount / totalDue) * 100).toFixed(2) : '0.00';
          const amountStr = p.amount.toFixed(2).replace('.', ',');
          return `"${dateStr}","${timeStr}","${amountStr}","${paymentTypeLabel(p.paymentType)}","${(p.description || '').replace(/"/g, '""')}","${pct}%"`;
      }).join('\n');
      return BOM + header + rows;
  };

  const downloadCSV = () => {
      const csv = generateCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historico_pagamentos_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`w-full max-w-md rounded-t-3xl border-t p-5 pb-8 max-h-[85vh] overflow-y-auto ${
              isMidnight
                ? 'bg-[#1a1a1a] border-white/10'
                : 'bg-white border-black/10'
            }`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <DollarSign size={18} className={isMidnight ? 'text-[#00ff9d]' : 'text-black'} />
                <h3 className={`font-bold text-base ${isMidnight ? 'text-white' : 'text-black'}`}>
                  Histórico de Pagamentos
                </h3>
              </div>
              <button
                onClick={onClose}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isMidnight ? 'bg-white/5 text-zinc-400 hover:bg-white/10' : 'bg-black/5 text-black/60 hover:bg-black/10'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Progress Bar */}
            {totalPago > 0 && totalDue !== undefined && (
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-1.5">
                        <span className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-black/60'}`}>
                            {pctPago}% da fatura pago
                        </span>
                        <span className={`text-[10px] font-black ${isMidnight ? 'text-zinc-400' : 'text-black/60'}`}>
                            {fmt(totalPago)} / {fmt(totalDue)}
                        </span>
                    </div>
                    <div className={`w-full h-2 rounded-full ${isMidnight ? 'bg-zinc-800' : 'bg-gray-200'}`}>
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                pctPago >= 100 ? 'bg-emerald-500' : pctPago >= 50 ? 'bg-emerald-400' : pctPago >= 10 ? 'bg-amber-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(pctPago, 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Filter chips — shared component */}
            {periodFilteredPayments.length > 1 && (
              <div className="mb-2">                  <PaymentTypeFilter
                  activeFilter={paymentFilter}
                  onFilterChange={setPaymentFilter}
                  isMidnight={isMidnight}
                  counts={filterCounts}
                  totalCount={periodFilteredPayments.length}
                  showDots={true}
                />
              </div>
            )}

            {/* Period filter chips */}
            {payments.length > 1 && (
              <div className="flex gap-1.5 mb-4 overflow-x-auto hide-scrollbar">
                {([
                  { key: 'ALL' as PeriodFilter, label: 'Todo período' },
                  { key: '7D' as PeriodFilter, label: '7 dias' },
                  { key: '30D' as PeriodFilter, label: '30 dias' },
                  { key: '90D' as PeriodFilter, label: '90 dias' },
                ]).map(f => {
                  const isActive = periodFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setPeriodFilter(f.key)}
                      className={`flex-shrink-0 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider border rounded-full transition-all flex items-center gap-1 ${
                        isActive
                          ? isMidnight
                            ? 'bg-[#A2FF00]/20 text-[#A2FF00] border-[#A2FF00]/50 shadow-sm'
                            : 'bg-[#A2FF00] text-black border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                          : isMidnight
                            ? 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:text-zinc-300'
                            : 'bg-white text-black/40 border-black/20 hover:text-black/70'
                      }`}
                    >
                      <Calendar size={11} className={isActive ? (isMidnight ? 'text-[#A2FF00]' : 'text-black') : 'opacity-40'} />
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredPayments.length > 0 && (
              <div className={`p-4 rounded-2xl mb-4 border ${
                isMidnight
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-bold ${isMidnight ? 'text-emerald-300' : 'text-emerald-700'}`}>
                      Total pago
                    </p>
                    <p className={`text-xl font-black ${isMidnight ? 'text-emerald-400' : 'text-emerald-800'}`}>
                      {fmt(totalPago)}
                    </p>
                  </div>
                  {totalDue !== undefined && (
                    <div className="text-right">
                      <p className={`text-xs font-bold ${isMidnight ? 'text-zinc-400' : 'text-black/60'}`}>
                        Valor original
                      </p>
                      <p className={`text-base font-black ${isMidnight ? 'text-white' : 'text-black'}`}>
                        {fmt(totalDue)}
                      </p>
                    </div>
                  )}
                </div>
                {totalDue !== undefined && totalPago < totalDue && (
                  <p className={`text-xs font-bold mt-2 ${
                    isMidnight ? 'text-amber-400' : 'text-amber-600'
                  }`}>
                    Saldo restante: {fmt(Math.max(0, totalDue - totalPago))}
                  </p>
                )}
              </div>
            )}

            {/* Per-Month Summary Cards */}
            {groupedPayments.length > 0 && (
                <div className="mb-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(groupedPayments.length, 4)}, 1fr)` }}>
                    {groupedPayments.slice(0, 4).map(([monthKey, monthPayments], idx) => {
                        const monthTotal = monthPayments.reduce((s, p) => s + p.amount, 0);
                        const isNewest = idx === 0;
                        return (
                            <div
                                key={monthKey}
                                className={`p-2.5 rounded-xl border text-center transition-all ${
                                    isMidnight
                                        ? isNewest ? 'bg-emerald-900/30 border-emerald-700/40' : 'bg-zinc-900 border-zinc-800'
                                        : isNewest ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                                }`}
                            >
                                <p className={`text-[9px] font-black uppercase tracking-wider mb-1 ${
                                    isMidnight ? (isNewest ? 'text-emerald-300' : 'opacity-50') : (isNewest ? 'text-emerald-700' : 'opacity-50')
                                }`}>
                                    {getMonthLabel(monthKey)}
                                </p>
                                <p className={`text-sm font-black ${
                                    isMidnight ? (isNewest ? 'text-emerald-300' : 'text-white/90') : (isNewest ? 'text-emerald-700' : 'text-black/80')
                                }`}>
                                    {fmt(monthTotal)}
                                </p>
                                <p className={`text-[8px] font-bold mt-0.5 ${isMidnight ? 'opacity-40' : 'opacity-50'}`}>
                                    {monthPayments.length} pagamento(s)
                                </p>
                            </div>
                        );
                    })}
                    {groupedPayments.length > 4 && (
                        <div className={`p-2.5 rounded-xl border text-center flex items-center justify-center ${
                            isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'
                        }`}>
                            <p className={`text-[9px] font-bold ${isMidnight ? 'opacity-40' : 'opacity-50'}`}>
                                +{groupedPayments.length - 4} mês(es)
                            </p>
                        </div>
                    )}
                </div>
            )}

            {payments.length === 0 ? (
              <div className="py-12 text-center">
                <p className={`text-sm font-bold ${isMidnight ? 'text-zinc-400' : 'text-black/60'}`}>
                  Nenhum pagamento registrado nesta fatura.
                </p>
              </div>
            ) : filteredPayments.length === 0 && periodFilteredPayments.length === 0 ? (
              <div className="py-12 text-center">
                <Calendar size={24} className={`mx-auto mb-2 ${isMidnight ? 'text-zinc-500' : 'text-black/30'}`} />
                <p className={`text-sm font-bold ${isMidnight ? 'text-zinc-400' : 'text-black/60'}`}>
                  Nenhum pagamento neste período.
                </p>
                <button
                  onClick={() => setPeriodFilter('ALL')}
                  className={`mt-2 text-xs font-black underline ${isMidnight ? 'text-[#00ff9d]' : 'text-black'}`}
                >
                  Ver todo o período
                </button>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="py-12 text-center">
                <Filter size={24} className={`mx-auto mb-2 ${isMidnight ? 'text-zinc-500' : 'text-black/30'}`} />
                <p className={`text-sm font-bold ${isMidnight ? 'text-zinc-400' : 'text-black/60'}`}>
                  Nenhum pagamento do tipo selecionado neste período.
                </p>
                <button
                  onClick={() => { setPaymentFilter('ALL'); setPeriodFilter('ALL'); }}
                  className={`mt-2 text-xs font-black underline ${isMidnight ? 'text-[#00ff9d]' : 'text-black'}`}
                >
                  Limpar todos os filtros
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Grouped by month */}
                {groupedPayments.map(([monthKey, monthPayments]) => {
                    const monthTotal = monthPayments.reduce((s, p) => s + p.amount, 0);
                    const monthTypeCount = { TOTAL: 0, MINIMO: 0, PARCIAL: 0 };
                    for (const p of monthPayments) {
                        if (monthTypeCount[p.paymentType] !== undefined) monthTypeCount[p.paymentType]++;
                    }
                    const typeSummary = [
                        monthTypeCount.TOTAL > 0 && `${monthTypeCount.TOTAL}x Total`,
                        monthTypeCount.MINIMO > 0 && `${monthTypeCount.MINIMO}x Mínimo`,
                        monthTypeCount.PARCIAL > 0 && `${monthTypeCount.PARCIAL}x Parcial`,
                    ].filter(Boolean).join(', ');

                    const isCollapsed = collapsedMonths.has(monthKey);

                    return (
                        <div key={monthKey}>
                            {/* Month Sub-header (clickable toggle) */}
                            <button
                                onClick={() => toggleMonth(monthKey)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl mb-2 transition-all ${
                                    isMidnight
                                        ? 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white'
                                        : 'bg-gray-100 hover:bg-gray-200 text-black'
                                } ${isCollapsed ? 'mb-0' : ''}`}
                            >
                                <div className="flex items-center gap-2">
                                    <CalendarDays size={14} className="opacity-60" />
                                    <span className="text-xs font-black uppercase tracking-wider">
                                        {getMonthLabel(monthKey)}
                                    </span>
                                    <span className="text-[10px] opacity-40">
                                        {monthPayments.length} pagamento(s)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-right">
                                        <span className={`text-sm font-black ${isMidnight ? 'text-[#00ff9d]' : 'text-emerald-600'}`}>
                                            {fmt(monthTotal)}
                                        </span>
                                        <div className="text-[9px] opacity-40 mt-0.5">{typeSummary}</div>
                                    </div>
                                    <ChevronDown
                                        size={16}
                                        className={`opacity-40 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                                    />
                                </div>
                            </button>

                            {/* Payments in this month (expandable) */}
                            <div
                                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                                    isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
                                }`}
                            >
                                <div className={`space-y-1.5 ${isCollapsed ? '' : 'mb-2'}`}>
                                    {monthPayments.map((payment, idx) => {
                                        const config = paymentTypeConfig[payment.paymentType] || paymentTypeConfig.PARCIAL;
                                        const Icon = config.icon;

                                        return (
                                            <motion.div
                                                key={payment.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.03 }}
                                                className={`p-3 rounded-2xl border transition-all ${
                                                    isMidnight
                                                        ? `bg-zinc-900/80 border-zinc-800`
                                                        : `bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        {/* Type Dot */}
                                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${paymentTypeDotClass(payment.paymentType)}`} />

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-xs font-black ${
                                                                    isMidnight ? 'text-white' : 'text-black'
                                                                }`}>
                                                                    {config.label}
                                                                </span>
                                                                {monthKey === groupedPayments[0]?.[0] && idx === 0 && (
                                                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                                                                        isMidnight
                                                                            ? 'bg-[#00ff9d]/20 text-[#00ff9d] border border-[#00ff9d]/30'
                                                                            : 'bg-[#A2FF00] text-black border border-black'
                                                                    }`}>
                                                                        Mais recente
                                                                    </span>
                                                                )}
                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                                                    payment.paymentType === 'TOTAL'
                                                                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                                        : payment.paymentType === 'MINIMO'
                                                                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                                                            : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                                                }`}>
                                                                    {paymentTypeLabel(payment.paymentType)}
                                                                </span>
                                                            </div>
                                                            <p className={`text-[10px] flex items-center gap-1.5 mt-0.5 ${
                                                                isMidnight ? 'text-zinc-400' : 'text-black/60'
                                                            }`}>
                                                                <Calendar size={10} />
                                                                {fmtDate(payment.date)} às {fmtTime(payment.date)}
                                                            </p>
                                                            <p className={`text-[10px] mt-0.5 ${
                                                                isMidnight ? 'text-zinc-500' : 'text-black/50'
                                                            }`}>
                                                                {payment.description || config.desc}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Amount + % */}
                                                    <div className="text-right flex-shrink-0">
                                                        <span className={`text-base font-black ${
                                                            isMidnight ? 'text-[#00ff9d]' : 'text-black'
                                                        }`}>
                                                            {fmt(payment.amount)}
                                                        </span>
                                                        {totalDue !== undefined && totalDue > 0 && (
                                                            <p className="text-[9px] opacity-40 mt-0.5">
                                                                {Math.round((payment.amount / totalDue) * 100)}%
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
              </div>
            )}

            {/* Footer with toggle-all + CSV */}
            {payments.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-4 mt-4 border-t border-black/10 dark:border-white/10">
                    <p className="text-[10px] opacity-40">
                        {payments.length} pagamento(s)
                        {groupedPayments.length > 1 && (
                            <span
                                className={`ml-2 underline cursor-pointer opacity-60 hover:opacity-100 ${
                                    collapsedMonths.size === groupedPayments.length ? 'text-emerald-500' : collapsedMonths.size > 0 ? 'text-amber-400' : ''
                                }`}
                                onClick={() => {
                                    if (collapsedMonths.size === groupedPayments.length) {
                                        setCollapsedMonths(new Set());
                                    } else if (collapsedMonths.size === 0) {
                                        const newestKey = getMonthKey(payments[0]?.date || '');
                                        const allKeys = new Set(groupedPayments.map(([k]) => k));
                                        allKeys.delete(newestKey);
                                        setCollapsedMonths(allKeys);
                                    } else {
                                        setCollapsedMonths(new Set(groupedPayments.map(([k]) => k)));
                                    }
                                }}
                            >
                                {collapsedMonths.size === 0
                                    ? 'Recolher todos'
                                    : collapsedMonths.size === groupedPayments.length
                                        ? 'Expandir todos'
                                        : `${collapsedMonths.size} recolhido(s)`}
                            </span>
                        )}
                    </p>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={downloadCSV}
                            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                                isMidnight
                                    ? 'bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                            }`}
                            title="Exportar histórico como CSV"
                        >
                            <Download size={14} />
                            CSV
                        </button>
                        <button
                            onClick={onClose}
                            className={`px-5 py-2 rounded-xl font-bold text-xs transition-all ${
                                isMidnight ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' : 'bg-gray-100 hover:bg-gray-200 text-black border border-gray-300'
                            }`}
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PaymentHistoryModal;
