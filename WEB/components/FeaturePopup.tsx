import React from 'react';

interface FeaturePopupProps {
  onClose: () => void;
}

const FeaturePopup: React.FC<FeaturePopupProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md text-center p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">🎉 Novidades no App! 🎉</h2>
        <p className="text-gray-600 mb-6">
          Agora você pode gerenciar seus limites PIX e adicionar contatos para transferências mais rápidas. Explore as novas funcionalidades na sua área de configurações!
        </p>
        <button 
          onClick={onClose} 
          className="px-6 py-2 text-white bg-orange-500 rounded-md hover:bg-orange-600 font-semibold"
        >
          Entendi
        </button>
      </div>
    </div>
  );
};

export default FeaturePopup;
