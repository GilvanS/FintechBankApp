import React, { useState, useRef } from 'react';
import { User, CardTransaction } from '../types';

interface ClosedInvoiceProps {
  user: User;
  onBack: () => void;
  onPayInvoice: (amount: number) => void;
  onParcel: () => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function buildMonths(count = 6): { label: string; key: string }[] {
    const now = new Date();
    const months = Array.from({ length: count }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
        return {
            label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        };
    });
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    months.push({
        label: next.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        key: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
    });
    return months;
}

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
  const [payStep, setPayStep] = useState<'idle' | 'pick'>('idle');
  const [payMode, setPayMode] = useState<'total' | 'min' | 'custom'>('total');
  const [customAmount, setCustomAmount] = useState('');
  const [hideValue, setHideValue] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const months = buildMonths(6); // returns 7 items: 5 past + current + next
  const currentMonthKey = months[months.length - 2].key;
  const nextMonthKey = months[months.length - 1].key;
  const [activeMonth, setActiveMonth] = useState(currentMonthKey);
  const carouselRef = useRef<HTMLDivElement>(null);

  const isOpenInvoice = activeMonth === currentMonthKey;
  const isNextMonth = activeMonth === nextMonthKey;
  const invoiceAmount = isOpenInvoice
    ? (creditCard.currentInvoice ?? 0)
    : isNextMonth
      ? (user.pendingCharges ?? 0)
      : (creditCard.closedInvoice ?? 0);
  const isCredit = invoiceAmount < 0;

  const isOverdue = !isOpenInvoice && !isNextMonth && invoiceAmount > 0 && !!creditCard.closedInvoiceDueDate && (() => {
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
  const effectiveMin = balance > 0 ? Math.min(balance, minPayment) : minPayment;
  const minLabel = balance < minPayment ? 'Pagar o máximo possível' : 'Pagar mínimo (15%)';

  const closedTxs = isOpenInvoice
    ? (creditCard.transactions ?? [])
    : isNextMonth
      ? []
      : (creditCard.closedTransactions ?? []);
  const grouped: Record<string, CardTransaction[]> = {};
  for (const tx of closedTxs) {
    const key = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  }
  const total = closedTxs.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

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
    <div className="bg-background-dark text-white min-h-full flex flex-col">

      {/* ── Header + carrossel de meses (spec §1) ── */}
      <header className="bg-primary sticky top-0 z-20">
        <div className="flex items-center px-4 pt-4 pb-2">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h2 className="flex-1 text-center text-lg font-semibold text-white pr-8">Fatura</h2>
        </div>
        <div
          ref={carouselRef}
          className="flex overflow-x-auto pb-3 px-4 gap-6"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          {months.map(m => {
            const isActive = m.key === activeMonth;
            return (
              <button
                key={m.key}
                onClick={() => setActiveMonth(m.key)}
                className="shrink-0 flex flex-col items-center gap-1"
              >
                <span className={`text-sm capitalize transition-opacity ${isActive ? 'text-white font-semibold opacity-100' : 'text-white opacity-60'}`}>
                  {m.label}
                </span>
                {isActive && <span className="block w-full h-0.5 bg-white rounded-full" />}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-5 pb-8">

        {/* ── Card de resumo (spec §2) ── */}
        <div className="bg-surface-dark rounded-2xl p-5 shadow-lg space-y-4">

          {/* Status tag */}
          {isNextMonth ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/20">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">schedule</span>
              Próxima fatura — encargos previstos
            </span>
          ) : isOpenInvoice ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">pending</span>
              Fatura em aberto
            </span>
          ) : isCredit ? (
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
          {!isOpenInvoice && !isNextMonth && !isCredit && invoiceAmount > 0 && (
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

          {/* Encargos se inadimplente */}
          {user.accountStatus === 'inadimplente' && !!user.pendingCharges && user.pendingCharges > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-red-400/20" data-testid="alert-invoice-inadimplente">
              <span className="material-symbols-outlined text-red-400 text-sm" aria-hidden="true">warning</span>
              <p className="text-xs text-red-400">
                {user.daysOverdue ? `${user.daysOverdue} dia${user.daysOverdue !== 1 ? 's' : ''} em atraso • ` : ''}
                Encargos: {fmt(user.pendingCharges)}
              </p>
            </div>
          )}

          {/* CTAs */}
          {!isOpenInvoice && !isNextMonth && !isCredit && invoiceAmount > 0 && (
            <div className="space-y-2 pt-1">
              {payStep === 'idle' ? (
                <>
                  <button
                    onClick={() => { setPayStep('pick'); setPayMode('total'); setCustomAmount(''); }}
                    disabled={isLoading || balance <= 0}
                    className="w-full py-3 font-bold text-white bg-primary rounded-lg hover:opacity-90 disabled:bg-gray-600 disabled:cursor-not-allowed transition-opacity"
                  >
                    Pagar fatura
                  </button>
                  <button onClick={onParcel} className="w-full py-3 font-semibold text-primary bg-transparent border border-primary/50 rounded-lg hover:bg-primary/10 transition-colors">
                    Parcelar fatura
                  </button>
                  {balance > 0 && balance < minPayment && (
                    <p className="text-xs text-yellow-400 text-center">Saldo disponível: {fmt(balance)}. Você pode pagar o máximo possível.</p>
                  )}
                  {balance <= 0 && (
                    <p className="text-xs text-red-400 text-center">Saldo insuficiente para qualquer pagamento.</p>
                  )}
                </>
              ) : (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <p className="text-xs font-medium text-gray-400">Escolha o valor a pagar</p>
                  {([
                    { key: 'total', label: 'Pagar total', value: invoiceAmount },
                    { key: 'min',   label: minLabel,    value: effectiveMin },
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

        {/* ── Lista de lançamentos (spec §4) ── */}
        <div>
          <p className="text-xs text-gray-400 mb-3">
            Confira aqui os detalhes da fatura e os lançamentos do mês.
          </p>

          {isNextMonth ? null : closedTxs.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(grouped).map(([date, txs]) => (
                <div key={date}>
                  <p className="text-xs text-gray-400 font-medium mb-2 px-1 sticky top-0 bg-background-dark py-1">{date}</p>
                  <div className="space-y-1">
                    {txs.map(tx => {
                      const isExpanded = expanded === tx.id;
                      const isRefund = tx.amount < 0;
                      const installLabel = tx.installments
                        ?? (tx.currentInstallment && tx.totalInstallments
                          ? `${tx.currentInstallment}/${tx.totalInstallments}`
                          : null);

                      return (
                        <div key={tx.id}>
                          <button
                            onClick={() => setExpanded(isExpanded ? null : tx.id)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-dark/60 transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className={`material-symbols-outlined text-lg ${isRefund ? 'text-green-400' : 'text-primary'}`}>
                                {categoryIcon(tx)}
                              </span>
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-white text-sm truncate">{tx.merchant}</p>
                                {installLabel && (
                                  <span className="text-xs text-gray-400 bg-white/5 px-1.5 py-0.5 rounded-full shrink-0">
                                    {installLabel}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </p>
                            </div>
                            <p className={`font-semibold text-sm flex-shrink-0 ${isRefund ? 'text-primary' : 'text-white'}`}>
                              {isRefund ? '+' : ''}{fmt(Math.abs(tx.amount))}
                            </p>
                          </button>

                          {/* Accordion expandido (spec §5) */}
                          {isExpanded && (
                            <div className="mx-3 mb-2 rounded-xl bg-surface-dark/50 px-4 py-3 space-y-2">
                              <div className="flex justify-between text-xs border-b border-white/5 pb-2">
                                <span className="text-gray-400">Data</span>
                                <span className="text-white">
                                  {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                              {installLabel && (
                                <div className="flex justify-between text-xs border-b border-white/5 pb-2">
                                  <span className="text-gray-400">Parcela</span>
                                  <span className="text-white">{installLabel}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-xs border-b border-white/5 pb-2">
                                <span className="text-gray-400">Tipo</span>
                                <span className="text-white capitalize">{tx.type.toLowerCase().replace('_', ' ')}</span>
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
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Nenhum lançamento nesta fatura.</p>
          )}

          {isNextMonth && (
            <div className="bg-surface-dark rounded-2xl p-5 space-y-3 mt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Encargos previstos</p>
              {invoiceAmount > 0 ? (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">Multa (2%)</span>
                    <span className="text-yellow-400 font-semibold">
                      {fmt(Math.round(invoiceAmount * 0.02 * 100) / 100)}
                    </span>
                  </div>
                  <div className="border-t border-white/10 pt-2">
                    <p className="text-xs text-gray-400">Originado de pagamento parcial ou mínimo no ciclo atual.</p>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-4xl text-green-600">check_circle</span>
                  <p className="text-gray-400 mt-2 text-sm">Nenhum encargo previsto para o próximo ciclo.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer totalizador (spec §6) ── */}
        {!isNextMonth && closedTxs.length > 0 && (
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
