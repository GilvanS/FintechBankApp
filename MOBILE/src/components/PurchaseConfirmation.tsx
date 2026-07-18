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
    <div
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm p-6 flex flex-col justify-center items-center text-white animate-fade-in test-purchase-confirmation"
        id="purchase-confirmation"
        data-testid="purchase-confirmation"
        data-cy="purchase-confirmation"
        data-playwright="purchase-confirmation"
        role="status"
        aria-live="polite"
    >
        <div className="bg-volt-surface border-2 border-volt-primary rounded-3xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-full max-w-sm text-center relative overflow-hidden">
            <div className="w-16 h-16 bg-volt-green border-2 border-volt-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-black">check</span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-wider mb-2 text-white">Compra Confirmada!</h2>
            <p className="text-on-surface-variant font-bold text-sm mb-6">{message}</p>

            {product && (
                <div className="text-left bg-[#0a0a0a] border border-white/10 p-4 rounded-xl mb-6">
                    <p
                        className="font-bold text-sm uppercase tracking-wider test-purchase-confirmation-product"
                        data-testid="purchase-confirmation-product"
                        data-cy="purchase-confirmation-product"
                        data-playwright="purchase-confirmation-product"
                    >{product.name}</p>
                    <p
                        className="text-volt-primary text-xl font-black mt-1 test-purchase-confirmation-amount"
                        data-testid="purchase-confirmation-amount"
                        data-cy="purchase-confirmation-amount"
                        data-playwright="purchase-confirmation-amount"
                    >{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            )}

            <button
                onClick={onClose}
                className="sr-only test-close-confirmation"
                id="btn-close-confirmation"
                name="close-confirmation"
                data-testid="close-confirmation"
                data-cy="close-confirmation"
                data-playwright="close-confirmation"
                aria-label="Fechar e voltar ao início"
                type="button"
            >
                Voltar ao início
            </button>

            <div className="w-full bg-black/50 border border-white/10 rounded-full h-1.5 mt-4 overflow-hidden">
                <div 
                    className="bg-volt-green h-full rounded-full" 
                    style={{ width: `${progress}%`, transition: 'width 40ms linear' }}
                ></div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mt-3">Redirecionando para o início...</p>

        </div>
         <style>{`
            @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
            .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        `}</style>
    </div>
  );
};

export default PurchaseConfirmation;