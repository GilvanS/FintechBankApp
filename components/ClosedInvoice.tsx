import React, { useState } from 'react';
import { User, CardTransaction } from '../types';

interface ClosedInvoiceProps {
  user: User;
  onBack: () => void;
  onPayInvoice: () => void;
  onParcel: (payload: { amount: number, installments: number }) => void;
}

const InfoRow: React.FC<{ label: string; value: string; valueColor?: string; hasAction?: boolean }> = ({ label, value, valueColor = 'text-white', hasAction = false }) => (
    <div className="flex justify-between items-center py-4">
        <span className="text-sm text-gray-400">{label}</span>
        <div className="flex items-center space-x-2">
            <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
            {hasAction && <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>}
        </div>
    </div>
);


const ClosedInvoice: React.FC<ClosedInvoiceProps> = ({ user, onBack, onPayInvoice, onParcel }) => {
  const { creditCard } = user;
  const [isLoading, setIsLoading] = useState(false);

  const handlePay = async () => {
    setIsLoading(true);
    await onPayInvoice();
    // No need to set isLoading to false if navigation happens on success
  };

  const handleParcel = () => {
      // For now, let's assume a default of 12 installments for the proposal
      onParcel({ amount: creditCard.closedInvoice, installments: 12 });
  };

  return (
    <div className="bg-black text-white min-h-full flex flex-col">
      <header className="flex items-center p-4">
          <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-gray-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
        <h2 className="text-xl font-bold text-white">Fatura Fechada</h2>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
        <div className="bg-gray-900 rounded-lg divide-y divide-gray-700 px-4">
            <InfoRow label="Fatura fechada" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.closedInvoice)} valueColor="text-orange-400" hasAction />
            <InfoRow label="Débito automático" value="Desativado" valueColor="text-red-400" hasAction />
            <InfoRow label="Vencimento" value={new Date(creditCard.invoiceDueDate).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} />
            <InfoRow label="Limite disponível" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.availableLimit)} />
            <InfoRow label="Limite total" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.totalLimit)} />
        </div>
        
        <div className="flex items-center space-x-3">
             <button onClick={handleParcel} disabled={creditCard.closedInvoice <= 0} className="w-full py-3 font-semibold text-orange-400 bg-transparent border border-orange-400 rounded-lg hover:bg-orange-400/10 disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed">
                Parcelar
            </button>
             <button onClick={handlePay} disabled={isLoading || creditCard.closedInvoice <= 0} className="w-full py-3 font-semibold text-black bg-orange-400 rounded-lg hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed">
                {isLoading ? 'Pagando...' : 'Pagar'}
            </button>
        </div>
        
        <div className="text-center text-xs text-gray-500">
            <p>O que achou dessa versão do resumo de fatura?</p>
        </div>

        <div>
            <h3 className="font-bold text-white mb-3 text-lg">Lançamentos da Fatura Fechada</h3>
            {creditCard.closedTransactions.length > 0 ? (
                <div className="space-y-1">
                {creditCard.closedTransactions.map(tx => (
                    <div key={tx.id} className="w-full p-3 rounded-lg flex items-center bg-gray-900">
                        <div className="flex-grow text-left">
                            <p className="font-semibold text-white">{tx.merchant}</p>
                            <p className="text-sm text-gray-400">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="text-right">
                        <p className="font-semibold text-white">- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}</p>
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

export default ClosedInvoice;