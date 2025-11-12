import React from 'react';

interface WalletProps {
    onBack: () => void;
}

const Wallet: React.FC<WalletProps> = ({ onBack }) => {
    return (
        <div className="bg-black text-white p-4 min-h-full">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h1 className="text-2xl font-bold">Carteira</h1>
            </div>
            <div className="text-center py-16">
                <div className="text-6xl mb-4">💳</div>
                <h3 className="text-xl font-bold text-white">Sua Carteira Digital</h3>
                <p className="text-gray-400 mt-2">
                    Em breve, todos os seus cartões estarão disponíveis aqui.
                </p>
            </div>
        </div>
    );
};

export default Wallet;