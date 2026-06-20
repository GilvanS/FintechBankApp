import React from 'react';
import { User } from '../types';
import { formatDateBR } from '../utils/formatters';

const statusConfig = {
    aberta: { label: 'Fatura em aberto', icon: 'pending', color: 'text-blue-400', bg: 'bg-blue-400/10 border border-blue-400/20' },
    fechada: { label: 'A fatura está fechada', icon: 'check_circle', color: 'text-green-400', bg: 'bg-green-400/10 border border-green-400/20' },
    vencida: { label: 'Fatura vencida — pague para evitar inadimplência', icon: 'schedule', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border border-yellow-400/20' },
    inadimplente: { label: 'Conta inadimplente', icon: 'warning', color: 'text-red-400', bg: 'bg-red-400/10 border border-red-400/20' },
};

interface CurrentInvoiceProps {
  user: User;
  onBack: () => void;
}

const InfoRow: React.FC<{ label: string; value: string; valueColor?: string; }> = ({ label, value, valueColor = 'text-white' }) => (
    <div className="flex justify-between items-center py-4">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
    </div>
);

const getIconForTx = (merchant: string) => {
    const lowerMerchant = merchant.toLowerCase();
    if (lowerMerchant.includes('supermercado')) return 'shopping_cart';
    if (lowerMerchant.includes('restaurante')) return 'restaurant';
    if (lowerMerchant.includes('loja')) return 'storefront';
    if (lowerMerchant.includes('pix')) return 'currency_exchange';
    if (lowerMerchant.includes('pagamento') || lowerMerchant.includes('antecipação') || lowerMerchant.includes('parcelamento')) return 'check_circle';
    return 'receipt_long';
};

const CurrentInvoice: React.FC<CurrentInvoiceProps> = ({ user, onBack }) => {
  const { creditCard } = user;
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
    ? new Date(creditCard.invoiceDueDate).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})
    : '--';

  const isCredit = creditCard.currentInvoice < 0;

  return (
    <div className="bg-background-dark text-white min-h-full flex flex-col">
      <header className="flex items-center p-4 bg-primary">
          <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
        <h2 className="text-xl font-bold text-white flex-1 text-center pr-8">Fatura</h2>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
        {/* Summary Card — conforme spec LAYOUT_FATURAS_SPEC.md seção 2 */}
        <div className="bg-surface-dark rounded-2xl p-6 shadow-md space-y-4">
          {/* Status tag */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">{status.icon}</span>
            {isCredit ? 'Não há fatura para pagar neste mês' : status.label}
          </div>

          {/* Valor principal */}
          <div>
            <p className="text-xs text-white/50 mb-1">Valor total</p>
            <p className={`text-3xl font-bold ${isCredit ? 'text-primary' : 'text-white'}`}>
              {creditCard.currentInvoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>

          {/* Grid: vencimento + limite disponível */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
            <div>
              <p className="text-xs text-white/50">Vence em</p>
              <p className="text-sm font-semibold text-white">{vencimentoLabel}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Limite disponível</p>
              <p className="text-sm font-semibold text-white">{creditCard.availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
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

        <div className="bg-surface-dark rounded-lg divide-y divide-subtle-dark/50 px-4">
            <InfoRow label="Limite total" value={creditCard.totalLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
        </div>
        
        <div>
            <h3 className="font-bold text-white mb-3 text-lg">Lançamentos da Fatura Atual</h3>
            {currentTransactions.length > 0 ? (
                <div className="space-y-1">
                {currentTransactions.map(tx => (
                    <div key={tx.id} className="w-full p-3 rounded-lg flex items-center bg-surface-dark space-x-3">
                         <div className="p-2 bg-background-dark rounded-full">
                            <span className={`material-symbols-outlined ${tx.type === 'PAYMENT' ? 'text-green-400' : 'text-primary'}`}>{getIconForTx(tx.merchant)}</span>
                        </div>
                        <div className="flex-grow text-left">
                            <p className="font-semibold text-white">{tx.merchant} {tx.installments && <span className="text-xs text-gray-400">{tx.installments}</span>}</p>
                            <p className="text-sm text-gray-400">{formatDateBR(tx.date)}</p>
                        </div>
                        <div className="text-right">
                           <p className={`font-semibold ${tx.type === 'PAYMENT' ? 'text-green-400' : 'text-white'}`}>{tx.type === 'PAYMENT' ? '+' : ''} {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                ))}
                </div>
            ) : (
                <p className="text-center text-gray-500 py-4">Nenhum lançamento nesta fatura.</p>
            )}
        </div>
      </main>
    </div>
  );
};

export default CurrentInvoice;