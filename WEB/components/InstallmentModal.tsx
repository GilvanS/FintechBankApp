

import React, { useState, useMemo } from 'react';
// FIX: Corrected import path for types from parent directory.
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-end sm:items-center justify-center z-50 animate-fade-in">
            <div className="bg-gray-900 w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">
                        {step === 1 ? 'Usar Cashback?' : 'Em quantas vezes?'}
                    </h2>
                    <button onClick={handleClose} className="text-gray-500 hover:text-white">&times;</button>
                </div>

                {step === 1 && (
                    <div className="space-y-4">
                        <p className="text-gray-300">Você tem <strong className="text-green-400">{user.creditCard.pointsBalance.toLocaleString('pt-BR')} pontos</strong> de cashback.</p>
                        <p>Deseja usar <strong className="text-green-400">{maxCashback.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</strong> para abater no valor de <strong className="text-white">{item.price.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</strong>?</p>
                        <div className="bg-gray-800 p-4 rounded-lg text-center">
                            <p className="text-gray-400">Valor final com cashback:</p>
                            <p className="text-2xl font-bold text-green-400">{(item.price - maxCashback).toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={handleDontUseCashback} className="w-full py-3 font-semibold text-green-400 bg-transparent border border-green-400 rounded-lg hover:bg-green-400/10">Não usar</button>
                            <button onClick={handleUseCashback} disabled={maxCashback <= 0} className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-gray-600">Usar Cashback</button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <>
                        <div className="text-center mb-4 p-3 bg-gray-800 rounded-lg">
                             <p className="text-sm text-gray-400">Valor da compra</p>
                             <p className="font-bold text-xl text-white">{priceAfterCashback.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                             {cashbackToUse > 0 && <p className="text-xs text-green-400">(-{cashbackToUse.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})} de cashback)</p>}
                        </div>
                        <div className="flex-grow overflow-y-auto no-scrollbar -mx-2 px-2 space-y-2">
                            {installmentOptions.map(opt => (
                                <button key={opt.count} onClick={() => setSelectedInstallments(opt.count)} className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${selectedInstallments === opt.count ? 'bg-green-900/50 border-green-500' : 'bg-gray-800 border-transparent hover:border-gray-700'}`}>
                                    <p className="font-bold text-white">{opt.count}x de {opt.value.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                                    <p className="text-xs text-gray-400">Total: {opt.total.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                                </button>
                            ))}
                        </div>
                        <button onClick={handleConfirm} className="w-full mt-4 py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500">
                            Continuar
                        </button>
                    </>
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