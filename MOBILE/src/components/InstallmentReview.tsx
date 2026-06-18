import React, { useState, useMemo } from 'react';
// FIX: Corrected import path for User type from parent directory.
import { User } from '../types';

interface InstallmentReviewProps {
    type: 'pix-credit' | 'invoice';
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


const InstallmentReview: React.FC<InstallmentReviewProps> = ({ type, user, details, onConfirm, onBack }) => {
    const [termsAccepted, setTermsAccepted] = useState(false);
    
    const { amount, installments } = details;

    const calculations = useMemo(() => {
        const isPix = type === 'pix-credit';
        const interestRatePerInstallment = isPix ? 0.05 : 0.10; // 5% for PIX, 10% for Invoice
        const totalInterest = interestRatePerInstallment * installments;
        const totalAmount = amount * (1 + totalInterest);
        const installmentValue = totalAmount / installments;
        const firstInstallmentDate = new Date();
        firstInstallmentDate.setMonth(firstInstallmentDate.getMonth() + 1);
        
        return { totalAmount, installmentValue, firstInstallmentDate, interestRatePerInstallment, totalInterest };
    }, [type, amount, installments]);

    const { totalAmount, installmentValue, firstInstallmentDate, interestRatePerInstallment, totalInterest } = calculations;

    return (
        <div className="bg-black text-white h-screen flex flex-col">
            <header className="flex-shrink-0 flex items-center px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-xl font-bold text-white">Revise as informações</h2>
            </header>
            <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4 px-4">
                <p className="text-sm text-gray-400">Essas são as condições de contratação para prosseguir com a operação.</p>

                <div className="bg-gray-900 rounded-lg p-4">
                    <div className="flex justify-between items-baseline py-3 border-b border-gray-800">
                        <span className="text-gray-400">{type === 'pix-credit' ? 'Você transfere' : 'Valor da Fatura'}</span>
                        <span className="font-bold text-2xl text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}</span>
                    </div>
                     <div className="flex justify-between items-baseline py-3">
                        <span className="text-gray-400">Você paga</span>
                        <span className="font-bold text-2xl text-orange-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}</span>
                    </div>
                </div>

                <div className="bg-gray-900 rounded-lg p-4">
                    <InfoRow label="Parcelas" value={`${installments}x de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installmentValue)}`} />
                    <InfoRow label="1ª parcela" value={firstInstallmentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} />
                    <InfoRow label="Taxa de juros" value={`${(interestRatePerInstallment * 100).toFixed(2)}% ao mês; ${(totalInterest * 100).toFixed(2)}% ao período`} />
                </div>
                
                <div className="space-y-2 text-sm">
                    <button className="w-full flex justify-between items-center text-gray-300">
                        <span>Leia mais condições</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                     <button className="w-full flex justify-between items-center text-gray-300">
                        <span>Leia seus direitos e regras</span>
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                <div className="pt-4 pb-4">
                    <label className="flex items-start space-x-3 cursor-pointer">
                        <input type="checkbox" checked={termsAccepted} onChange={() => setTermsAccepted(!termsAccepted)} className="mt-1 h-5 w-5 text-primary bg-gray-700 border-gray-600 rounded focus:ring-primary" />
                        <span className="text-sm text-gray-400">
                            Autorizo o débito do valor total ou parcial da(s) parcela(s) na(s) conta(s) corrente(s) indicada(s), na data de vencimento ou após o vencimento, podendo ser utilizado o limite do cheque especial.
                        </span>
                    </label>
                </div>
            </main>
            <footer className="flex-shrink-0 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
                <button onClick={onConfirm} disabled={!termsAccepted} className="w-full py-4 font-semibold text-background-dark bg-primary rounded-lg hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed">
                    Continuar
                </button>
            </footer>
        </div>
    );
};

export default InstallmentReview;