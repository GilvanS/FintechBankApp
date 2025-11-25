import React from 'react';

interface PromotionalPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

const PromotionalPopup: React.FC<PromotionalPopupProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface-dark w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative border border-white/10">
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/70 hover:text-white z-10 p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-3xl">close</span>
                </button>

                {/* Header / Banner Area */}
                <div className="bg-gradient-to-r from-primary to-secondary p-8 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-pattern opacity-10"></div>
                    <div className="flex items-center justify-center gap-4 relative z-10">
                        <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                            <span className="material-symbols-outlined text-3xl text-white">pets</span>
                        </div>
                        <span className="text-2xl font-bold text-white">+</span>
                        <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                            <span className="material-symbols-outlined text-3xl text-white">shopping_bag</span>
                        </div>
                    </div>
                    <h2 className="text-white font-bold text-xl mt-4">Fintech Pet + Shop</h2>
                </div>

                {/* Content */}
                <div className="p-8 text-center space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white leading-tight">
                            Do primeiro sintoma até a solução, a gente te ajuda a cuidar do seu pet.
                        </h3>
                        <p className="text-gray-400 text-sm">
                            Coberturas completas para cães e gatos de todas as idades.
                        </p>
                    </div>

                    <div className="py-4">
                        <p className="text-gray-300 text-sm mb-1">a partir de</p>
                        <div className="flex items-baseline justify-center text-primary">
                            <span className="text-2xl font-bold mr-1">R$</span>
                            <span className="text-6xl font-extrabold tracking-tighter">11,99</span>
                        </div>
                    </div>

                    {/* Image Placeholder / Visual */}
                    <div className="relative h-32 rounded-2xl overflow-hidden mb-6 group">
                         <img 
                            src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800&q=80" 
                            alt="Happy Pet" 
                            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-dark to-transparent"></div>
                    </div>

                    <button 
                        onClick={onClose}
                        className="w-full bg-primary text-background-dark font-bold text-lg py-4 rounded-xl hover:bg-primary-light transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
                    >
                        Quero aproveitar
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .bg-pattern { background-image: radial-gradient(circle, #ffffff 1px, transparent 1px); background-size: 10px 10px; }
            `}</style>
        </div>
    );
};

export default PromotionalPopup;
