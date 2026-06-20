import React, { useState } from 'react';
import { User, CardTransaction } from '../types';

interface ClosedInvoiceProps {
  user: User;
  onBack: () => void;
  onPayInvoice: () => void;
  onParcel: () => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function categoryIcon(tx: CardTransaction): string {
    const m = tx.merchant?.toLowerCase() ?? '';
    if (m.includes('mercado') || m.includes('supermercado')) return 'shopping_cart';
    if (m.includes('restaurante') || m.includes('lanchonete')) return 'restaurant';
    if (m.includes('loja')) return 'storefront';
    if (m.includes('pix')) return 'currency_exchange';
    if (tx.type === 'PAYMENT' || tx.type === 'INVOICE_INSTALLMENT') return 'check_circle';
    return 'receipt_long';
}

const statusConfig = {
    fechada:      { label: 'A fatura está fechada',        icon: 'check_circle', color: 'text-green-400',  bg: 'bg-green-400/10 border border-green-400/20' },
    vencida:      { label: 'Fatura vencida — pague agora', icon: 'schedule',     color: 'text-yellow-400', bg: 'bg-yellow-400/10 border border-yellow-400/20' },
    inadimplente: { label: 'Conta inadimplente',           icon: 'warning',      color: 'text-red-400',    bg: 'bg-red-400/10 border border-red-400/20' },
};

function ClosedInvoice({ user, onBack, onPayInvoice, onParcel }: ClosedInvoiceProps) {
  const { creditCard, balance } = user;
  const [isLoading, setIsLoading] = useState(false);
  const [hideValue, setHideValue] = useState(false);

  const invoiceAmount = creditCard.closedInvoice ?? 0;
  const isCredit = invoiceAmount < 0;
  const canAfford = balance >= invoiceAmount;

  const isOverdue = invoiceAmount > 0 && !!creditCard.closedInvoiceDueDate && (() => {
    const due = new Date(creditCard.closedInvoiceDueDate!);
    due.setUTCHours(23, 59, 59, 999);
    return new Date() > due;
  })();

  const statusKey: keyof typeof statusConfig =
    user.accountStatus === 'inadimplente' ? 'inadimplente'
    : isOverdue ? 'vencida'
    : 'fechada';
  const status = statusConfig[statusKey];

  const dueDate = creditCard.closedInvoiceDueDate
    ? new Date(creditCard.closedInvoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : '--/--';

  const minPayment = invoiceAmount > 0 ? Math.max(invoiceAmount * 0.15, 10) : 0;

  const closedTxs = creditCard.closedTransactions ?? [];
  const grouped: Record<string, CardTransaction[]> = {};
  for (const tx of closedTxs) {
    const key = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  }
  const total = closedTxs.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

  const handlePay = async () => {
    setIsLoading(true);
    try { await onPayInvoice(); } finally { setIsLoading(false); }
  };

  return (
    <div className="bg-background-dark text-white min-h-full flex flex-col">

      <header className="flex items-center p-4 bg-primary sticky top-0 z-20">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h2 className="text-xl font-bold text-white flex-1 text-center pr-8">Fatura Fechada</h2>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-5 pb-8">

        {/* ── Card de resumo (spec §2) ── */}
        <div className="bg-surface-dark rounded-2xl p-5 shadow-lg space-y-4">

          {/* Status tag */}
          {isCredit ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">info</span>
              Não há fatura para pagar neste mês
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">{status.icon}</span>
              {status.label}
            </span>
          )}

          {/* Valor principal + eye toggle */}
          <div>
            <p className="text-xs text-white/50 mb-1">Valor total</p>
            <div className="flex items-center justify-between gap-3">
              <p
                className={`text-3xl font-bold ${isCredit ? 'text-primary' : 'text-white'}`}
                data-testid="closed-invoice-amount"
              >
                {hideValue ? '• • • • • •' : fmt(Math.abs(invoiceAmount))}
              </p>
              <button
                onClick={() => setHideValue(h => !h)}
                className="p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                aria-label={hideValue ? 'Mostrar valor' : 'Ocultar valor'}
              >
                <span className="material-symbols-outlined text-xl">
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
                <p className="text-sm font-semibold text-white">{fmt(minPayment)}</p>
              </div>
            </div>
          )}

          {/* Encargos se inadimplente */}
          {user.accountStatus === 'inadimplente' && !!user.pendingCharges && user.pendingCharges > 0 && (
            <div
              className="flex items-center gap-2 pt-1 border-t border-red-400/20"
              data-testid="alert-invoice-inadimplente"
            >
              <span className="material-symbols-outlined text-red-400 text-sm" aria-hidden="true">warning</span>
              <p className="text-xs text-red-400">
                {user.daysOverdue
                  ? `${user.daysOverdue} dia${user.daysOverdue !== 1 ? 's' : ''} em atraso • `
                  : ''}
                Encargos: {fmt(user.pendingCharges)}
              </p>
            </div>
          )}

          {/* CTAs */}
          {!isCredit && invoiceAmount > 0 && (
            <div className="space-y-2 pt-1">
              <button
                onClick={handlePay}
                disabled={isLoading || !canAfford}
                className="w-full py-3 font-bold text-white bg-primary rounded-lg hover:opacity-90 disabled:bg-gray-600 disabled:cursor-not-allowed transition-opacity"
              >
                {isLoading ? 'Pagando...' : 'Pagar fatura'}
              </button>
              <button
                onClick={onParcel}
                className="w-full py-3 font-semibold text-primary bg-transparent border border-primary/50 rounded-lg hover:bg-primary/10 transition-colors"
              >
                Parcelar fatura
              </button>
              {!canAfford && (
                <p className="text-xs text-red-400 text-center">
                  Saldo insuficiente para pagamento total. Tente parcelar.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Lista de lançamentos (spec §4) ── */}
        <div>
          <p className="text-xs text-gray-400 mb-3">
            Confira aqui os detalhes da fatura e os lançamentos do mês.
          </p>

          {closedTxs.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(grouped).map(([date, txs]) => (
                <div key={date}>
                  <p className="text-xs text-gray-400 font-medium mb-2 px-1">{date}</p>
                  <div className="space-y-1">
                    {txs.map(tx => {
                      const isRefund = tx.amount < 0;
                      const installLabel = tx.installments
                        ?? (tx.currentInstallment && tx.totalInstallments
                          ? `${tx.currentInstallment}/${tx.totalInstallments}`
                          : null);

                      return (
                        <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-dark">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className={`material-symbols-outlined text-lg ${isRefund ? 'text-green-400' : 'text-primary'}`}>
                              {categoryIcon(tx)}
                            </span>
                          </div>
                          <div className="flex-grow min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{tx.merchant}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-xs text-gray-400">
                                {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </p>
                              {installLabel && (
                                <span className="text-xs text-gray-400 bg-white/5 px-1.5 py-0.5 rounded-full">
                                  {installLabel}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className={`font-semibold text-sm flex-shrink-0 ${isRefund ? 'text-primary' : 'text-white'}`}>
                            {isRefund ? '+' : ''}{fmt(Math.abs(tx.amount))}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Nenhum lançamento nesta fatura.</p>
          )}
        </div>

        {/* ── Footer totalizador (spec §6) ── */}
        {closedTxs.length > 0 && (
          <div className="border-t-2 border-white/20 pt-4 flex justify-between items-center">
            <p className="font-semibold text-white">Total do Titular</p>
            <p className="font-bold text-white text-lg">{fmt(total)}</p>
          </div>
        )}

      </main>
    </div>
  );
}

export default ClosedInvoice;
