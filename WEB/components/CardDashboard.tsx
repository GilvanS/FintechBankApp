
import React from 'react';
import { User } from '../types';

interface CardDashboardProps {
  user: User;
}

const CardDashboard: React.FC<CardDashboardProps> = ({ user }) => {
  return (
    <div className="p-4 space-y-6 bg-black text-white">
      <div className="bg-gray-900 p-6 rounded-lg text-center">
        <div className="text-6xl mb-4">💳</div>
        <h3 className="text-xl font-bold text-white">Área de Cartões</h3>
        <p className="text-gray-400 mt-2">
          Em breve, você poderá gerenciar todos os seus cartões de crédito e débito por aqui.
        </p>
      </div>
    </div>
  );
};

export default CardDashboard;