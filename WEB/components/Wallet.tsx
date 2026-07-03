import React from 'react';

interface WalletProps {
    onBack: () => void;
}

const Wallet: React.FC<WalletProps> = ({ onBack }) => {
    return (
        <div className="bg-volt-dark text-white p-4 min-h-full w-full max-w-md mx-auto pb-28">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h1 className="text-2xl font-bold">Carteira</h1>
            </div>
            <div className="bg-volt-surface rounded-3xl text-center py-16 px-6">
                <div className="text-6xl mb-4">💳</div>
                <h3 className="text-xl font-bold text-white">Sua Carteira Digital</h3>
                <p className="text-on-surface-variant mt-2">
                    Em breve, todos os seus cartões estarão disponíveis aqui.
                </p>
            </div>
        </div>
    );
};

export default Wallet;