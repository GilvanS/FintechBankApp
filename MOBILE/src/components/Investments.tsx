import React, { useState } from 'react';
import { useAppState } from '../contexts/AppStateContext';
// FIX: Corrected import path for FixedIncomeProduct type from parent directory.
import { FixedIncomeProduct } from '../types';

interface InvestmentsProps {
    onBack: () => void;
}

const mockFixedIncomeProducts: FixedIncomeProduct[] = [
    {
        id: '1',
        name: 'CDB LIQUIDEZ DIARIA',
        issuer: 'Fintech Bank',
        yield: 'Rende até 102% do CDI',
        minInvestment: 1.00,
        liquidity: 'Imediato',
    },
    {
        id: '2',
        name: 'LCI 90 DIAS',
        issuer: 'Fintech Bank',
        yield: 'Rende até 88% do CDI',
        minInvestment: 50.00,
        liquidity: 'Resgate em 90 dias',
    },
    {
        id: '3',
        name: 'LCI DI 360',
        issuer: 'Fintech Bank',
        yield: 'Rende até 95% do CDI',
        minInvestment: 50.00,
        liquidity: 'Resgate em 1 ano',
    },
    {
        id: '4',
        name: 'LCI IPCA FINAL 3 ANOS',
        issuer: 'Fintech Bank',
        yield: 'Rende até IPCA + 4,89% a.a.',
        minInvestment: 50.00,
        liquidity: 'Resgate em 3 anos',
    },
    {
        id: '5',
        name: 'CDB MAIS LIMITE DE CRÉDITO',
        issuer: 'Fintech Bank',
        yield: 'Rende 82% do CDI',
        minInvestment: 100.00,
        liquidity: 'Imediato',
    },
];

type InvestmentView = 'main' | 'fixedIncome';

const Investments: React.FC<InvestmentsProps> = ({ onBack }) => {
    const [view, setView] = useState<InvestmentView>('main');
    const [totalInvested] = useState(12345.67); // Mocked value
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);

    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    // Theme-derived styles
    const containerClass = isMidnight
        ? 'bg-volt-dark text-white'
        : 'bg-volt-yellow text-black';
    const titleClass = isMidnight
        ? 'text-2xl font-bold tracking-tight text-white'
        : 'text-2xl font-black uppercase tracking-wide text-black';
    const backBtnClass = isMidnight
        ? 'p-2 rounded-full border border-white/10 bg-volt-surface hover:bg-white/10 text-white shadow-none'
        : 'p-2 rounded-full border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black/5';
    const cardClass = isMidnight
        ? 'bg-volt-surface border border-white/5 shadow-lg rounded-2xl'
        : 'bg-white border-4 border-black shadow-[4px_4px_0px_0px_#A2FF00] rounded-3xl';
    const cardTitleClass = isMidnight
        ? 'text-xs font-semibold text-white/60 uppercase tracking-wider block'
        : 'text-gray-900 font-bold uppercase tracking-wider text-xs block';
    const balanceClass = isMidnight
        ? 'text-3xl font-bold mt-2 text-volt-green'
        : 'text-3xl font-black mt-2 text-black';
    const sectionTitleClass = isMidnight
        ? 'text-lg font-semibold text-white mb-3'
        : 'text-lg font-black uppercase text-black mb-3';
    const productCardClass = isMidnight
        ? 'w-full text-left p-4 bg-volt-surface border border-white/5 rounded-2xl shadow-md flex justify-between items-center hover:border-volt-green/20 transition-all text-white'
        : 'w-full text-left p-4 bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] flex justify-between items-center hover:bg-gray-50 transition-all text-black';
    const productNameClass = isMidnight
        ? 'font-semibold text-white'
        : 'font-black text-black';
    const productDescClass = isMidnight
        ? 'text-sm text-on-surface-variant font-medium'
        : 'text-sm text-gray-500 font-bold';
    const arrowClass = isMidnight ? 'text-volt-green' : 'text-black';

    const renderMainDashboard = () => (
        <>
            <header className="flex items-center mb-6 px-4 pt-4">
                <button onClick={onBack} className={`mr-4 transition-all active:scale-95 flex items-center justify-center ${backBtnClass}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h1 className={titleClass}>Investimentos</h1>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar px-4 space-y-6">
                <div className={`p-6 ${cardClass}`}>
                    <div className="flex justify-between items-center">
                        <span className={cardTitleClass}>Total investido</span>
                        <button onClick={() => setIsBalanceVisible(!isBalanceVisible)} className={`transition-colors ${isMidnight ? 'text-white hover:text-gray-300' : 'text-black hover:bg-black/5'}`}>
                            {isBalanceVisible ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a10.05 10.05 0 015.313-6.494m4.23-1.031a10.034 10.034 0 015.494 6.494M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" /></svg>
                            )}
                        </button>
                    </div>
                    <p className={`${balanceClass} transition-all duration-300 ${!isBalanceVisible ? 'blur-md' : ''}`}>
                        {isBalanceVisible ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInvested) : 'R$ ••••••'}
                    </p>
                </div>
                <div>
                    <h2 className={sectionTitleClass}>Onde investir</h2>
                    <div className="space-y-3">
                        <button onClick={() => setView('fixedIncome')} className={productCardClass}>
                            <div>
                                <p className={productNameClass}>Renda Fixa</p>
                                <p className={productDescClass}>Investimentos seguros com rentabilidade previsível.</p>
                            </div>
                            <svg className={`w-5 h-5 ${arrowClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </div>
            </main>
        </>
    );

    const renderFixedIncomeView = () => (
        <>
            <header className="flex items-center mb-6 px-4 pt-4">
                <button onClick={() => setView('main')} className={`mr-4 transition-all active:scale-95 flex items-center justify-center ${backBtnClass}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h1 className={titleClass}>Renda Fixa</h1>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar px-4 space-y-3">
                {mockFixedIncomeProducts.map(product => {
                    const productItemCardClass = isMidnight
                        ? 'bg-volt-surface border border-white/5 shadow-md p-4 rounded-2xl'
                        : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] p-4 rounded-lg';
                    return (
                        <div key={product.id} className={productItemCardClass}>
                            <h3 className={productNameClass}>{product.name}</h3>
                            <p className={`text-sm font-bold mt-1 ${isMidnight ? 'text-volt-green' : 'text-volt-lime'}`}>{product.yield}</p>
                            <div className={`flex justify-between items-center mt-3 text-xs font-bold ${isMidnight ? 'text-on-surface-variant' : 'text-gray-400'}`}>
                                <span>Mínimo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.minInvestment)}</span>
                                <span>Liquidez: {product.liquidity}</span>
                            </div>
                        </div>
                    );
                })}
            </main>
        </>
    );

    const renderContent = () => {
        switch(view) {
            case 'fixedIncome':
                return renderFixedIncomeView();
            case 'main':
            default:
                return renderMainDashboard();
        }
    };
    
    return (
        <div className={`min-h-full flex flex-col w-full max-w-md mx-auto font-sans ${containerClass}`}>
            {renderContent()}
        </div>
    );
};

export default Investments;