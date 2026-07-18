

import React, { useState, useMemo } from 'react';
import { ShoppingCart, X } from 'lucide-react';
import { User, PurchasedItem } from '../types';

interface InstallmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: PurchasedItem;
    user: User;
    onConfirm: (details: { cashbackUsed: number; installments: number }) => void;
}

const InstallmentModal: React.FC<InstallmentModalProps> = ({ isOpen, onClose, item, user, onConfirm }) => {
    const [step, setStep] = useState(1); // 1 for cashback, 2 for installments
    const [cashbackToUse, setCashbackToUse] = useState(0);
    const [selectedInstallments, setSelectedInstallments] = useState(1);

    const maxCashback = Math.min(user.creditCard.pointsBalance, item.price);
    const priceAfterCashback = item.price - cashbackToUse;

    const installmentOptions = useMemo(() => {
        const options = [];
        for (let i = 1; i <= 12; i++) {
            // Simple interest simulation: 1% per month after the first
            const interest = i > 1 ? (priceAfterCashback * 0.01 * (i - 1)) : 0;
            const total = priceAfterCashback + interest;
            const value = total / i;
            options.push({ count: i, value, total });
        }
        return options;
    }, [priceAfterCashback]);

    const handleUseCashback = () => {
        setCashbackToUse(maxCashback);
        setStep(2);
    };

    const handleDontUseCashback = () => {
        setCashbackToUse(0);
        setStep(2);
    };
    
    const handleConfirm = () => {
        onConfirm({
            cashbackUsed: cashbackToUse,
            installments: selectedInstallments,
        });
    };
    
    const handleClose = () => {
        setStep(1);
        setCashbackToUse(0);
        setSelectedInstallments(1);
        onClose();
    }

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in test-installment-modal"
            id="installment-modal"
            data-testid="installment-modal"
            data-cy="installment-modal"
            data-playwright="installment-modal"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-volt-surface w-full max-w-sm rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-2 border-volt-primary flex flex-col max-h-[90vh] overflow-hidden relative">
                <button
                    onClick={handleClose}
                    className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors test-close-installment"
                    id="btn-close-installment"
                    data-testid="close-installment"
                    type="button"
                >
                    <X size={20} />
                </button>

                <div className="text-center space-y-2 mb-6">
                    <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4 bg-volt-primary/20">
                        <ShoppingCart size={24} className="text-volt-primary" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-white">
                        {step === 1 ? 'Usar Cashback?' : 'Em quantas vezes?'}
                    </h2>
                </div>

                {step === 1 && (
                    <div className="space-y-4 text-sm text-center">
                        <p className="text-on-surface-variant">Você tem <strong className="text-volt-primary">{user.creditCard.pointsBalance.toLocaleString('pt-BR')} pontos</strong> de cashback.</p>
                        <p className="text-white">Deseja usar <strong className="text-volt-primary">{maxCashback.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</strong> para abater no valor de <strong className="text-white">{item.price.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</strong>?</p>
                        
                        <div className="bg-[#0a0a0a] border border-white/10 p-4 rounded-xl text-center">
                            <p className="text-on-surface-variant">Valor final com cashback:</p>
                            <p className="text-2xl font-black text-volt-primary">{(item.price - maxCashback).toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                        </div>
                        
                        <div className="flex space-x-3 pt-2">
                            <button onClick={handleDontUseCashback} className="w-full py-4 font-black text-xs uppercase tracking-wider text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">Não usar</button>
                            <button onClick={handleUseCashback} disabled={maxCashback <= 0} className="w-full py-4 font-black text-xs uppercase tracking-wider text-black bg-volt-green rounded-xl hover:opacity-90 disabled:bg-white/5 disabled:text-white/30 disabled:cursor-not-allowed transition-all">Usar</button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="flex flex-col flex-grow overflow-hidden">
                        <div className="text-center mb-4 p-4 bg-[#0a0a0a] border border-white/10 rounded-xl">
                             <p className="text-xs uppercase tracking-wider text-on-surface-variant font-bold mb-1">Valor da compra</p>
                             <p className="font-black text-2xl text-white">{priceAfterCashback.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                             {cashbackToUse > 0 && <p className="text-xs text-volt-primary mt-1">(-{cashbackToUse.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})} de cashback)</p>}
                        </div>
                        <div className="flex-grow overflow-y-auto no-scrollbar -mx-2 px-2 space-y-2">
                            {installmentOptions.map(opt => (
                                <button
                                    key={opt.count}
                                    onClick={() => setSelectedInstallments(opt.count)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all test-installment-option ${selectedInstallments === opt.count ? 'bg-volt-primary/10 border-volt-primary shadow-[0_0_12px_rgba(0,255,157,0.2)]' : 'bg-[#0a0a0a] border-white/10 hover:bg-white/5'}`}
                                    data-testid="installment-option"
                                    type="button"
                                >
                                    <p className="font-black text-white">{opt.count}x de {opt.value.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                                    <p className="text-xs text-on-surface-variant font-bold">Total: {opt.total.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                                </button>
                            ))}
                        </div>
                        <div className="pt-4">
                            <button
                                onClick={handleConfirm}
                                className="w-full py-4 font-black text-xs uppercase tracking-wider text-black bg-volt-green rounded-xl hover:opacity-90 test-confirm-installment transition-all"
                                id="btn-confirm-installment"
                                type="button"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                )}
            </div>
             <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default InstallmentModal;