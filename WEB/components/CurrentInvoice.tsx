import React, { useState } from 'react';
import { User, CardTransaction } from '../types';
import { useAppState } from '../contexts/AppStateContext';

const statusConfig = {
    aberta: { label: 'Fatura em aberto', icon: 'pending', color: 'text-blue-400', bg: 'bg-blue-400/10 border border-blue-400/20' },
    fechada: { label: 'A fatura está fechada', icon: 'check_circle', color: 'text-green-400', bg: 'bg-green-400/10 border border-green-400/20' },
    vencida: { label: 'Fatura vencida — pague para evitar inadimplência', icon: 'schedule', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border border-yellow-400/20' },
    inadimplente: { label: 'Conta inadimplente', icon: 'warning', color: 'text-red-400', bg: 'bg-red-400/10 border border-red-400/20' },
};

interface CurrentInvoiceProps {
  user: User;
  onBack: () => void;
  theme?: 'yellow' | 'midnight';
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getIconForTx = (merchant: string) => {
    const lowerMerchant = merchant.toLowerCase();
    if (lowerMerchant.includes('supermercado')) return 'shopping_cart';
    if (lowerMerchant.includes('restaurante')) return 'restaurant';
    if (lowerMerchant.includes('loja')) return 'storefront';
    if (lowerMerchant.includes('pix')) return 'currency_exchange';
    if (lowerMerchant.includes('pagamento') || lowerMerchant.includes('antecipação') || lowerMerchant.includes('parcelamento')) return 'check_circle';
    return 'receipt_long';
};

const CurrentInvoice: React.FC<CurrentInvoiceProps> = ({ user, onBack, theme: customTheme }) => {
  const { theme: globalTheme } = useAppState();
  const theme = customTheme || globalTheme;
  const isMidnight = theme === 'midnight';
  const { creditCard } = user;
  const [hideValue, setHideValue] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const cycleStatus = user.billingCycle?.status ?? 'aberta';
  const status = statusConfig[cycleStatus] ?? statusConfig.aberta;

  const hasInvoiceDueDate = !!creditCard.invoiceDueDate && !isNaN(new Date(creditCard.invoiceDueDate).getTime());
  const invoiceDueDate = hasInvoiceDueDate ? new Date(creditCard.invoiceDueDate) : null;
  const endOfDay = invoiceDueDate ? new Date(invoiceDueDate) : null;
  if (endOfDay) endOfDay.setHours(23, 59, 59, 999);

  const currentTransactions = hasInvoiceDueDate
    ? creditCard.transactions.filter(tx => new Date(tx.date) <= (endOfDay as Date))
    : creditCard.transactions;

  const vencimentoLabel = hasInvoiceDueDate
    ? new Date(creditCard.invoiceDueDate).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})
    : '--';

  const isCredit = creditCard.currentInvoice < 0;
  const minPayment = creditCard.currentInvoice > 0 ? Math.max(creditCard.currentInvoice * 0.15, 10) : 0;

  const grouped: Record<string, CardTransaction[]> = {};
  for (const tx of currentTransactions) {
    const key = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  }
  const total = currentTransactions.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

  return (
    <div className={`${isMidnight ? 'text-white' : 'text-black'} bg-volt-dark min-h-full flex flex-col w-full max-w-md mx-auto pb-28`}>
      <header className={`flex items-center p-4 ${isMidnight ? 'bg-volt-surface border-b border-white/5' : 'bg-volt-primary text-black'}`}>
          <button onClick={onBack} className={`mr-2 p-2 -ml-2 rounded-full transition-colors ${isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
              <svg className={`w-6 h-6 ${isMidnight ? 'text-white' : 'text-black'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
        <h2 className={`text-xl font-bold flex-1 text-center pr-8 ${isMidnight ? 'text-white' : 'text-black'}`}>Fatura</h2>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
        {/* Summary Card — conforme spec LAYOUT_FATURAS_SPEC.md seção 2 */}
        <div className={`${isMidnight ? 'bg-volt-surface border border-white/5' : 'bg-white border-2 border-black'} rounded-2xl p-6 shadow-md space-y-4`}>
          {/* Status tag */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">{status.icon}</span>
            {isCredit ? 'Não há fatura para pagar neste mês' : status.label}
          </div>

          {/* Valor principal + eye toggle */}
          <div>
            <p className={`text-xs mb-1 ${isMidnight ? 'text-white/50' : 'text-black/50'}`}>Valor total</p>
            <div className="flex items-center justify-between gap-3">
              <p className={`text-3xl font-bold ${isCredit ? 'text-volt-primary' : isMidnight ? 'text-white' : 'text-black'}`}>
                {hideValue ? '• • • • • •' : fmt(Math.abs(creditCard.currentInvoice))}
              </p>
              <button
                onClick={() => setHideValue(h => !h)}
                className={`p-1 rounded-full transition-colors ${isMidnight ? 'hover:bg-white/10 text-white/50 hover:text-white' : 'hover:bg-black/10 text-black/50 hover:text-black'}`}
                aria-label={hideValue ? 'Mostrar valor' : 'Ocultar valor'}
              >
                <span className="material-symbols-outlined text-xl">
                  {hideValue ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Grid: vencimento | pagamento mínimo */}
          <div className={`grid grid-cols-2 gap-4 pt-2 border-t ${isMidnight ? 'border-white/10' : 'border-black/10'}`}>
            <div>
              <p className={`text-xs ${isMidnight ? 'text-white/50' : 'text-black/50'}`}>Vence em</p>
              <p className={`text-sm font-semibold ${isMidnight ? 'text-white' : 'text-black'}`}>{vencimentoLabel}</p>
            </div>
            <div>
              <p className={`text-xs ${isMidnight ? 'text-white/50' : 'text-black/50'}`}>Pagamento mínimo</p>
              <p className={`text-sm font-semibold ${isMidnight ? 'text-white' : 'text-black'}`}>{isCredit ? '--' : fmt(minPayment)}</p>
            </div>
          </div>

          {/* Encargos se inadimplente */}
          {user.accountStatus === 'inadimplente' && user.pendingCharges && user.pendingCharges > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-red-400/20">
              <span className="material-symbols-outlined text-red-400 text-sm" aria-hidden="true">warning</span>
              <p className="text-xs text-red-400">
                {user.daysOverdue ? `${user.daysOverdue} dia${user.daysOverdue !== 1 ? 's' : ''} em atraso` : 'Em atraso'} •{' '}
                Encargos: {user.pendingCharges.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          )}
        </div>

        {/* Lançamentos agrupados por data (spec §4) */}
        <div>
          <p className={`text-xs mb-3 ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>
            Confira aqui os detalhes da fatura e os lançamentos do mês.
          </p>

          {currentTransactions.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(grouped).map(([date, txs]) => (
                <div key={date}>
                  <p className="text-xs text-gray-400 font-medium mb-2 px-1">{date}</p>
                  <div className="space-y-1">
                    {txs.map(tx => {
                      const isExpanded = expanded === tx.id;
                      const isRefund = tx.amount < 0 || tx.type === 'PAYMENT';
                      const installLabel = tx.installments
                        ?? (tx.currentInstallment && tx.totalInstallments
                          ? `${tx.currentInstallment}/${tx.totalInstallments}`
                          : null);

                      return (
                        <div key={tx.id}>
                          <button
                            onClick={() => setExpanded(isExpanded ? null : tx.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isMidnight ? 'bg-volt-primary/10' : 'bg-volt-primary/20'}`}>
                              <span className={`material-symbols-outlined text-lg ${isRefund ? 'text-green-400' : 'text-volt-primary'}`}>
                                {getIconForTx(tx.merchant)}
                              </span>
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={`font-semibold text-sm truncate ${isMidnight ? 'text-white' : 'text-black'}`}>{tx.merchant}</p>
                                {installLabel && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${isMidnight ? 'text-gray-400 bg-white/5' : 'text-gray-600 bg-black/5'}`}>
                                    {installLabel}
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs mt-0.5 ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>
                                {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </p>
                            </div>
                            <p className={`font-semibold text-sm flex-shrink-0 ${isRefund ? 'text-green-400' : isMidnight ? 'text-white' : 'text-black'}`}>
                              {isRefund ? '+' : ''}{fmt(Math.abs(tx.amount))}
                            </p>
                          </button>

                          {/* Accordion expandido (spec §5) */}
                          {isExpanded && (
                            <div className={`mx-3 mb-2 rounded-xl px-4 py-3 space-y-2 ${isMidnight ? 'bg-volt-surface/50' : 'bg-black/5'}`}>
                              <div className={`flex justify-between text-xs border-b pb-2 ${isMidnight ? 'border-white/5' : 'border-black/5'}`}>
                                <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>Data</span>
                                <span className={isMidnight ? 'text-white' : 'text-black'}>
                                  {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                              {installLabel && (
                                <div className={`flex justify-between text-xs border-b pb-2 ${isMidnight ? 'border-white/5' : 'border-black/5'}`}>
                                  <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>Parcela</span>
                                  <span className={isMidnight ? 'text-white' : 'text-black'}>{installLabel}</span>
                                </div>
                              )}
                              <div className={`flex justify-between text-xs border-b pb-2 ${isMidnight ? 'border-white/5' : 'border-black/5'}`}>
                                <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>Tipo</span>
                                <span className={`capitalize ${isMidnight ? 'text-white' : 'text-black'}`}>{tx.type.toLowerCase().replace('_', ' ')}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>Valor</span>
                                <span className={isRefund ? 'text-green-400' : isMidnight ? 'text-white' : 'text-black'}>
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
        </div>

        {/* Footer totalizador (spec §6) */}
        {currentTransactions.length > 0 && (
          <div className={`border-t-2 pt-4 flex justify-between items-center ${isMidnight ? 'border-white/20' : 'border-black/20'}`}>
            <p className={`font-semibold ${isMidnight ? 'text-white' : 'text-black'}`}>Total do Titular</p>
            <p className={`font-bold text-lg ${isMidnight ? 'text-white' : 'text-black'}`}>{fmt(total)}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default CurrentInvoice;