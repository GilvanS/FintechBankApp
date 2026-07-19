import React, { useState, useMemo } from 'react';
// FIX: Corrected import path for User type from parent directory.
import { User } from '../types';
import { useAppState } from '../contexts/AppStateContext';

interface InstallmentReviewProps {
    type: 'pix-credit' | 'invoice';
    user: User;
    details: {
        amount: number;
        installments: number;
        installmentValue?: number;
        totalAmount?: number;
        iof?: number;
        juros?: number;
    };
    onConfirm: () => void;
    onBack: () => void;
}

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const InstallmentReview: React.FC<InstallmentReviewProps> = ({ type, user, details, onConfirm, onBack }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [termsAccepted, setTermsAccepted] = useState(false);

    const { amount, installments } = details;

    const calculations = useMemo(() => {
        const firstInstallmentDate = new Date();
        firstInstallmentDate.setMonth(firstInstallmentDate.getMonth() + 1);

        if (type === 'invoice' && details.installmentValue != null && details.totalAmount != null) {
            const totalAmount = details.totalAmount;
            const installmentValue = details.installmentValue;
            const totalInterest = amount > 0 ? (totalAmount - amount) / amount : 0;
            return { totalAmount, installmentValue, firstInstallmentDate, interestRatePerInstallment: totalInterest / installments, totalInterest, iof: details.iof, juros: details.juros };
        }

        const interestRatePerInstallment = 0.05; // 5% a.m. para PIX parcelado no crédito
        const totalInterest = interestRatePerInstallment * installments;
        const totalAmount = amount * (1 + totalInterest);
        const installmentValue = totalAmount / installments;

        return { totalAmount, installmentValue, firstInstallmentDate, interestRatePerInstallment, totalInterest };
    }, [type, amount, installments, details.installmentValue, details.totalAmount, details.iof, details.juros]);

    const { totalAmount, installmentValue, firstInstallmentDate, interestRatePerInstallment, totalInterest, iof, juros } = calculations as typeof calculations & { iof?: number; juros?: number };

    const InfoRow: React.FC<{ label: string; value: string | React.ReactNode; }> = ({ label, value }) => (
        <div className={`py-3 flex justify-between items-center text-sm border-b last:border-0 ${isMidnight ? 'border-white/10' : 'border-black/10'}`}>
            <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>{label}</span>
            <span className={`font-semibold text-right ${isMidnight ? 'text-white' : 'text-black'}`}>{value}</span>
        </div>
    );

    const cardCls = isMidnight
        ? 'bg-volt-surface border border-white/5 shadow-lg rounded-2xl p-4'
        : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-2xl p-4';

    return (
        <div className={`${isMidnight ? 'bg-volt-dark text-white' : 'bg-volt-yellow text-black'} p-4 min-h-full flex flex-col w-full max-w-md mx-auto`}>
             <header className="flex items-center mb-6">
                <button onClick={onBack} className={`mr-2 p-2 rounded-full transition-colors ${isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className={`text-xl font-bold ${isMidnight ? 'text-white' : 'text-black'}`}>Revise as informações</h2>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar space-y-4">
                <p className={`text-sm ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>Essas são as condições de contratação para prosseguir com a operação.</p>

                <div className={cardCls}>
                    <div className={`flex justify-between items-baseline py-3 border-b ${isMidnight ? 'border-white/10' : 'border-black/10'}`}>
                        <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>{type === 'pix-credit' ? 'Você transfere' : 'Valor da Fatura'}</span>
                        <span className={`font-black text-2xl ${isMidnight ? 'text-white' : 'text-black'}`}>{fmtBRL(amount)}</span>
                    </div>
                     <div className="flex justify-between items-baseline py-3">
                        <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>Você paga</span>
                        <span className="font-black text-2xl text-volt-primary">{fmtBRL(totalAmount)}</span>
                    </div>
                </div>

                <div className={cardCls}>
                    <InfoRow label="Parcelas" value={`${installments}x de ${fmtBRL(installmentValue)}`} />
                    <InfoRow label="1ª parcela" value={firstInstallmentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} />
                    {iof != null && <InfoRow label="IOF" value={fmtBRL(iof)} />}
                    {juros != null && <InfoRow label="Juros" value={fmtBRL(juros)} />}
                    <InfoRow label="Taxa de juros" value={`${(interestRatePerInstallment * 100).toFixed(2)}% ao mês; ${(totalInterest * 100).toFixed(2)}% ao período`} />
                </div>

                <div className="space-y-2 text-sm">
                    <button className={`w-full flex justify-between items-center ${isMidnight ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span>Leia mais condições</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                     <button className={`w-full flex justify-between items-center ${isMidnight ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span>Leia seus direitos e regras</span>
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                <div className="pt-4">
                    <label className="flex items-start space-x-3 cursor-pointer">
                        {/* Sem classe bg-*: o plugin @tailwindcss/forms pinta o fundo com currentColor
                            quando marcado — um bg utilitário fixo esconderia o check (branco sobre branco). */}
                        <input type="checkbox" checked={termsAccepted} onChange={() => setTermsAccepted(!termsAccepted)} className={`mt-1 h-5 w-5 text-volt-primary rounded focus:ring-volt-primary cursor-pointer ${isMidnight ? 'border-gray-600' : 'border-2 border-black'}`} />
                        <span className={`text-sm ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>
                            Autorizo o débito do valor total ou parcial da(s) parcela(s) na(s) conta(s) corrente(s) indicada(s), na data de vencimento ou após o vencimento, podendo ser utilizado o limite do cheque especial.
                        </span>
                    </label>
                </div>
            </main>
            <footer className="mt-auto pt-4">
                <button
                    onClick={onConfirm}
                    disabled={!termsAccepted}
                    className={`w-full py-4 font-bold text-black rounded-xl transition-all ${
                        isMidnight
                            ? 'bg-volt-primary hover:opacity-90 disabled:bg-gray-600 disabled:cursor-not-allowed'
                            : 'bg-volt-primary border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] disabled:bg-gray-400 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 disabled:cursor-not-allowed'
                    }`}
                >
                    Continuar
                </button>
            </footer>
        </div>
    );
};

export default InstallmentReview;
