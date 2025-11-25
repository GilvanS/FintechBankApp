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
    const timer = setInterval(() => {
      setProgress(oldProgress => {
        if (oldProgress >= 100) {
          clearInterval(timer);
          return 100;
        }
        return oldProgress + 1;
      });
    }, 10); // Faster animation

    return () => {
      clearInterval(timer);
    };
  }, []);

  if (!details) return null;
  const { product, message } = details;

  return (
    <div className="absolute inset-0 bg-black z-30 p-6 flex flex-col justify-center items-center text-white animate-fade-in">
        <div className="bg-surface-dark p-8 rounded-lg shadow-xl w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-background-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Compra Confirmada!</h2>
            <p className="text-subtle-dark mb-6">{message}</p>
            
            {product && (
                <div className="text-left bg-white/5 p-4 rounded-lg mb-6">
                    <p className="font-bold">{product.name}</p>
                    <p className="text-primary">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            )}

        <div className="w-full bg-white/10 rounded-full h-1 mt-4 mb-6">
                <div 
                    className="bg-primary h-1 rounded-full" 
            style={{ width: `${progress}%`, transition: 'width 10ms linear' }}
                ></div>
            </div>

        {progress >= 100 && (
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary text-background-dark font-bold rounded-lg hover:bg-primary/90 transition-colors animate-fade-in"
          >
            Voltar para o Início
          </button>
        )}

        </div>
         <style>{`
            @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
            .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        `}</style>
    </div>
  );
};

export default PurchaseConfirmation;
