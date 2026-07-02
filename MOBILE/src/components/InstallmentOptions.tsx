import React from 'react';
import { User } from '../types';

interface InstallmentOptionsProps {
    user: User;
    onBack: () => void;
    onSelectOption: (details: { amount: number; installments: number }) => void;
}

const InstallmentOptions: React.FC<InstallmentOptionsProps> = ({ user, onBack, onSelectOption }) => {
    const { creditCard } = user;
    const invoiceAmount = creditCard.closedInvoice;

    const calculateInstallmentPlans = (amount: number) => {
        const plans = [2, 4, 6, 8, 10, 12];
        return plans.map(installments => {
            const interest = amount * 0.10 * installments; // Simple interest 10% per month
            const totalAmount = amount + interest;
            const installmentValue = totalAmount / installments;
            return {
                installments,
                installmentValue,
                totalAmount
            };
        });
    };

    const plans = calculateInstallmentPlans(invoiceAmount);

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col w-full max-w-md mx-auto pb-28">
            <header className="flex items-center p-4">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-xl font-bold text-white">Opções de Parcelamento</h2>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-4">
                <div className="bg-surface-dark p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400">Valor total da fatura</p>
                    <p className="text-2xl font-bold text-orange-400">{invoiceAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <p className="text-sm text-gray-300">Escolha a melhor opção de parcelamento para você. Juros de 10% a.m. (simples) serão aplicados.</p>
                <div className="space-y-3">
                    {plans.map(plan => (
                        <button
                            key={plan.installments}
                            onClick={() => onSelectOption({ amount: invoiceAmount, installments: plan.installments })}
                            className="w-full text-left p-4 bg-surface-dark rounded-lg hover:bg-white/10 transition-colors border-2 border-transparent hover:border-primary"
                        >
                            <p className="font-bold text-white">{plan.installments}x de {plan.installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            <p className="text-xs text-gray-400">Total: {plan.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </button>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default InstallmentOptions;
