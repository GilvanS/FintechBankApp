import React, { useMemo, useState } from 'react';
import { X, DollarSign, CalendarDays, CreditCard, Filter, Download, ChevronDown } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { formatCPF } from '../../utils/formatters';
import PaymentTypeFilter from '../PaymentTypeFilter';

interface PaymentEntry {
    id: string;
    date: string;
    amount: number;
    description: string;
    paymentType: 'TOTAL' | 'MINIMO' | 'PARCIAL';
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    massCpf: string;
    massName: string;
    totalPago: number;
    faturaOriginal: number;
    saldoRestante: number;
    statusMinimo: string;
    payments: PaymentEntry[];
}

const MONTHS_PT: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

type PaymentFilter = 'ALL' | 'TOTAL' | 'MINIMO' | 'PARCIAL';

const PaymentHistoryDetailModal: React.FC<Props> = ({
    isOpen, onClose, massCpf, massName,
    totalPago, faturaOriginal, saldoRestante, statusMinimo, payments
}) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
    const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

    // Reset filter + collapse state when modal opens/closes
    React.useEffect(() => {
        setPaymentFilter('ALL');
        // Default: newest month expanded, older months collapsed
        if (payments.length > 0) {
            const newestKey = getMonthKey(payments[0].date);
            const allKeys = new Set(payments.map(p => getMonthKey(p.date)));
            allKeys.delete(newestKey); // keep newest expanded
            setCollapsedMonths(allKeys);
        } else {
            setCollapsedMonths(new Set());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const formatMoney = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const formatDate = (iso: string) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatTime = (iso: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

    const paymentTypeLabel = (type: string) => {
        switch (type) {
            case 'TOTAL': return 'Total';
            case 'MINIMO': return 'Mínimo';
            case 'PARCIAL': return 'Parcial';
            default: return type;
        }
    };

    const paymentTypeClass = (type: string) => {
        switch (type) {
            case 'TOTAL': return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
            case 'MINIMO': return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30';
            case 'PARCIAL': return 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30';
            default: return 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30';
        }
    };

    const paymentTypeDotClass = (type: string) => {
        switch (type) {
            case 'TOTAL': return 'bg-emerald-500';
            case 'MINIMO': return 'bg-amber-500';
            case 'PARCIAL': return 'bg-blue-500';
            default: return 'bg-zinc-400';
        }
    };

    const pctPago = faturaOriginal > 0 ? Math.round((totalPago / faturaOriginal) * 100) : 0;

    // Filter payments by type
    const filteredPayments = useMemo(() => {
        if (paymentFilter === 'ALL') return payments;
        return payments.filter(p => p.paymentType === paymentFilter);
    }, [payments, paymentFilter]);

    // Group filtered payments by month (descending)
    const groupedPayments = useMemo(() => {
        const groups = new Map<string, PaymentEntry[]>();
        for (const pmt of filteredPayments) {
            const key = getMonthKey(pmt.date);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(pmt);
        }
        // Sort groups descending by month key
        const sorted = Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
        return sorted;
    }, [filteredPayments]);

    const toggleMonth = (key: string) => {
        setCollapsedMonths(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
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

    // ── CSV Export ────────────────────────────────────────────────────
    const generateCSV = () => {
        const BOM = '\uFEFF';
        const header = 'sep=,\r\n"CPF","Cliente","Data","Hora","Valor","Tipo","Descricao","%Fatura"\r\n';
        const rows = payments.map(p => {
            const raw = p.date ? new Date(p.date) : null;
            const d = (raw instanceof Date && !isNaN(raw.getTime())) ? raw : null;
            const dateStr = d ? d.toLocaleDateString('pt-BR') : '';
            const timeStr = d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
            const typeLabel = paymentTypeLabel(p.paymentType);
            const pct = faturaOriginal > 0 ? ((p.amount / faturaOriginal) * 100).toFixed(2) : '0.00';
            const amountStr = p.amount.toFixed(2).replace('.', ',');
            return `"${massCpf}","${massName}","${dateStr}","${timeStr}","${amountStr}","${typeLabel}","${(p.description || '').replace(/"/g, '""')}","${pct}%"`;
        }).join('\n');
        return BOM + header + rows;
    };

    const downloadCSV = () => {
        const csv = generateCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const safeName = massName.replace(/[^a-zA-Z0-9]/g, '_');
        link.download = `pagamentos_${safeName}_${massCpf}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    // ─────────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className={`w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl ${
                    isMidnight ? 'bg-[#1a1a1a] text-white border border-white/10' : 'bg-white text-black border-4 border-black'
                }`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${
                            isMidnight ? 'bg-emerald-500/20' : 'bg-emerald-100'
                        }`}>
                            <DollarSign size={22} className={isMidnight ? 'text-emerald-400' : 'text-emerald-600'} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight">Histórico de Pagamentos</h3>
                            <p className="text-xs opacity-60 mt-0.5">{massName} · {formatCPF(massCpf)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-full transition-all ${isMidnight ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`}>
                        <X size={22} />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className={`p-3 rounded-xl border ${
                        isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-emerald-50 border-emerald-200'
                    }`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">Total Pago</p>
                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatMoney(totalPago)}</p>
                        <p className="text-[10px] font-bold opacity-50">{pctPago}% da fatura</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${
                        isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-amber-50 border-amber-200'
                    }`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">Saldo Restante</p>
                        <p className="text-xl font-black text-amber-600 dark:text-amber-400">{formatMoney(saldoRestante)}</p>
                        <p className="text-[10px] font-bold opacity-50">
                            Status: {statusMinimo === 'ACIMA' ? '✅ Acima do mínimo' : statusMinimo === 'ABAIXO' ? '⚠️ Abaixo do mínimo' : '—'}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className={`w-full h-2 rounded-full mb-5 ${isMidnight ? 'bg-zinc-800' : 'bg-gray-200'}`}>
                    <div
                        className={`h-full rounded-full transition-all ${
                            pctPago >= 100 ? 'bg-emerald-500' : pctPago >= 50 ? 'bg-emerald-400' : pctPago >= 10 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${Math.min(pctPago, 100)}%` }}
                    />
                </div>

                {/* Per-Month Summary Cards */}
                {groupedPayments.length > 0 && (
                    <div className="mb-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(groupedPayments.length, 4)}, 1fr)` }}>
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
                                        {formatMoney(monthTotal)}
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

                {/* Payment List */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-black uppercase tracking-wider opacity-70">
                            Pagamentos Realizados ({filteredPayments.length})
                        </h4>
                        <div className="flex gap-2 text-[10px] font-bold opacity-50">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Total
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500" /> Mínimo
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-500" /> Parcial
                            </span>
                        </div>
                    </div>

                    {/* Filter Chips — shared component */}
                    {payments.length > 1 && (
                        <div className="mb-3">
                            <PaymentTypeFilter
                                activeFilter={paymentFilter}
                                onFilterChange={setPaymentFilter}
                                isMidnight={isMidnight}
                                counts={typeCounts}
                                totalCount={payments.length}
                                showDots={true}
                            />
                        </div>
                    )}

                    {payments.length === 0 ? (
                        <div className={`p-6 text-center rounded-xl ${isMidnight ? 'bg-zinc-900' : 'bg-gray-50'}`}>
                            <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="font-bold text-sm">Nenhum pagamento registrado</p>
                            <p className="text-xs opacity-50 mt-1">Esta massa ainda não realizou nenhum pagamento.</p>
                        </div>
                    ) : filteredPayments.length === 0 ? (
                        <div className={`p-6 text-center rounded-xl ${isMidnight ? 'bg-zinc-900' : 'bg-gray-50'}`}>
                            <Filter size={28} className="mx-auto mb-2 opacity-30" />
                            <p className="font-bold text-sm">Nenhum pagamento do tipo selecionado</p>
                            <button
                                onClick={() => setPaymentFilter('ALL')}
                                className={`text-xs font-bold underline mt-1 opacity-60 hover:opacity-100 ${
                                    isMidnight ? 'text-[#A2FF00]' : 'text-blue-600'
                                }`}
                            >
                                Limpar filtro
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
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
                                                    ? 'bg-zinc-800/80 hover:bg-zinc-700/80'
                                                    : 'bg-gray-100 hover:bg-gray-200'
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
                                                    <span className={`text-sm font-black ${
                                                        isMidnight ? 'text-[#A2FF00]' : 'text-emerald-600'
                                                    }`}>
                                                        {formatMoney(monthTotal)}
                                                    </span>
                                                    <div className="text-[9px] opacity-40 mt-0.5">{typeSummary}</div>
                                                </div>
                                                <ChevronDown
                                                    size={16}
                                                    className={`opacity-40 transition-transform duration-200 ${
                                                        isCollapsed ? '' : 'rotate-180'
                                                    }`}
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
                                                {monthPayments.map((pmt, idx) => {
                                                    const pctDaFatura = faturaOriginal > 0 ? Math.round((pmt.amount / faturaOriginal) * 100) : 0;
                                                    const cfgClass = paymentTypeClass(pmt.paymentType);
                                                    return (
                                                        <div
                                                            key={pmt.id || `${monthKey}-${idx}`}
                                                            className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                                                                isMidnight ? 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                                            } transition-all cursor-default`}
                                                        >
                                                            {/* Type Dot */}
                                                            <div className={`w-2 h-2 rounded-full shrink-0 ${paymentTypeDotClass(pmt.paymentType)}`} />

                                                            {/* Amount */}
                                                            <span className={`font-black text-sm min-w-[5rem] ${
                                                                pmt.paymentType === 'TOTAL'
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : pmt.paymentType === 'MINIMO'
                                                                        ? 'text-amber-600 dark:text-amber-400'
                                                                        : 'text-blue-600 dark:text-blue-400'
                                                            }`}>
                                                                {formatMoney(pmt.amount)}
                                                            </span>

                                                            {/* Type Badge */}
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${cfgClass}`}>
                                                                {paymentTypeLabel(pmt.paymentType)}
                                                            </span>

                                                            {/* Date & Time */}
                                                            <span className="text-[10px] opacity-50 ml-auto whitespace-nowrap">
                                                                {formatDate(pmt.date)}
                                                            </span>
                                                            <span className="text-[9px] opacity-30">
                                                                {formatTime(pmt.date)}
                                                            </span>

                                                            {/* % of invoice */}
                                                            <span className="text-[9px] opacity-40 min-w-[3rem] text-right">
                                                                {pctDaFatura}%
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-4 border-t border-black/10 dark:border-white/10">
                    <p className="text-[10px] opacity-40">
                        Fatura original: {formatMoney(faturaOriginal)} · {payments.length} pagamento(s)
                        {groupedPayments.length > 1 && (
                            <span
                                className={`ml-2 underline cursor-pointer opacity-60 hover:opacity-100 ${
                                    collapsedMonths.size === groupedPayments.length
                                        ? 'text-emerald-500'
                                        : collapsedMonths.size > 0
                                            ? 'text-amber-400'
                                            : ''
                                }`}
                                onClick={() => {
                                    if (collapsedMonths.size === groupedPayments.length) {
                                        // Expand all
                                        setCollapsedMonths(new Set());
                                    } else if (collapsedMonths.size === 0) {
                                        // Collapse all except newest
                                        const newestKey = getMonthKey(payments[0]?.date || '');
                                        const allKeys = new Set(groupedPayments.map(([k]) => k));
                                        allKeys.delete(newestKey);
                                        setCollapsedMonths(allKeys);
                                    } else {
                                        // Collapse all
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
                        {payments.length > 0 && (
                            <button
                                onClick={downloadCSV}
                                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                                    isMidnight
                                        ? 'bg-zinc-800 hover:bg-zinc-700 text-emerald-400'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                                }`}
                                title="Exportar histórico como CSV"
                            >
                                <Download size={14} />
                                CSV
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className={`px-5 py-2 rounded-xl font-bold text-xs transition-all ${
                                isMidnight ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-black border border-gray-300'
                            }`}
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentHistoryDetailModal;
