import React from 'react';
import { useAppState } from '../contexts/AppStateContext';

interface LoansProps {
    onBack: () => void;
}

const Loans: React.FC<LoansProps> = ({ onBack }) => {
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
        ? 'text-xl font-semibold text-white'
        : 'text-xl font-black text-black uppercase';
    const cardTextClass = isMidnight
        ? 'text-on-surface-variant font-medium mt-2'
        : 'text-gray-900 font-bold mt-2';

    return (
        <div className={`p-4 min-h-full font-sans ${containerClass}`}>
            <div className="flex items-center mb-6">
                <button onClick={onBack} className={`mr-4 transition-all active:scale-95 flex items-center justify-center ${backBtnClass}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h1 className={titleClass}>Empréstimos</h1>
            </div>
            <div className={`text-center py-16 px-6 ${cardClass}`}>
                <div className="text-6xl mb-4">💰</div>
                <h3 className={cardTitleClass}>Crédito para você</h3>
                <p className={cardTextClass}>
                    Em breve, você poderá simular e contratar empréstimos pelo app.
                </p>
            </div>
        </div>
    );
};

export default Loans;