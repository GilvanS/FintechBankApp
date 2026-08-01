import React, { useState } from 'react';
import { Transaction, User } from '../types';
import TransactionReceipt from './TransactionReceipt';

interface CurrentInvoiceProps {
    user: User;
    onBack: () => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function txIcon(tx: Transaction): string {
    const m = (tx.merchant ?? tx.description ?? '').toLowerCase();
    if (m.includes('mercado') || m.includes('supermercado')) return 'shopping_cart';
    if (m.includes('restaurante') || m.includes('lanchonete')) return 'restaurant';
    if (m.includes('loja')) return 'storefront';
    if (m.includes('pix')) return 'currency_exchange';
    if (tx.type === 'INVOICE_PAYMENT' || tx.type === 'PAYMENT') return 'check_circle';
    return 'receipt_long';
}

const CurrentInvoiceView: React.FC<CurrentInvoiceProps> = ({ user, onBack }) => {
    const [hideValue, setHideValue] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    const { creditCard } = user;
    const invoiceAmount = creditCard.currentInvoice ?? 0;
    const isCredit = invoiceAmount < 0;
    const minPayment = invoiceAmount > 0 ? Math.max(invoiceAmount * 0.15, 10) : 0;

    const invoiceDueDate = creditCard.invoiceDueDate ? new Date(creditCard.invoiceDueDate) : new Date();
    const endOfDay = new Date(invoiceDueDate);
    endOfDay.setHours(23, 59, 59, 999);
    const currentTransactions = creditCard.transactions.filter(tx => new Date(tx.date) <= endOfDay);

    const vencimentoLabel = creditCard.invoiceDueDate
        ? new Date(creditCard.invoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : '--/--';

    const grouped = currentTransactions.reduce((acc, tx) => {
        const key = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!acc[key]) acc[key] = [];
        acc[key].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    const total = currentTransactions.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

    if (selectedTransaction) {
        return <TransactionReceipt transaction={selectedTransaction} onBack={() => setSelectedTransaction(null)} />;
    }

    return (
        <div className="flex flex-col h-full bg-background-dark text-white">

            {/* Header */}
            <header className="flex items-center px-4 pt-4 pb-3 bg-primary sticky top-0 z-20">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined text-white">arrow_back</span>
                </button>
                <h1 className="flex-1 text-center text-lg font-semibold text-white">Fatura Aberta</h1>
                <div className="w-10" />
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-5 pb-8">

                {/* ── Card de resumo (spec §2) ── */}
                <div className="bg-surface-dark rounded-2xl p-5 shadow-lg space-y-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20 px-3 py-1 rounded-full">
                        <span className="material-symbols-outlined text-base">pending</span>
                        {isCredit ? 'Não há fatura para pagar neste mês' : 'Fatura em aberto'}
                    </span>

                    <div>
                        <p className="text-xs text-gray-400 mb-1">Valor total</p>
                        <div className="flex items-center justify-between">
                            <p className={`text-3xl font-bold ${isCredit ? 'text-primary' : 'text-white'}`}>
                                {hideValue ? '••••••' : fmt(Math.abs(invoiceAmount))}
                            </p>
                            <button
                                onClick={() => setHideValue(v => !v)}
                                className="p-2 text-gray-400 hover:text-white"
                                aria-label={hideValue ? 'Mostrar valor' : 'Ocultar valor'}
                            >
                                <span className="material-symbols-outlined">
                                    {hideValue ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Grid vencimento | pagamento mínimo */}
                    {!isCredit && (
                        <div className="grid grid-cols-2 gap-4 pt-1 border-t border-white/10">
                            <div>
                                <p className="text-xs text-gray-400">Vence em</p>
                                <p className="text-sm font-semibold text-white">{vencimentoLabel}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Pagamento mínimo</p>
                                <p className="text-sm font-semibold text-white">{fmt(minPayment)}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Lista de lançamentos (spec §4) ── */}
                <div>
                    <p className="text-xs text-gray-400 mb-3">
                        Confira aqui os detalhes da fatura e os lançamentos do mês.
                    </p>

                    {currentTransactions.length > 0 ? (
                        <div className="space-y-4">
                            {Object.entries(grouped).map(([date, txs]) => (
                                <div key={date} className="mb-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 sticky top-0 bg-background-dark py-1">
                                        {date}
                                    </p>
                                    <div className="space-y-1">
                                        {txs.map(tx => {
                                            const isRefund = tx.amount < 0;
                                            const installLabel = tx.installments
                                                ?? (tx.currentInstallment && tx.totalInstallments
                                                    ? `(${tx.currentInstallment}/${tx.totalInstallments})`
                                                    : null);
                                            return (
                                                <div key={tx.id}>
                                                    <button
                                                        onClick={() => setSelectedTransaction(tx)}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-dark/60 transition-colors text-left"
                                                    >
                                                        <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-primary text-base">
                                                                {txIcon(tx)}
                                                            </span>
                                                        </div>
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
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <span className="material-symbols-outlined text-4xl text-gray-600">receipt_long</span>
                            <p className="text-gray-500 mt-2">Nenhuma compra na sua fatura atual.</p>
                        </div>
                    )}
                </div>

                {/* ── Rodapé totalizador (spec §6) ── */}
                {currentTransactions.length > 0 && (
                    <div className="border-t-2 border-white/20 pt-4 flex justify-between items-center">
                        <span className="font-semibold text-white">Total do Titular</span>
                        <span className={`font-bold text-lg ${isCredit ? 'text-primary' : 'text-white'}`}>
                            {fmt(Math.abs(total))}
                        </span>
                    </div>
                )}
            </main>
        </div>
    );
};

export default CurrentInvoiceView;
