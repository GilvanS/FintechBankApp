import React from 'react';
import { useAppState } from '../contexts/AppStateContext';

interface WalletProps {
    onBack: () => void;
}

const Wallet: React.FC<WalletProps> = ({ onBack }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    // Theme-derived styles
    const containerClass = isMidnight
        ? 'bg-volt-dark text-white'
        : 'bg-volt-yellow text-black';
    const titleClass = isMidnight
        ? 'text-xl font-bold tracking-tight text-white'
        : 'text-xl font-black uppercase tracking-wide text-black';
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
        : 'text-gray-950 font-bold mt-2';

    return (
        <div className={`p-4 min-h-full font-sans flex flex-col ${containerClass}`}>
            <header className="flex items-center mb-6 pt-[calc(1rem+env(safe-area-inset-top))]">
                <button onClick={onBack} className={`mr-4 transition-all active:scale-95 flex items-center justify-center ${backBtnClass}`} aria-label="Voltar">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className={titleClass}>Carteira</h1>
            </header>
            <div className={`text-center py-16 px-6 ${cardClass}`}>
                <div className="text-6xl mb-4">💳</div>
                <h3 className={cardTitleClass}>Sua Carteira Digital</h3>
                <p className={cardTextClass}>
                    Em breve, todos os seus cartões estarão disponíveis aqui.
                </p>
            </div>
        </div>
    );
};

export default Wallet;