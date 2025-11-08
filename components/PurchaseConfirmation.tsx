import React from 'react';
import { PurchasedItem } from '../types';

interface PurchaseConfirmationProps {
  details: {
    item: PurchasedItem;
    method?: 'debit' | 'credit';
    installments?: number;
    cashbackUsed?: number;
  };
  onClose: () => void;
}

const PurchaseConfirmation: React.FC<PurchaseConfirmationProps> = ({ details, onClose }) => {
  if (!details || !details.item) {
    return (
      <div className="absolute inset-0 bg-black text-white flex flex-col items-center justify-center p-6 z-40">
        <h2 className="text-2xl font-bold">Erro na Confirmação</h2>
        <p className="text-gray-400">Não foi possível exibir os detalhes da compra.</p>
        <button onClick={onClose} className="mt-4 w-full max-w-sm py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500">
          Voltar
        </button>
      </div>
    );
  }

  const { item } = details;

  return (
    <div className="absolute inset-0 bg-black text-white flex flex-col items-center justify-center p-6 z-40 animate-fade-in">
      <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6">
        <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-center mb-2">Compra realizada com sucesso!</h2>
      <p className="text-gray-400 text-center mb-6">
        Você comprou <strong className="text-white">{item.name}</strong>.
      </p>

      <div className="bg-gray-900 rounded-lg p-4 flex items-center space-x-4 w-full max-w-sm mb-8">
        <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-md" />
        <div className="flex-grow">
          <p className="font-semibold text-white">{item.name}</p>
          <p className="text-sm text-gray-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</p>
        </div>
      </div>

      <button onClick={onClose} className="w-full max-w-sm py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500">
        Voltar
      </button>
       <style>{`
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default PurchaseConfirmation;
