import React from 'react';

interface InfoPopupBottomProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const InfoPopupBottom: React.FC<InfoPopupBottomProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="popup-title">
      <div 
        className="w-full bg-gray-800 text-white rounded-t-2xl p-6 shadow-2xl z-50 animate-slide-up"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <h3 id="popup-title" className="font-bold text-xl mb-3">{title}</h3>
        <div className="text-sm text-gray-300 mb-6 space-y-2">
          {children}
        </div>
        <button 
          onClick={onClose} 
          className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 transition-colors"
          aria-label="Fechar informativo"
        >
          Entendi
        </button>
      </div>
      <style>{`
        @keyframes slide-up {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
        .animate-slide-up {
            animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default InfoPopupBottom;
