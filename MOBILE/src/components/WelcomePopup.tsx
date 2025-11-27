import React from 'react';
import { User } from '../types';

interface WelcomePopupProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

const WelcomePopup: React.FC<WelcomePopupProps> = ({ isOpen, onClose, user }) => {
    if (!isOpen) return null;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

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
                <div className="bg-gradient-to-r from-primary/80 to-primary/40 p-8 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-pattern opacity-10"></div>
                    <div className="flex items-center justify-center gap-3 relative z-10">
                        <div className="bg-white/20 p-3 rounded-full backdrop-blur-md">
                            <span className="material-symbols-outlined text-4xl text-white">account_balance</span>
                        </div>
                    </div>
                    <h2 className="text-white font-bold text-2xl mt-4">Bem-vindo!</h2>
                    <p className="text-white/90 text-sm mt-2">{user.fullName}</p>
                </div>

                {/* Content */}
                <div className="p-6 text-center space-y-6">
                    <div className="space-y-4">
                        <p className="text-white/90 text-base leading-relaxed">
                            Sua conta foi criada com sucesso! Você já pode começar a usar todos os recursos da sua conta.
                        </p>
                        
                        {/* Destaques da Conta */}
                        <div className="bg-white/5 rounded-xl p-4 space-y-3">
                            <h3 className="text-primary font-bold text-lg mb-3">Sua Conta</h3>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-white/70 text-sm">Saldo Inicial</span>
                                <span className="text-primary font-bold text-lg">
                                    {formatCurrency(user.balance || 0)}
                                </span>
                            </div>
                            
                            <div className="h-px bg-white/10"></div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-white/70 text-sm">Limite de Débito</span>
                                <span className="text-primary font-bold text-lg">
                                    {formatCurrency(user.pixDailyLimit || 0)}
                                </span>
                            </div>
                            
                            <div className="h-px bg-white/10"></div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-white/70 text-sm">Limite de Crédito</span>
                                <span className="text-primary font-bold text-lg">
                                    {formatCurrency(user.creditCard?.availableLimit || 0)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                            <p className="text-white text-sm leading-relaxed">
                                💡 <strong>Dica:</strong> Explore todas as funcionalidades do app, incluindo PIX, compras no Shop e muito mais!
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Button */}
                <div className="p-6 pt-0">
                    <button 
                        onClick={onClose}
                        className="w-full py-4 font-semibold text-background-dark bg-primary rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                    >
                        Começar a usar
                    </button>
                </div>
            </div>
            
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default WelcomePopup;

