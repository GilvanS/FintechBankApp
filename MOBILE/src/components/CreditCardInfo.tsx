import React from 'react';
import { User } from '../types';

// Define um tipo mais específico para a função onNavigate, se necessário.
// Isso garante que o componente só possa navegar para as visualizações que ele conhece.
type NavigateTo = 'cards' | 'currentInvoice' | 'closedInvoice';

interface CreditCardInfoProps {
  user: User;
  onNavigate: (view: NavigateTo) => void;
}

const CreditCardInfo: React.FC<CreditCardInfoProps> = ({ user, onNavigate }) => {
  // Encontra a fatura atual (aberta)
  const currentInvoice = user.invoices.find(invoice => invoice.status === 'open');

  // Se não houver fatura atual, o componente não renderiza nada.
  if (!currentInvoice) {
    return null;
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
