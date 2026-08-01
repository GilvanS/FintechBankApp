import React, { useState, useMemo } from 'react';
import { X, Check, Clock, DollarSign, User, CalendarDays, CreditCard, TrendingUp, Download } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { formatCPF } from '../../utils/formatters';
import PaymentTypeFilter, { type PaymentFilterValue } from '../PaymentTypeFilter';
import { useCSVExport } from '../../hooks/useCSVExport';

interface RegularizedItem {
    cpf: string;
    fullName: string;
    valorTotal: number;
    valorPago: number;
    paymentType: 'TOTAL' | 'MINIMO' | 'PARCIAL';
    paidAt: string;
    hoursAgo: number;
    hoursToPay: number | null;
    dueDate: string | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    items: RegularizedItem[];
}

const RegularizedReportModal: React.FC<Props> = ({ isOpen, onClose, items }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const { exportCSV } = useCSVExport();

    if (!isOpen) return null;

    const [paymentFilter, setPaymentFilter] = useState<PaymentFilterValue>('ALL');

    const filteredItems = useMemo(() => {
        if (paymentFilter === 'ALL') return items;
        return items.filter(i => i.paymentType === paymentFilter);
    }, [items, paymentFilter]);

    const filterCounts = useMemo(() => ({
        TOTAL: items.filter(i => i.paymentType === 'TOTAL').length,
        MINIMO: items.filter(i => i.paymentType === 'MINIMO').length,
        PARCIAL: items.filter(i => i.paymentType === 'PARCIAL').length,
    }), [items]);

    const paymentTypeConfig = (type: string) => {
        switch (type) {
            case 'TOTAL': return { label: 'Total', class: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' };
            case 'MINIMO': return { label: 'Mínimo', class: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30' };
            default: return { label: 'Parcial', class: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30' };
        }
    };

    const totalPago = filteredItems.reduce((s, i) => s + i.valorPago, 0);
    const totalDivida = filteredItems.reduce((s, i) => s + i.valorTotal, 0);
    const totalTipos = { TOTAL: 0, MINIMO: 0, PARCIAL: 0 };
    filteredItems.forEach(i => { totalTipos[i.paymentType]++; });
    const mediaHorasPagar = filteredItems.filter(i => i.hoursToPay !== null).length > 0
        ? Math.round(filteredItems.filter(i => i.hoursToPay !== null).reduce((s, i) => s + (i.hoursToPay || 0), 0) / filteredItems.filter(i => i.hoursToPay !== null).length)
        : 0;

    const formatMoney = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const formatDatetime = (iso: string) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const downloadCSV = () => {
        const headers = ['CPF', 'Nome', 'Dívida', 'Valor Pago', 'Tipo', 'Pago há (h)', 'Regularizado em', 'Vencido há (h)'];
        const rows: (string | number)[][] = filteredItems.map(i => [
            formatCPF(i.cpf),
            i.fullName,
            i.valorTotal.toFixed(2).replace('.', ','),
            i.valorPago.toFixed(2).replace('.', ','),
            ({ TOTAL: 'Total', MINIMO: 'Mínimo', PARCIAL: 'Parcial' } as Record<string, string>)[i.paymentType] || i.paymentType,
            i.hoursAgo < 1 ? '<1' : String(i.hoursAgo),
            i.paidAt ? new Date(i.paidAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
            i.hoursToPay !== null ? String(i.hoursToPay) : ''
        ]);
        exportCSV(`regularizadas_72h_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl ${
                    isMidnight ? 'bg-[#1a1a1a] text-white border border-white/10' : 'bg-white text-black border-4 border-black'
                }`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                            <TrendingUp size={24} className={isMidnight ? 'text-volt-green' : 'text-black'} />
                            Relatório de Regularizadas (72h)
                        </h3>
                        <p className="text-xs opacity-60 mt-1">Massas que regularizaram a inadimplência nas últimas 72 horas</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-full transition-all ${isMidnight ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`}>
                        <X size={24} />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className={`p-3 rounded-xl border ${isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-emerald-50 border-emerald-200'}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">Total Pago</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatMoney(totalPago)}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-rose-50 border-rose-200'}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">Dívida Original</p>
                        <p className="text-lg font-black text-rose-500">{formatMoney(totalDivida)}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-amber-50 border-amber-200'}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">Média Reg.</p>
                        <p className="text-lg font-black text-amber-600 dark:text-amber-400">{mediaHorasPagar}h</p>
                        <p className="text-[9px] opacity-50">após vencimento</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-blue-50 border-blue-200'}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">Pagamentos</p>
                        <p className="text-lg font-black text-blue-500">{items.length}</p>
                        <p className="text-[9px] opacity-50">
                            {totalTipos.TOTAL > 0 && `${totalTipos.TOTAL} Total`}
                            {totalTipos.TOTAL > 0 && totalTipos.MINIMO > 0 && ' · '}
                            {totalTipos.MINIMO > 0 && `${totalTipos.MINIMO} Mínimo`}
                            {totalTipos.MINIMO > 0 && totalTipos.PARCIAL > 0 && ' · '}
                            {totalTipos.PARCIAL > 0 && `${totalTipos.PARCIAL} Parcial`}
                        </p>
                    </div>
                </div>

                {/* Payment Type Filter */}
                {items.length > 1 && (
                    <div className="mb-4">
                        <PaymentTypeFilter
                            activeFilter={paymentFilter}
                            onFilterChange={setPaymentFilter}
                            isMidnight={isMidnight}
                            counts={filterCounts}
                            totalCount={items.length}
                            size="sm"
                            showDots
                        />
                    </div>
                )}

                {/* Table */}
                {filteredItems.length === 0 ? (
                    <div className={`p-8 text-center rounded-xl ${isMidnight ? 'bg-zinc-900' : 'bg-gray-50'}`}>
                        <Check size={40} className="mx-auto mb-2 text-emerald-500 opacity-50" />
                        <p className="font-bold text-lg">Nenhuma massa regularizada nas últimas 24h</p>                            <p className="text-sm opacity-60 mt-1">O painel de massas em atraso está limpo.</p>
                            {items.length > 0 && paymentFilter !== 'ALL' && (
                                <button
                                    onClick={() => setPaymentFilter('ALL')}
                                    className="mt-3 px-4 py-1.5 rounded-full text-xs font-bold border border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                                >
                                    Limpar filtro
                                </button>
                            )}
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                        <table className="w-full text-left text-xs">
                            <thead className={`font-black uppercase tracking-wider border-b ${
                                isMidnight ? 'bg-zinc-900 text-zinc-400 border-zinc-800' : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                                <tr>
                                    <th className="p-3">CPF</th>
                                    <th className="p-3">Nome</th>
                                    <th className="p-3 text-right">Dívida</th>
                                    <th className="p-3 text-right">Valor Pago</th>
                                    <th className="p-3 text-center">Tipo</th>
                                    <th className="p-3 text-center">Pago há</th>
                                    <th className="p-3 text-center">Reg. em</th>
                                    <th className="p-3 text-center">Vencido há</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {filteredItems.map((item, idx) => {
                                    const cfg = paymentTypeConfig(item.paymentType);
                                    return (
                                        <tr key={idx} className={isMidnight ? 'hover:bg-zinc-900/50' : 'hover:bg-gray-50'}>
                                            <td className="p-3 font-mono font-bold">{formatCPF(item.cpf)}</td>
                                            <td className="p-3 font-bold">{item.fullName}</td>
                                            <td className="p-3 text-right font-bold text-rose-500">{formatMoney(item.valorTotal)}</td>
                                            <td className={`p-3 text-right font-black ${
                                                item.valorPago >= item.valorTotal
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-amber-600 dark:text-amber-400'
                                            }`}>
                                                {formatMoney(item.valorPago)}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${cfg.class}`}>
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center font-bold">
                                                {item.hoursAgo < 1 ? '<1h' : `${item.hoursAgo}h`}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="text-[10px] font-mono opacity-80 whitespace-nowrap">
                                                    {formatDatetime(item.paidAt)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center font-bold">
                                                {item.hoursToPay !== null && item.hoursToPay > 0
                                                    ? <span className="text-rose-500">{Math.round(item.hoursToPay / 24)}d {item.hoursToPay % 24}h</span>
                                                    : item.hoursToPay !== null && item.hoursToPay <= 0
                                                        ? <span className="text-emerald-500">0h (antecedência)</span>
                                                        : <span className="opacity-40">—</span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-black/10 dark:border-white/10">
                    <p className="text-[10px] opacity-40">
                        Dados atualizados em tempo real · Massas com data_pagamento &lt; 24h
                    </p>
                    <div className="flex items-center gap-3">
                        {items.length > 0 && (
                            <button
                                onClick={downloadCSV}
                                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                                    isMidnight
                                        ? 'bg-volt-green/15 text-volt-green hover:bg-volt-green/25 border border-volt-green/30'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                                }`}
                            >
                                <Download size={14} />
                                CSV
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
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

export default RegularizedReportModal;
