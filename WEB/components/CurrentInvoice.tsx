import React from 'react';
import { User } from '../types';

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

  const invoiceDueDate = new Date(creditCard.invoiceDueDate);
  const currentTransactions = creditCard.transactions.filter(tx => new Date(tx.date) <= invoiceDueDate);

  return (
    <div className="bg-background-dark text-white min-h-full flex flex-col">
      <header className="flex items-center p-4">
          <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
        <h2 className="text-xl font-bold text-white">Detalhes da Fatura Atual</h2>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
        <div className="bg-surface-dark rounded-lg divide-y divide-subtle-dark/50 px-4">
            <InfoRow label="Fatura atual" value={creditCard.currentInvoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} valueColor="text-blue-400" />
            <InfoRow label="Vencimento" value={new Date(creditCard.invoiceDueDate).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} />
            <InfoRow label="Limite disponível" value={creditCard.availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
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
                            <p className="text-sm text-gray-400">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
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