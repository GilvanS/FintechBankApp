import React, { useState } from 'react';
// FIX: Corrected import path for types from parent directory.
import { User, CardTransaction } from '../types';

interface ClosedInvoiceProps {
  user: User;
  onBack: () => void;
  onPayInvoice: () => void;
  // FIX: Updated onParcel prop to not require a payload, simplifying the initiation of the installment flow.
  onParcel: () => void;
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


function ClosedInvoice({ user, onBack, onPayInvoice, onParcel }) {
  const { creditCard, balance } = user;
  const [isLoading, setIsLoading] = useState(false);
  // Uma fatura só está atrasada DEPOIS do fim do dia de vencimento
  // Se hoje for o dia de vencimento ou anterior, não está atrasada
  const isOverdue = creditCard.closedInvoice > 0 && creditCard.closedInvoiceDueDate && (() => {
    const dueDate = new Date(creditCard.closedInvoiceDueDate);
    // Definir fim do dia de vencimento (23:59:59.999)
    dueDate.setUTCHours(23, 59, 59, 999);
    const now = new Date();
    // Só está atrasada se a data atual for depois do fim do dia de vencimento
    return now > dueDate;
  })();
  // FIX: Added a check to see if the user can afford the full invoice payment.
  const canAfford = balance >= creditCard.closedInvoice;


  const handlePay = async () => {
    setIsLoading(true);
    try {
        await onPayInvoice();
    } finally {
        setIsLoading(false);
    }
  };

  const handleParcel = () => {
      // FIX: The onParcel call is now simplified to just trigger the navigation to the installment options screen.
      onParcel();
  };

  return (
    <div className="bg-background-dark text-white min-h-full flex flex-col">
      <header className="flex items-center p-4">
          <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
        <h2 className="text-xl font-bold text-white">Fatura Fechada</h2>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
        {creditCard.isBlocked ? (
            <div className="bg-red-800 border border-red-600 text-red-200 p-4 rounded-lg text-center mb-4 animate-fade-in">
                <h3 className="font-bold text-lg flex items-center justify-center gap-2"><span className="material-symbols-outlined">lock</span>Cartão Bloqueado</h3>
                <p className="text-sm mt-1">Sua fatura está em atraso. Pague agora para desbloquear seu cartão e evitar mais juros.</p>
            </div>
        ) : isOverdue && (
            <div className="bg-orange-800 border border-orange-600 text-orange-200 p-4 rounded-lg text-center mb-4">
                <h3 className="font-bold text-lg flex items-center justify-center gap-2"><span className="material-symbols-outlined">warning</span>Fatura Atrasada</h3>
                <p className="text-sm mt-1">Pague agora para evitar juros e o bloqueio do seu cartão.</p>
            </div>
        )}
        <div className="bg-surface-dark rounded-lg divide-y divide-subtle-dark/50 px-4">
            <InfoRow label="Fatura fechada" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.closedInvoice)} valueColor="text-orange-400" hasAction />
            <InfoRow label="Débito automático" value="Desativado" valueColor="text-red-400" hasAction />
            <InfoRow label="Vencimento" value={new Date(creditCard.closedInvoiceDueDate || creditCard.invoiceDueDate).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} />
            <InfoRow label="Limite disponível" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.availableLimit)} />
            <InfoRow label="Limite total" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.totalLimit)} />
        </div>
        
        {/* FIX: The "Pagar" button is now disabled if the user's balance is insufficient, guiding them to the parceling option. */}
        <div className="flex flex-col gap-3">
             <button onClick={handleParcel} disabled={creditCard.closedInvoice <= 0} className="w-full py-3 font-semibold text-primary bg-transparent border border-primary rounded-lg hover:bg-primary/10 disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed">
                Parcelar Fatura
            </button>
             <button onClick={handlePay} disabled={isLoading || creditCard.closedInvoice <= 0 || !canAfford} className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed">
                {isLoading ? 'Pagando...' : 'Pagar valor total'}
            </button>
            {!canAfford && creditCard.closedInvoice > 0 && <p className="text-xs text-red-400 text-center">Saldo em conta insuficiente para o pagamento total. Tente parcelar.</p>}
        </div>
        
        <div className="text-center text-xs text-gray-500">
            <p>O que achou dessa versão do resumo de fatura?</p>
        </div>

        <div>
            <h3 className="font-bold text-white mb-3 text-lg">Lançamentos da Fatura Fechada</h3>
            {creditCard.closedTransactions.length > 0 ? (
                <div className="space-y-1">
                {creditCard.closedTransactions.map(tx => (
                    <div key={tx.id} className="w-full p-3 rounded-lg flex items-center bg-surface-dark">
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
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ClosedInvoice;