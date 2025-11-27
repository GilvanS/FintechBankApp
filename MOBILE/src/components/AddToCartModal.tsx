import React from 'react';

interface AddToCartModalProps {
    isOpen: boolean;
    productName: string;
    onGoToCart: () => void;
    onContinueShopping: () => void;
}

const AddToCartModal: React.FC<AddToCartModalProps> = ({ isOpen, productName, onGoToCart, onContinueShopping }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-surface-dark p-6 rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up">
                {/* Success Icon with Animation */}
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center animate-bounce-once">
                        <span className="material-symbols-outlined text-4xl text-primary">check_circle</span>
                    </div>
                </div>

                {/* Message */}
                <h2 className="text-xl font-bold text-white text-center mb-2">Adicionado ao Carrinho!</h2>
                <p className="text-subtle-dark text-center mb-6 text-sm">
                    <span className="font-semibold text-white">{productName}</span> foi adicionado ao seu carrinho.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={onGoToCart}
                        className="w-full py-3 px-4 bg-primary text-black font-bold rounded-lg hover:bg-primary-light transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-primary/50"
                    >
                        Ir para o Carrinho
                    </button>
                    <button 
                        onClick={onContinueShopping}
                        className="w-full py-3 px-4 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors border border-white/20"
                    >
                        Continuar Comprando
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slide-up {
                    from { 
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                @keyframes bounce-once {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                .animate-fade-in { animation: fade-in 0.2s ease-out; }
                .animate-slide-up { animation: slide-up 0.3s ease-out; }
                .animate-bounce-once { animation: bounce-once 0.5s ease-out; }
            `}</style>
        </div>
    );
};

export default AddToCartModal;
