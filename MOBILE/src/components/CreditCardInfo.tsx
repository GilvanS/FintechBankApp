import React from 'react';
import { User, View } from '../types';

interface CreditCardInfoProps {
  user: User;
  onNavigate: (view: View) => void;
}

const CreditCardInfo: React.FC<CreditCardInfoProps> = ({ user, onNavigate }) => {
  // Adiciona uma verificação para garantir que user.invoices exista antes de usar .find()
  // Isso torna o componente mais robusto e evita o crash caso a API não retorne as faturas.
  const currentInvoice = user.invoices && user.invoices.find(invoice => invoice.status === 'open');

  if (!currentInvoice) {
    return null; // Se não houver fatura, o componente não renderiza nada.
  }

  return (
    <section className="bg-surface-dark rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Fatura do Cartão</h3>
        <span className="material-symbols-outlined text-white">credit_card</span>
      </div>
      <div>
        <p className="text-sm text-gray-400">Valor da fatura atual</p>
        <p className="text-2xl font-bold text-cyan-400">
          {currentInvoice.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Fecha em {new Date(currentInvoice.dueDate).toLocaleDateString('pt-BR')}
        </p>
      </div>
      <button 
        onClick={() => onNavigate('cards')} 
        className="mt-4 w-full bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg transition-colors"
      >
        Ver Faturas
      </button>
    </section>
  );
};

export default CreditCardInfo;
