import React from 'react';
import { Transaction } from '../types'; // Assuming Transaction type is in types

interface ExtratoCompraProps {
  transaction: Transaction;
  onBack: () => void;
}

/**
 * ExtratoCompra: A component to display the detailed receipt of a single transaction.
 * It shows detailed information like payment method, merchant, and value.
 */
const ExtratoCompra: React.FC<ExtratoCompraProps> = ({ transaction, onBack }) => {

  // Helper function to format date and time
  const formattedDate = new Date(transaction.date).toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  const formattedTime = new Date(transaction.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-background-dark text-white flex flex-col h-full animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-surface-dark">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-white/10">
            <span className="material-symbols-outlined">share</span>
          </button>
          <button className="p-2 rounded-full hover:bg-white/10">
            <span className="material-symbols-outlined">help_outline</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-6 space-y-8">
        {/* Transaction Type and Date */}
        <div>
          <p className="text-sm text-gray-400">Compra › {transaction.category}</p>
          <p className="text-sm text-gray-400">{formattedDate}, às {formattedTime}</p>
        </div>

        {/* Merchant, Amount, and Icon */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{transaction.merchant}</h1>
            <p className="text-3xl font-bold text-red-400">- {transaction.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <span className="material-symbols-outlined text-6xl text-primary opacity-50">shopping_basket</span>
        </div>
        
        {/* Payment Method */}
        <div className="bg-surface-dark p-4 rounded-lg flex items-center gap-4">
          <span className="material-symbols-outlined text-primary">contactless</span>
          <p>Pagamento por aproximação com cartão físico</p>
        </div>

        {/* Transaction Balance */}
        <div>
            <h3 className="font-semibold mb-2">Saldo dessa transação</h3>
             <div className="bg-surface-dark p-4 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-background-dark p-2 rounded-full">
                        <span className="material-symbols-outlined text-yellow-400">restaurant</span>
                    </div>
                    <p className="font-semibold">{transaction.category}</p>
                </div>
                <p className="font-bold text-red-400">- {transaction.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
        </div>

        {/* Help Section */}
        <button className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-surface-dark transition-colors">
            <div className="flex items-center gap-3">
                <span className="material-symbols-outlined">forum</span>
                <p>Peça ajuda caso tenha problema com alguma compra</p>
            </div>
             <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </main>
       <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ExtratoCompra;
