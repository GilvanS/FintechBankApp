import React, { useEffect, useState } from 'react';
import { PurchasedItem, Transaction } from '../types';

interface PurchaseConfirmationProps {
  details: {
    product: PurchasedItem;
    transaction?: Transaction;
    message: string;
  };
  onClose: () => void;
}

const PurchaseConfirmation: React.FC<PurchaseConfirmationProps> = ({ details, onClose }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Set a timer to automatically close the confirmation screen after 4 seconds
    const timer = setInterval(() => {
      setProgress(oldProgress => {
        if (oldProgress >= 100) {
          clearInterval(timer);
          onClose(); // Navigate away
          return 100;
        }
        return oldProgress + 1;
      });
    }, 40); // 40ms * 100 steps = 4000ms

    return () => {
      clearInterval(timer); // Cleanup on unmount
    };
  }, [onClose]);

  if (!details) return null;
  const { product, message } = details;

  return (
    <div className="absolute inset-0 bg-black z-30 p-6 flex flex-col justify-center items-center text-white animate-fade-in">
        <div className="bg-surface-dark p-8 rounded-lg shadow-xl w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-4xl text-background-dark">check</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Compra Confirmada!</h2>
            <p className="text-subtle-dark mb-6">{message}</p>
            
            {product && (
                <div className="text-left bg-white/5 p-4 rounded-lg mb-6">
                    <p className="font-bold">{product.name}</p>
                    <p className="text-primary">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            )}

            <div className="w-full bg-white/10 rounded-full h-1 mt-4">
                <div 
                    className="bg-primary h-1 rounded-full" 
                    style={{ width: `${progress}%`, transition: 'width 40ms linear' }}
                ></div>
            </div>
            <p className="text-xs text-subtle-dark mt-2">Redirecionando para o início...</p>

        </div>
         <style>{`
            @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
            .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        `}</style>
    </div>
  );
};

export default PurchaseConfirmation;