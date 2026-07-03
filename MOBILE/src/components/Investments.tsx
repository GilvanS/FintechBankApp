import React, { useState } from 'react';
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

    const renderMainDashboard = () => (
        <>
            <header className="flex items-center mb-6 px-4 pt-4">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h1 className="text-2xl font-bold">Investimentos</h1>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar px-4 space-y-6">
                <div className="bg-volt-surface rounded-2xl p-6 text-white">
                    <div className="flex justify-between items-center">
                        <span className="text-orange-300">Total investido</span>
                         <button onClick={() => setIsBalanceVisible(!isBalanceVisible)} className="text-orange-300 hover:text-white">
                            {isBalanceVisible ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a10.05 10.05 0 015.313-6.494m4.23-1.031a10.034 10.034 0 015.494 6.494M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" /></svg>
                            )}
                        </button>
                    </div>
                    <p className={`text-3xl font-bold mt-2 transition-all duration-300 ${!isBalanceVisible ? 'blur-md' : ''}`}>
                        {isBalanceVisible ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInvested) : 'R$ ••••••'}
                    </p>
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-white mb-3">Onde investir</h2>
                    <div className="space-y-3">
                        <button onClick={() => setView('fixedIncome')} className="w-full text-left p-4 bg-volt-surface rounded-lg flex justify-between items-center hover:bg-white/10">
                            <div>
                                <p className="font-bold text-white">Renda Fixa</p>
                                <p className="text-sm text-on-surface-variant">Investimentos seguros com rentabilidade previsível.</p>
                            </div>
                            <svg className="w-5 h-5 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                        </button>
                        {/* More categories can be added here */}
                    </div>
                </div>
            </main>
        </>
    );

    const renderFixedIncomeView = () => (
        <>
            <header className="flex items-center mb-6 px-4 pt-4">
                <button onClick={() => setView('main')} className="mr-4 p-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h1 className="text-2xl font-bold">Renda Fixa</h1>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar px-4 space-y-3">
                {mockFixedIncomeProducts.map(product => (
                    <div key={product.id} className="bg-volt-surface p-4 rounded-lg">
                        <h3 className="font-bold text-white">{product.name}</h3>
                        <p className="text-sm text-orange-400 font-semibold">{product.yield}</p>
                        <div className="flex justify-between items-center mt-3 text-xs text-on-surface-variant">
                            <span>Mínimo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.minInvestment)}</span>
                            <span>Liquidez: {product.liquidity}</span>
                        </div>
                    </div>
                ))}
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
        <div className="bg-volt-dark text-white min-h-full flex flex-col w-full max-w-md mx-auto pb-28">
            {renderContent()}
        </div>
    );
};

export default Investments;