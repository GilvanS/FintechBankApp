import React from 'react';

interface BlockedCardModalProps {
    isOpen: boolean;
    onGoToPayment: () => void;
    onClose: () => void;
}

const BlockedCardModal: React.FC<BlockedCardModalProps> = ({ isOpen, onGoToPayment, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-surface-dark p-8 rounded-lg shadow-xl w-full max-w-sm text-center">
                <span className="text-5xl mb-4" role="img" aria-label="Blocked">🚫</span>
                <h2 className="text-2xl font-bold mb-2 text-white">Cartão Bloqueado</h2>
                <p className="text-subtle-dark mb-6">
                    Seu cartão foi bloqueado por inadimplência. Efetue o pagamento da sua fatura para liberá-lo.
                </p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={onGoToPayment} 
                        className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90"
                    >
                        Pagar Fatura
                    </button>
                    <button 
                        onClick={onClose} 
                        className="w-full py-3 font-semibold text-primary bg-transparent rounded-lg hover:bg-primary/10"
                    >
                        Voltar
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default BlockedCardModal;