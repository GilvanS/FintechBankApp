import React, { useState, useEffect } from 'react';
import { Transaction, User } from '../types';
import TransactionReceipt from './TransactionReceipt';
import InvoiceSummarySheet from './InvoiceSummarySheet';
import { getInvoiceHistory, InvoiceHistoryItem } from '../services/api';

interface ClosedInvoiceProps {
    user: User;
    onBack: () => void;
    onPayInvoice: (amount: number) => void;
    onParcel: () => void;
}

type InvoiceTab = 'fechada' | 'aberta' | 'historico' | 'proximas';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function categoryIcon(type?: string): string {
    const map: Record<string, string> = {
        SHOP_DEBIT: 'shopping_bag', INVOICE_PAYMENT: 'payments',
        INVOICE_INSTALLMENT: 'credit_card', SHOP_CREDIT: 'store',
        CASHBACK_CREDIT: 'redeem', default: 'receipt_long',
    };
    return map[type ?? 'default'] ?? map.default;
}

const ClosedInvoiceView: React.FC<ClosedInvoiceProps> = ({ user, onBack, onPayInvoice, onParcel }) => {
    const [activeTab, setActiveTab] = useState<InvoiceTab>('fechada');
    const [hideValue, setHideValue] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [payStep, setPayStep] = useState<'idle' | 'pick'>('idle');
    const [payMode, setPayMode] = useState<'total' | 'min' | 'custom'>('total');
    const [customAmount, setCustomAmount] = useState('');
    const [showCharges, setShowCharges] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [showSummarySheet, setShowSummarySheet] = useState(false);
    const [historyData, setHistoryData] = useState<InvoiceHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        if (activeTab !== 'historico') return;
        let active = true;
        setHistoryLoading(true);
        getInvoiceHistory()
            .then((res) => { if (active) setHistoryData(res.history ?? []); })
            .finally(() => { if (active) setHistoryLoading(false); });
        return () => { active = false; };
    }, [activeTab]);

    if (selectedTx) return <TransactionReceipt transaction={selectedTx} onBack={() => setSelectedTx(null)} />;

    const { creditCard } = user;
    const pendingCharges = user.pendingCharges ?? 0;
    const openAmount = (creditCard.currentInvoice ?? 0) + pendingCharges;
    const closedAmount = creditCard.closedInvoice ?? 0;

    const isOverdue = closedAmount > 0 && !!creditCard.closedInvoiceDueDate && (() => {
        const due = new Date(creditCard.closedInvoiceDueDate!);
        due.setUTCHours(23, 59, 59, 999);
        return new Date() > due;
    })();
    const closedStatusKey = user.accountStatus === 'inadimplente' ? 'inadimplente' : isOverdue ? 'vencida' : 'fechada';
    const closedStatusMap = {
        fechada:      { label: 'A fatura está fechada',        icon: 'check_circle', color: 'text-green-400',  bg: 'bg-green-500/15' },
        vencida:      { label: 'Fatura vencida — pague agora', icon: 'schedule',     color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
        inadimplente: { label: 'Conta inadimplente',           icon: 'warning',      color: 'text-red-400',    bg: 'bg-red-500/15' },
    } as const;
    const closedStatus = closedStatusMap[closedStatusKey];

    const dueDate = creditCard.closedInvoiceDueDate
        ? new Date(creditCard.closedInvoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : '--/--';
    const minPayment = closedAmount > 0 ? Math.max(closedAmount * 0.15, 10) : 0;
    const effectiveMin = user.balance > 0 ? Math.min(user.balance, minPayment) : minPayment;
    const minLabel = user.balance < minPayment ? 'Pagar o máximo possível' : 'Pagar mínimo (15%)';

    const openTxs = creditCard.transactions ?? [];
    const closedTxs = creditCard.closedTransactions?.length
        ? creditCard.closedTransactions
        : creditCard.transactions?.slice(0, 8) ?? [];

    const groupByDate = (txs: Transaction[]) => txs.reduce((acc, tx) => {
        const key = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!acc[key]) acc[key] = [];
        acc[key].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    const futureInstallments = creditCard.futureInstallments || {};
    const nowYear = new Date().getFullYear();
    const futureByYear: Record<string, { month: string; amount: number; key: string }[]> = {};
    Object.entries(futureInstallments).sort().forEach(([key, amount]) => {
        const [y, mo] = key.split('-').map(Number);
        const label = y === nowYear ? 'Este ano' : String(y);
        const d = new Date(y, mo - 1, 1);
        const mStr = d.toLocaleDateString('pt-BR', { month: 'long' });
        if (!futureByYear[label]) futureByYear[label] = [];
        futureByYear[label].push({ month: mStr.charAt(0).toUpperCase() + mStr.slice(1), amount, key });
    });

    const billingMonthLabel = (() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    })();

    const handlePay = async (amt: number) => {
        setIsLoading(true);
        try { await onPayInvoice(amt); } finally { setIsLoading(false); setPayStep('idle'); }
    };
    const confirmPay = () => {
        let amt = closedAmount;
        if (payMode === 'min') amt = effectiveMin;
        else if (payMode === 'custom') {
            const parsed = parseFloat(String(customAmount).replace(',', '.'));
            if (isNaN(parsed) || parsed < effectiveMin) { alert(`Valor mínimo: ${fmt(effectiveMin)}`); return; }
            amt = Math.min(parsed, closedAmount);
        }
        handlePay(amt);
    };

    const TxList = ({ txs }: { txs: Transaction[] }) => {
        if (txs.length === 0) return (
            <div className="text-center py-12">
                <span className="material-symbols-outlined text-4xl text-gray-600">receipt_long</span>
                <p className="text-gray-500 mt-2">Nenhuma compra nesta fatura.</p>
            </div>
        );
        const grouped = groupByDate(txs);
        return (
            <div>
                {Object.entries(grouped).map(([date, dayTxs]) => (
                    <div key={date} className="mb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 sticky top-0 bg-background-dark py-1">{date}</p>
                        <div className="space-y-1">
                            {dayTxs.map(tx => {
                                const isRefund = tx.amount < 0;
                                const installLabel = tx.installments ?? (tx.currentInstallment && tx.totalInstallments ? `(${tx.currentInstallment}/${tx.totalInstallments})` : null);
                                return (
                                    <div key={tx.id}>
                                        <button onClick={() => setSelectedTx(tx)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-dark/60 transition-colors text-left">
                                            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-primary text-base">{categoryIcon(tx.type)}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <p className="text-sm font-medium text-white truncate">{tx.merchant ?? tx.description ?? 'Lançamento'}</p>
                                                    {installLabel && <span className="text-xs text-gray-400 shrink-0">{installLabel}</span>}
                                                </div>
                                                <p className="text-xs text-gray-400">
                                                    {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <p className={`text-sm font-semibold shrink-0 ${isRefund ? 'text-primary' : 'text-white'}`}>
                                                {isRefund ? '+' : ''}{fmt(Math.abs(tx.amount))}
                                            </p>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                <div className="border-t-2 border-white/20 pt-4 flex justify-between items-center">
                    <span className="font-semibold text-white">Total do Titular</span>
                    <span className="font-bold text-lg text-white">{fmt(Math.abs(txs.reduce((s, t) => s + t.amount, 0)))}</span>
                </div>
            </div>
        );
    };

    const TABS: { key: InvoiceTab; label: string }[] = [
        { key: 'fechada', label: 'Fechada' }, { key: 'aberta', label: 'Aberta' },
        { key: 'historico', label: 'Histórico' }, { key: 'proximas', label: 'Próximas' },
    ];

    return (
        <div className="flex flex-col h-full bg-background-dark text-white">
            <header className="bg-primary sticky top-0 z-20">
                <div className="flex items-center px-4 pt-4 pb-2">
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                        <span className="material-symbols-outlined text-white">arrow_back</span>
                    </button>
                    <h1 className="flex-1 text-center text-lg font-semibold text-white">Fatura do Cartão</h1>
                    <div className="w-10" />
                </div>
                <div className="flex px-2">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === tab.key ? 'text-white' : 'text-white/55 hover:text-white/80'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex px-2 pb-0">
                    {TABS.map(tab => (
                        <div key={tab.key} className={`flex-1 h-0.5 rounded-full transition-colors ${activeTab === tab.key ? 'bg-white' : 'bg-transparent'}`} />
                    ))}
                </div>
            </header>

            <InvoiceSummarySheet
                open={showSummarySheet}
                onClose={() => setShowSummarySheet(false)}
                type={activeTab === 'aberta' ? 'aberta' : 'fechada'}
                title={activeTab === 'aberta' ? 'Resumo da fatura aberta' : 'Resumo da fatura'}
            />

            <main className="flex-1 overflow-y-auto p-4 space-y-5 pb-8">

                {/* Botão de resumo detalhado (abas fechada/aberta) */}
                {(activeTab === 'fechada' || activeTab === 'aberta') && (
                    <button
                        onClick={() => setShowSummarySheet(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-surface-dark border border-white/10 text-volt-green transition-all active:scale-95"
                        data-testid="btn-resumo-fatura"
                    >
                        <span className="material-symbols-outlined text-lg">description</span>
                        Ver resumo detalhado
                    </button>
                )}

                {/* FECHADA */}
                {activeTab === 'fechada' && (
                    <>
                        <div className="bg-surface-dark rounded-2xl p-5 shadow-lg space-y-4">
                            {closedAmount > 0 ? (
                                <>
                                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${closedStatus.bg} ${closedStatus.color} px-3 py-1 rounded-full`}>
                                        <span className="material-symbols-outlined text-base">{closedStatus.icon}</span>
                                        {closedStatus.label}
                                    </span>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Valor total</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-3xl font-bold text-white">{hideValue ? '••••••' : fmt(closedAmount)}</p>
                                            <button onClick={() => setHideValue(v => !v)} className="p-2 text-gray-400 hover:text-white">
                                                <span className="material-symbols-outlined">{hideValue ? 'visibility_off' : 'visibility'}</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-1 border-t border-white/10">
                                        <div><p className="text-xs text-gray-400">Vence em</p><p className="text-sm font-semibold text-white">{dueDate}</p></div>
                                        <div><p className="text-xs text-gray-400">Pagamento mínimo</p><p className="text-sm font-semibold text-white">{fmt(effectiveMin)}</p></div>
                                    </div>
                                    {pendingCharges > 0 && (
                                        <div className="pt-1 border-t border-red-400/20">
                                            <button onClick={() => setShowCharges(v => !v)} className="w-full flex items-center justify-between gap-2 text-left">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-red-400 text-sm">warning</span>
                                                    <span className="text-xs text-red-400 font-medium">Encargos por atraso — {fmt(pendingCharges)}</span>
                                                </div>
                                                <span className={`material-symbols-outlined text-red-400/70 text-sm transition-transform duration-200 ${showCharges ? 'rotate-180' : ''}`}>expand_more</span>
                                            </button>
                                            {showCharges && (
                                                <div className="mt-2 rounded-lg bg-red-400/5 border border-red-400/15 p-3 space-y-2">
                                                    {user.daysOverdue != null && user.daysOverdue > 0 && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">Dias em atraso</span>
                                                            <span className="text-white font-medium">{user.daysOverdue} dia{user.daysOverdue !== 1 ? 's' : ''}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                                                        <span className="text-gray-400">Multa (2%)</span>
                                                        <span className="text-yellow-400 font-medium">{fmt(Math.round(closedAmount * 0.02 * 100) / 100)}</span>
                                                    </div>
                                                    {user.daysOverdue != null && user.daysOverdue > 0 && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">Juros (0,0333%/dia × {user.daysOverdue}d)</span>
                                                            <span className="text-yellow-400 font-medium">{fmt(Math.round(closedAmount * 0.000333 * user.daysOverdue * 100) / 100)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-xs border-t border-red-400/20 pt-2">
                                                        <span className="text-red-400 font-semibold">Total de encargos</span>
                                                        <span className="text-red-400 font-bold">{fmt(pendingCharges)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="space-y-2 pt-1">
                                        {payStep === 'idle' ? (
                                            <>
                                                <button onClick={() => { setPayStep('pick'); setPayMode('total'); setCustomAmount(''); }}
                                                    disabled={isLoading || user.balance <= 0}
                                                    className="w-full py-3 rounded-lg bg-primary text-white font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed">
                                                    Pagar fatura
                                                </button>
                                                <button onClick={onParcel} className="w-full py-2.5 rounded-lg border border-primary text-primary font-semibold text-sm">Parcelar fatura</button>
                                                {user.balance > 0 && user.balance < minPayment && (
                                                    <p className="text-xs text-yellow-400 text-center">Saldo disponível: {fmt(user.balance)}. Você pode pagar o máximo possível.</p>
                                                )}
                                                {user.balance <= 0 && <p className="text-xs text-red-400 text-center">Saldo insuficiente para qualquer pagamento.</p>}
                                            </>
                                        ) : (
                                            <div className="space-y-2 border-t border-white/10 pt-3">
                                                <p className="text-xs font-medium text-gray-400">Escolha o valor a pagar</p>
                                                {([{ key: 'total', label: 'Pagar total', value: closedAmount }, { key: 'min', label: minLabel, value: effectiveMin }] as const).map(opt => (
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
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <span className="material-symbols-outlined text-4xl text-green-500">check_circle</span>
                                    <p className="text-gray-300 mt-2 font-medium">Nenhuma fatura fechada</p>
                                    <p className="text-gray-500 text-sm mt-1">Nenhuma compra no período anterior.</p>
                                </div>
                            )}
                        </div>
                        <TxList txs={closedTxs} />
                    </>
                )}

                {/* ABERTA */}
                {activeTab === 'aberta' && (
                    <>
                        <div className="bg-surface-dark rounded-2xl p-5 shadow-lg space-y-4">
                            <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-500/15 text-blue-400 px-3 py-1 rounded-full">
                                <span className="material-symbols-outlined text-base">pending</span>
                                Fatura em aberto
                            </span>
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Valor total</p>
                                <div className="flex items-center justify-between">
                                    <p className="text-3xl font-bold text-white">{hideValue ? '••••••' : fmt(openAmount)}</p>
                                    <button onClick={() => setHideValue(v => !v)} className="p-2 text-gray-400 hover:text-white">
                                        <span className="material-symbols-outlined">{hideValue ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>
                            {((creditCard.currentInvoice ?? 0) > 0 || pendingCharges > 0) && (
                                <div className="pt-1 border-t border-white/10 space-y-1">
                                    {(creditCard.currentInvoice ?? 0) > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">Parcelas do mês</span>
                                            <span className="text-white font-medium">{fmt(creditCard.currentInvoice ?? 0)}</span>
                                        </div>
                                    )}
                                    {pendingCharges > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-red-400">Encargos por atraso</span>
                                            <span className="text-red-400 font-medium">{fmt(pendingCharges)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <TxList txs={openTxs} />
                    </>
                )}

                {/* HISTÓRICO */}
                {activeTab === 'historico' && (() => {
                    if (historyLoading) {
                        return (
                            <div className="bg-surface-dark rounded-2xl p-5 text-center text-white/60">
                                <p className="text-sm">Carregando histórico…</p>
                            </div>
                        );
                    }
                    if (historyData.length === 0) {
                        return (
                            <div className="text-center py-6" data-testid="historico-empty">
                                <span className="material-symbols-outlined text-4xl text-gray-600">receipt_long</span>
                                <p className="text-gray-500 mt-2 text-sm">Nenhuma fatura disponível.</p>
                            </div>
                        );
                    }
                    return (
                        <div className="bg-surface-dark rounded-2xl overflow-hidden" data-testid="historico-section">
                            {/* Cabeçalho da tabela */}
                            <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/50">
                                <span>Mês</span>
                                <span className="text-center">Período das compras</span>
                                <span className="text-right">Pagamento</span>
                            </div>
                            {historyData.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3 items-center border-t border-white/5"
                                    data-testid={`historico-row-${idx}`}
                                >
                                    <span className="text-sm font-black text-white">{item.month}</span>
                                    <span className="text-[11px] text-center text-white/50">{item.period || '—'}</span>
                                    <span
                                        className={`text-sm font-bold text-right ${
                                            item.status === 'Fatura aberta'
                                                ? 'text-blue-400'
                                                : item.status === 'Esta fatura'
                                                    ? 'text-white'
                                                    : 'text-volt-green'
                                        }`}
                                    >
                                        {item.amount > 0 ? fmt(item.amount) : item.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    );
                })()}

                {/* PRÓXIMAS */}
                {activeTab === 'proximas' && (
                    <div className="space-y-4">
                        {Object.keys(futureByYear).length > 0 ? (
                            <>
                                {Object.entries(futureByYear).map(([year, entries]) => (
                                    <div key={year}>
                                        <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2">{year}</p>
                                        <div className="bg-surface-dark rounded-2xl overflow-hidden">
                                            {entries.map((entry, i) => (
                                                <div key={entry.key} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-white/5' : ''}`}>
                                                    <span className="text-white text-sm">{entry.month}</span>
                                                    <span className="text-white font-semibold text-sm">{fmt(entry.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="text-center py-6">
                                    <span className="material-symbols-outlined text-4xl text-gray-600">history</span>
                                    <p className="text-gray-500 mt-2 text-sm">Você visualizou todas as informações disponíveis.</p>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <span className="material-symbols-outlined text-4xl text-gray-600">event_available</span>
                                <p className="text-gray-500 mt-2 text-sm">Nenhuma parcela futura.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ClosedInvoiceView;
