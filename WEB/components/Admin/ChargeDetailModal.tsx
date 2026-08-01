import React, { useEffect } from 'react';
import { X, AlertTriangle, DollarSign, Percent, CalendarDays } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { formatCPF } from '../../utils/formatters';

interface ChargeDetail {
    multa: number;
    jurosMora: number;
    jurosRemuneratorios: number;
    iof: number;
    totalEncargos: number;
    iofAdicional?: number;
    iofDiario?: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    massCpf: string;
    massName: string;
    saldoRestante: number;
    faturaOriginal: number;
    daysOverdue: number;
    encargos: ChargeDetail;
}

const ChargeDetailModal: React.FC<Props> = ({
    isOpen, onClose, massCpf, massName,
    saldoRestante, faturaOriginal, daysOverdue, encargos
}) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    // Reset scroll on open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const formatMoney = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    // Extract individual charge amounts with fallbacks
    const multa = encargos?.multa ?? 0;
    const jurosMora = encargos?.jurosMora ?? 0;
    const jurosRemun = encargos?.jurosRemuneratorios ?? 0;
    const iofAdicional = encargos?.iofAdicional ?? (encargos?.iof ?? 0);
    const iofDiario = encargos?.iofDiario ?? 0;
    const totalEncargos = encargos?.totalEncargos ?? (multa + jurosMora + jurosRemun + iofAdicional + iofDiario);

    // Calculate % of original amount
    const getPct = (val: number) => faturaOriginal > 0 ? ((val / faturaOriginal) * 100) : 0;

    const chargeItems = [
        { code: '3000', label: 'Multa por Atraso', rate: '2.0%', value: multa, field: 'multa' as const },
        { code: '2001', label: 'Juros de Mora', rate: '0.0333%/dia', value: jurosMora, field: 'jurosMora' as const },
        { code: '2000', label: 'Juros Remuneratórios', rate: '0.513%/dia', value: jurosRemun, field: 'jurosRemuneratorios' as const },
        { code: '4001', label: 'IOF Adicional (Fixo)', rate: '0.38%', value: iofAdicional, field: 'iofAdicional' as const },
        { code: '4000', label: 'IOF Diário', rate: '0.0082%/dia', value: iofDiario, field: 'iofDiario' as const },
    ];

    const getFieldColor = (field: string) => {
        switch (field) {
            case 'multa': return { text: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', dot: 'bg-rose-500' };
            case 'jurosMora': return { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' };
            case 'jurosRemuneratorios': return { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: 'bg-orange-500' };
            case 'iofAdicional': return { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500' };
            case 'iofDiario': return { text: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', dot: 'bg-cyan-500' };
            default: return { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', dot: 'bg-zinc-400' };
        }
    };

    const hasCharges = totalEncargos > 0;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
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
                            hasCharges
                                ? isMidnight ? 'bg-amber-500/20' : 'bg-amber-100'
                                : isMidnight ? 'bg-emerald-500/20' : 'bg-emerald-100'
                        }`}>
                            {hasCharges
                                ? <AlertTriangle size={22} className={isMidnight ? 'text-amber-400' : 'text-amber-600'} />
                                : <DollarSign size={22} className={isMidnight ? 'text-emerald-400' : 'text-emerald-600'} />
                            }
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight">
                                {hasCharges ? 'Encargos em Aberto' : 'Nenhum Encargo Pendente'}
                            </h3>
                            <p className="text-xs opacity-60 mt-0.5">{massName} · {formatCPF(massCpf)}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-full transition-all ${isMidnight ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`}
                    >
                        <X size={22} />
                    </button>
                </div>

                {!hasCharges ? (
                    /* Empty state — no charges */
                    <div className={`p-8 text-center rounded-xl ${isMidnight ? 'bg-zinc-900' : 'bg-gray-50'}`}>
                        <DollarSign size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="font-black text-base mb-1">Conta em Dia</p>
                        <p className="text-sm opacity-60">
                            Esta massa não possui encargos pendentes. Todas as faturas estão em dia ou já foram quitadas.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            <div className={`p-3 rounded-xl border ${
                                isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-amber-50 border-amber-200'
                            }`}>
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">
                                    Total de Encargos
                                </p>
                                <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                                    {formatMoney(totalEncargos)}
                                </p>
                                <p className="text-[10px] font-bold opacity-50">
                                    {daysOverdue} dia(s) de atraso
                                </p>
                            </div>
                            <div className={`p-3 rounded-xl border ${
                                isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-rose-50 border-rose-200'
                            }`}>
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">
                                    Saldo Devedor
                                </p>
                                <p className="text-xl font-black text-rose-600 dark:text-rose-400">
                                    {formatMoney(saldoRestante)}
                                </p>
                                <p className="text-[10px] font-bold opacity-50">
                                    Fatura Original: {formatMoney(faturaOriginal)}
                                </p>
                            </div>
                        </div>

                        {/* Progress Bar — encargos % of original amount */}
                        {faturaOriginal > 0 && (
                            <div className="mb-5">
                                <div className={`w-full h-2 rounded-full ${isMidnight ? 'bg-zinc-800' : 'bg-gray-200'}`}>
                                    <div
                                        className={`h-full rounded-full transition-all ${
                                            getPct(totalEncargos) > 15 ? 'bg-rose-500' :
                                            getPct(totalEncargos) > 8 ? 'bg-amber-500' : 'bg-amber-400'
                                        }`}
                                        style={{ width: `${Math.min(getPct(totalEncargos), 100)}%` }}
                                    />
                                </div>
                                <p className="text-[10px] font-bold opacity-50 mt-1 text-right">
                                    {getPct(totalEncargos).toFixed(1)}% do valor original
                                </p>
                            </div>
                        )}

                        {/* Legend */}
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-black uppercase tracking-wider opacity-70">
                                Detalhamento dos Encargos
                            </h4>
                            <div className="flex gap-2 text-[10px] font-bold opacity-50">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Multa
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Juros
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" /> IOF
                                </span>
                            </div>
                        </div>

                        {/* Charge Items List */}
                        <div className="space-y-2 mb-5">
                            {chargeItems.map(item => {
                                const colors = getFieldColor(item.field);
                                const pct = getPct(item.value);
                                return (
                                    <div
                                        key={item.code}
                                        className={`p-3 rounded-xl border flex items-center gap-3 ${
                                            isMidnight ? `bg-zinc-900/60 ${colors.border.replace('bg-', 'border-')}` : `${colors.bg} ${colors.border}`
                                        } transition-all`}
                                    >
                                        {/* Code badge */}
                                        <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-bold bg-black/10 dark:bg-white/10 shrink-0 ${
                                            isMidnight ? 'text-zinc-400' : 'text-zinc-600'
                                        }`}>
                                            Cód {item.code}
                                        </span>

                                        {/* Label & Rate */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold truncate">{item.label}</p>
                                            <p className={`text-[9px] font-bold opacity-50`}>
                                                {item.rate}
                                                {item.value > 0 && ` · ${pct.toFixed(2)}% do valor original`}
                                            </p>
                                        </div>

                                        {/* Value */}
                                        <div className="text-right shrink-0">
                                            <p className={`text-sm font-black ${colors.text}`}>
                                                {formatMoney(item.value)}
                                            </p>
                                            {item.value > 0 && (
                                                <p className="text-[9px] font-bold opacity-50">
                                                    +{pct.toFixed(2)}%
                                                </p>
                                            )}
                                        </div>

                                        {/* Dot indicator */}
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot} ${item.value > 0 ? 'opacity-100' : 'opacity-20'}`} />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Total Line */}
                        <div className={`p-3 rounded-xl border-2 flex items-center justify-between font-black text-sm ${
                            isMidnight
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-amber-50 border-amber-300 text-amber-700'
                        }`}>
                            <span className="flex items-center gap-2">
                                <Percent size={16} />
                                Total de Encargos Acumulados ({daysOverdue} dias)
                            </span>
                            <span className="font-mono text-base">{formatMoney(totalEncargos)}</span>
                        </div>
                    </>
                )}

                {/* Info Footer */}
                <div className={`mt-5 p-3 rounded-xl text-[10px] leading-relaxed ${
                    isMidnight ? 'bg-zinc-900 text-zinc-400 border border-zinc-800' : 'bg-gray-50 text-gray-600 border border-gray-200'
                }`}>
                    <p className="font-bold mb-1 flex items-center gap-1">
                        <CalendarDays size={12} />
                        Informações sobre Encargos
                    </p>
                    <p>
                        Encargos calculados com base no valor original da fatura fechada (R$ {faturaOriginal.toFixed(2).replace('.', ',')})
                        multiplicado pelas taxas regulamentares × {daysOverdue} dia(s) de atraso.
                        Os encargos são herdados e consolidados na <strong>fatura aberta</strong> — a fatura fechada permanece com seu valor original invariável.
                    </p>
                    {hasCharges && (
                        <p className="mt-1.5 text-amber-600 dark:text-amber-400 font-bold">
                            ⚠️ O pagamento mínimo ou parcial interrompe a acumulação de multa e juros de mora, mas juros remuneratórios continuam sobre o saldo residual.
                        </p>
                    )}
                </div>

                {/* Close Button */}
                <div className="flex justify-end mt-4">
                    <button
                        onClick={onClose}
                        className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${
                            isMidnight
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-black border border-gray-300'
                        }`}
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChargeDetailModal;
