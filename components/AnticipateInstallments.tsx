
import React from 'react';

interface AnticipateInstallmentsProps {
    onBack: () => void;
}

const AnticipateInstallments: React.FC<AnticipateInstallmentsProps> = ({ onBack }) => {
    return (
        <div className="bg-black text-white min-h-full flex flex-col p-4">
            <header className="flex items-center mb-6">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Antecipar Parcelas</h2>
            </header>

            <main className="flex-grow flex flex-col items-center justify-center text-center">
                <div className="text-6xl mb-4">⚡️</div>
                <h3 className="text-xl font-bold text-white">Em Desenvolvimento</h3>
                <p className="text-gray-400 mt-2 max-w-xs">
                    Em breve, você poderá antecipar as parcelas de suas compras e ganhar descontos.
                </p>
            </main>
        </div>
    );
};

export default AnticipateInstallments;
