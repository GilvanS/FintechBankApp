import React, { useState, useRef } from 'react';
import { Transaction, User } from '../types';
import ExtratoCompra from './ExtratoCompra';

interface ClosedInvoiceProps {
    user: User;
    onBack: () => void;
    onPayInvoice: (amount: number) => void;
    onParcel: () => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function buildMonths(count = 6): { label: string; key: string }[] {
    const now = new Date();
    return Array.from({ length: count }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
        return {
            label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        };
    });
}

function categoryIcon(type?: string): string {
    const map: Record<string, string> = {
        SHOP_DEBIT: 'shopping_bag', INVOICE_PAYMENT: 'payments',
        INVOICE_INSTALLMENT: 'credit_card', SHOP_CREDIT: 'store',
        CASHBACK_CREDIT: 'redeem', default: 'receipt_long',
    };
    return map[type ?? 'default'] ?? map.default;
}

const ClosedInvoiceView: React.FC<ClosedInvoiceProps> = ({ user, onBack, onPayInvoice, onParcel }) => {
    const months = buildMonths(6);
    const [activeMonth, setActiveMonth] = useState(months[months.length - 1].key);
    const [hideValue, setHideValue] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [payStep, setPayStep] = useState<'idle' | 'pick'>('idle');
    const [payMode, setPayMode] = useState<'total' | 'min' | 'custom'>('total');
    const [customAmount, setCustomAmount] = useState('');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const carouselRef = useRef<HTMLDivElement>(null);

    if (selectedTx) {
        return <ExtratoCompra transaction={selectedTx} onBack={() => setSelectedTx(null)} />;
    }

    const { creditCard } = user;
    const invoiceAmount = creditCard.closedInvoice ?? 0;
    const isCredit = invoiceAmount < 0;
    const canAfford = user.balance >= invoiceAmount;

    const isOverdue = invoiceAmount > 0 && !!creditCard.closedInvoiceDueDate && (() => {
        const due = new Date(creditCard.closedInvoiceDueDate!);
        due.setUTCHours(23, 59, 59, 999);
        return new Date() > due;
    })();
    const closedStatusKey = user.accountStatus === 'inadimplente' ? 'inadimplente'
        : isOverdue ? 'vencida'
        : 'fechada';
    const closedStatusMap = {
        fechada:      { label: 'A fatura está fechada',        icon: 'check_circle', color: 'text-green-400',  bg: 'bg-green-500/15' },
        vencida:      { label: 'Fatura vencida — pague agora', icon: 'schedule',     color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
        inadimplente: { label: 'Conta inadimplente',           icon: 'warning',      color: 'text-red-400',    bg: 'bg-red-500/15' },
    } as const;
    const closedStatus = closedStatusMap[closedStatusKey];

    const dueDate = creditCard.closedInvoiceDueDate
        ? new Date(creditCard.closedInvoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : '--/--';

    const minPayment = invoiceAmount > 0 ? Math.max(invoiceAmount * 0.15, 10) : 0;
    const effectiveMin = user.balance > 0 ? Math.min(user.balance, minPayment) : minPayment;
    const minLabel = user.balance < minPayment ? 'Pagar o máximo possível' : 'Pagar mínimo (15%)';

    const closedTxs = creditCard.closedTransactions?.length
        ? creditCard.closedTransactions
        : creditCard.transactions?.slice(0, 8) ?? [];

    const grouped = closedTxs.reduce((acc, tx) => {
        const key = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!acc[key]) acc[key] = [];
        acc[key].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    const handlePay = async (amt: number) => {
        setIsLoading(true);
        try { await onPayInvoice(amt); } finally { setIsLoading(false); setPayStep('idle'); }
    };
    const confirmPay = () => {
        let amt = invoiceAmount;
        if (payMode === 'min') amt = effectiveMin;
        else if (payMode === 'custom') {
            const parsed = parseFloat(String(customAmount).replace(',', '.'));
            if (isNaN(parsed) || parsed < effectiveMin) { alert(`Valor mínimo: ${fmt(effectiveMin)}`); return; }
            amt = Math.min(parsed, invoiceAmount);
        }
        handlePay(amt);
    };

    return (
        <div className="flex flex-col h-full bg-background-dark text-white">

            {/* ── Header + carrossel de meses ── */}
            <header className="bg-primary sticky top-0 z-20">
                <div className="flex items-center px-4 pt-4 pb-2">
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                        <span className="material-symbols-outlined text-white">arrow_back</span>
                    </button>
                    <h1 className="flex-1 text-center text-lg font-semibold text-white">Fatura</h1>
                    <div className="w-10" />
                </div>
                <div
                    ref={carouselRef}
                    className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 pb-3 gap-6"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {months.map(m => {
                        const isActive = m.key === activeMonth;
                        return (
                            <button
                                key={m.key}
                                onClick={() => setActiveMonth(m.key)}
                                className="snap-center shrink-0 flex flex-col items-center gap-1"
                            >
                                <span
                                    className={`text-sm capitalize transition-opacity ${isActive ? 'text-white font-semibold opacity-100' : 'text-white opacity-60'}`}
                                >
                                    {m.label}
                                </span>
                                {isActive && (
                                    <span className="block w-full h-0.5 bg-white rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-5 pb-8">

                {/* ── Card de resumo ── */}
                <div className="bg-surface-dark rounded-2xl p-5 shadow-lg space-y-4">
                    {/* Tag status */}
                    {isCredit ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/15 text-primary px-3 py-1 rounded-full">
                            <span className="material-symbols-outlined text-base">info</span>
                            Não há fatura para pagar neste mês
                        </span>
                    ) : (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${closedStatus.bg} ${closedStatus.color} px-3 py-1 rounded-full`}>
                            <span className="material-symbols-outlined text-base">{closedStatus.icon}</span>
                            {closedStatus.label}
                        </span>
                    )}

                    {/* Valor total */}
                    <div>
                        <p className="text-xs text-gray-400 mb-1">Valor total</p>
                        <div className="flex items-center justify-between">
                            <p className={`text-3xl font-bold ${isCredit ? 'text-primary' : 'text-white'}`}>
                                {hideValue ? '••••••' : fmt(Math.abs(invoiceAmount))}
                            </p>
                            <button
                                onClick={() => setHideValue(v => !v)}
                                className="p-2 text-gray-400 hover:text-white"
                            >
                                <span className="material-symbols-outlined">
                                    {hideValue ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Grid vencimento | pagamento mínimo */}
                    {!isCredit && invoiceAmount > 0 && (
                        <div className="grid grid-cols-2 gap-4 pt-1 border-t border-white/10">
                            <div>
                                <p className="text-xs text-gray-400">Vence em</p>
                                <p className="text-sm font-semibold text-white">{dueDate}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Pagamento mínimo</p>
                                <p className="text-sm font-semibold text-white">{fmt(effectiveMin)}</p>
                            </div>
                        </div>
                    )}

                    {/* CTA */}
                    {!isCredit && invoiceAmount > 0 && (
                        <div className="space-y-2 pt-1">
                            {payStep === 'idle' ? (
                                <>
                                    <button
                                        onClick={() => { setPayStep('pick'); setPayMode('total'); setCustomAmount(''); }}
                                        disabled={isLoading || user.balance <= 0}
                                        className="w-full py-3 rounded-lg bg-primary text-white font-semibold text-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    >
                                        Pagar fatura
                                    </button>
                                    <button onClick={onParcel} className="w-full py-2.5 rounded-lg border border-primary text-primary font-semibold text-sm">
                                        Parcelar fatura
                                    </button>
                                    {user.balance > 0 && user.balance < minPayment && (
                                        <p className="text-xs text-yellow-400 text-center">Saldo disponível: {fmt(user.balance)}. Você pode pagar o máximo possível.</p>
                                    )}
                                    {user.balance <= 0 && (
                                        <p className="text-xs text-red-400 text-center">Saldo insuficiente para qualquer pagamento.</p>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-2 border-t border-white/10 pt-3">
                                    <p className="text-xs font-medium text-gray-400">Escolha o valor a pagar</p>
                                    {([
                                        { key: 'total', label: 'Pagar total',   value: invoiceAmount },
                                        { key: 'min',   label: minLabel,        value: effectiveMin },
                                    ] as const).map(opt => (
                                        <button key={opt.key} onClick={() => setPayMode(opt.key)}
                                            className={`w-full flex justify-between items-center p-3 rounded-lg border text-sm transition-colors ${payMode === opt.key ? 'border-primary bg-primary/10' : 'border-white/10 hover:bg-white/5'}`}>
                                            <span className={payMode === opt.key ? 'text-primary font-medium' : 'text-white'}>{opt.label}</span>
                                            <span className={`font-bold ${payMode === opt.key ? 'text-primary' : 'text-white'}`}>{fmt(opt.value)}</span>
                                        </button>
                                    ))}
                                    <button onClick={() => setPayMode('custom')}
                                        className={`w-full p-3 rounded-lg border text-sm text-left transition-colors ${payMode === 'custom' ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-white/10 text-white hover:bg-white/5'}`}>
                                        Outro valor
                                    </button>
                                    {payMode === 'custom' && (
                                        <input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)}
                                            placeholder={`Mínimo: ${fmt(effectiveMin)}`}
                                            className="w-full bg-background-dark text-white text-sm p-3 rounded-lg border border-white/20 focus:border-primary outline-none" />
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={() => setPayStep('idle')} className="flex-1 py-2.5 rounded-lg border border-white/20 text-white text-sm">Cancelar</button>
                                        <button onClick={confirmPay} disabled={isLoading || (payMode === 'custom' && !customAmount)}
                                            className="flex-1 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm disabled:opacity-40">
                                            {isLoading ? 'Pagando...' : 'Confirmar'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Lista de lançamentos ── */}
                {closedTxs.length > 0 && (
                    <div>
                        <p className="text-xs text-gray-400 mb-3">
                            Confira aqui os detalhes da fatura e os lançamentos do mês.
                        </p>

                        {Object.entries(grouped).map(([date, txs]) => (
                            <div key={date} className="mb-4">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 sticky top-0 bg-background-dark py-1">
                                    {date}
                                </p>
                                <div className="space-y-1">
                                    {txs.map(tx => {
                                        const isExpanded = expanded === tx.id;
                                        const isRefund = tx.amount < 0;
                                        const installLabel = tx.installments ?? (tx.currentInstallment && tx.totalInstallments
                                            ? `(${tx.currentInstallment}/${tx.totalInstallments})`
                                            : null);
                                        return (
                                            <div key={tx.id}>
                                                <button
                                                    onClick={() => setExpanded(isExpanded ? null : tx.id)}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-dark/60 transition-colors text-left"
                                                >
                                                    {/* Ícone */}
                                                    <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-primary text-base">
                                                            {categoryIcon(tx.type)}
                                                        </span>
                                                    </div>
                                                    {/* Texto */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1">
                                                            <p className="text-sm font-medium text-white truncate">
                                                                {tx.merchant ?? tx.description ?? 'Lançamento'}
                                                            </p>
                                                            {installLabel && (
                                                                <span className="text-xs text-gray-400 shrink-0">{installLabel}</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-400">
                                                            {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                    {/* Valor */}
                                                    <p className={`text-sm font-semibold shrink-0 ${isRefund ? 'text-primary' : 'text-white'}`}>
                                                        {isRefund ? '+' : ''}{fmt(Math.abs(tx.amount))}
                                                    </p>
                                                </button>

                                                {/* Accordion expandido */}
                                                {isExpanded && (
                                                    <div className="mx-3 mb-2 rounded-xl bg-surface-dark/50 px-4 py-3 space-y-2">
                                                        {tx.category && (
                                                            <div className="flex justify-between text-xs border-b border-white/5 pb-2">
                                                                <span className="text-gray-400">Categoria</span>
                                                                <span className="text-white capitalize">{tx.category}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between text-xs border-b border-white/5 pb-2">
                                                            <span className="text-gray-400">Data</span>
                                                            <span className="text-white">
                                                                {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">Valor</span>
                                                            <span className={isRefund ? 'text-primary' : 'text-white'}>
                                                                {fmt(Math.abs(tx.amount))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* Rodapé totalizador */}
                        <div className="border-t-2 border-white/20 pt-4 flex justify-between items-center">
                            <span className="font-semibold text-white">Total do Titular</span>
                            <span className={`font-bold text-lg ${isCredit ? 'text-primary' : 'text-white'}`}>
                                {fmt(Math.abs(invoiceAmount))}
                            </span>
                        </div>
                    </div>
                )}

                {closedTxs.length === 0 && (
                    <div className="text-center py-12">
                        <span className="material-symbols-outlined text-4xl text-gray-600">receipt_long</span>
                        <p className="text-gray-500 mt-2">Nenhuma compra nesta fatura.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ClosedInvoiceView;
