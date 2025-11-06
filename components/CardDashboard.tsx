import React from 'react';

interface CardDashboardProps {
  onBack: () => void;
}

const CardDashboard: React.FC<CardDashboardProps> = ({ onBack }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 my-4">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Meus Cartões</h2>
      </div>
      <div className="text-center py-16">
        <div className="text-5xl mb-4">💳</div>
        <h3 className="text-xl font-bold">Funcionalidade em Desenvolvimento</h3>
        <p className="text-gray-500 mt-2">
          Em breve, você poderá gerenciar seus cartões aqui.
        </p>
      </div>
    </div>
  );
};

export default CardDashboard;
