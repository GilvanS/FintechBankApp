import React, { useState, useMemo } from 'react';
import { User } from '../types';

interface InstallmentReviewInvoiceProps {
    user: User;
    details: {
        amount: number;
        installments: number;
    };
    onConfirm: () => void;
    onBack: () => void;
}

const InfoRow: React.FC<{ label: string; value: string | React.ReactNode; }> = ({ label, value }) => (
    <div className="py-3 border-b border-gray-800 flex justify-between items-center text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold text-white text-right">{value}</span>
    </div>
);

const InstallmentReviewInvoice: React.FC<InstallmentReviewInvoiceProps> = ({ user, details, onConfirm, onBack }) => {
    const [termsAccepted, setTermsAccepted] = useState(false);
    
    const { amount, installments } = details;

    const calculations = useMemo(() => {
        const interestRatePerInstallment = 0.10; // 10% for Invoice
        const totalInterest = interestRatePerInstallment * installments;
        const totalAmount = amount * (1 + totalInterest);
        const installmentValue = totalAmount / installments;
        const firstInstallmentDate = new Date();
        firstInstallmentDate.setMonth(firstInstallmentDate.getMonth() + 1);
        
        return { totalAmount, installmentValue, firstInstallmentDate, interestRatePerInstallment, totalInterest };
    }, [amount, installments]);

    const { totalAmount, installmentValue, firstInstallmentDate, interestRatePerInstallment, totalInterest } = calculations;

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
             <header className="flex items-center p-4 border-b border-subtle-dark/50">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-xl font-bold text-white">Revise as informações</h2>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-4">
                <p className="text-sm text-gray-400">Essas são as condições de contratação para prosseguir com a operação.</p>

                <div className="bg-surface-dark rounded-lg p-4">
                    <div className="flex justify-between items-baseline py-3 border-b border-white/10">
                        <span className="text-gray-400">Valor da Fatura</span>
                        <span className="font-bold text-2xl text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}</span>
                    </div>
                     <div className="flex justify-between items-baseline py-3">
                        <span className="text-gray-400">Você paga</span>
                        <span className="font-bold text-2xl text-orange-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}</span>
                    </div>
                </div>

                <div className="bg-surface-dark rounded-lg p-4">
                    <InfoRow label="Parcelas" value={`${installments}x de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installmentValue)}`} />
                    <InfoRow label="1ª parcela (débito)" value={`${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installmentValue)} - Será debitada agora`} />
                    <InfoRow label="Demais parcelas" value={`${installments - 1}x de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installmentValue)} - Na fatura`} />
                    <InfoRow label="1ª parcela na fatura" value={firstInstallmentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} />
                    <InfoRow label="Taxa de juros" value={`${(interestRatePerInstallment * 100).toFixed(2)}% ao mês; ${(totalInterest * 100).toFixed(2)}% ao período`} />
                </div>
                
                <div className="space-y-2 text-sm">
                    <button className="w-full flex justify-between items-center text-gray-300">
                        <span>Leia mais condições</span>
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                     <button className="w-full flex justify-between items-center text-gray-300">
                        <span>Leia seus direitos e regras</span>
                         <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                </div>

                <div className="pt-4">
                    <label className="flex items-start space-x-3 cursor-pointer">
                        <input type="checkbox" checked={termsAccepted} onChange={() => setTermsAccepted(!termsAccepted)} className="mt-1 h-5 w-5 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-600" />
                        <span className="text-sm text-gray-400">
                            Autorizo o débito do valor total ou parcial da(s) parcela(s) na(s) conta(s) corrente(s) indicada(s), na data de vencimento ou após o vencimento, podendo ser utilizado o limite do cheque especial.
                        </span>
                    </label>
                </div>
            </main>
            <footer className="p-4 border-t border-subtle-dark/50">
                <button onClick={onConfirm} disabled={!termsAccepted} className="w-full py-4 font-semibold text-background-dark bg-orange-500 rounded-lg hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed">
                    Continuar
                </button>
            </footer>
        </div>
    );
};

export default InstallmentReviewInvoice;

