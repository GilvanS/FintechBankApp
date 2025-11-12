import React, { useState } from 'react';

interface CardsProps {
    balance: number;
    onNavigate: () => void;
}

const Cards: React.FC<CardsProps> = ({ balance, onNavigate }) => {
    const [isVisible, setIsVisible] = useState(true);

    const formattedBalance = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(balance);

    return (
        <div className="relative rounded-2xl shadow-2xl p-6 my-4 text-white overflow-hidden bg-orange-600">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full"></div>
            <div className="absolute -bottom-12 -left-6 w-28 h-28 bg-white/10 rounded-full"></div>
            
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-sm text-orange-200">Balanço Total</p>
                        <p className={`text-3xl font-bold transition-all duration-300 ${!isVisible ? 'blur-md' : ''}`}>
                            {isVisible ? formattedBalance : 'R$ ••••••'}
                        </p>
                    </div>
                    <img src="https://i.imgur.com/gK2oYvY.png" alt="Card Chip" className="w-10 h-auto opacity-80" />
                </div>

                 <p className="text-lg font-mono tracking-widest text-orange-200/80 my-6">
                   4562 1122 4595 7852
                </p>

                <div className="flex justify-between items-end">
                    <div>
                         <button onClick={onNavigate} className="px-4 py-2 text-sm font-semibold bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                            Ver Fatura
                        </button>
                    </div>

                    <button onClick={() => setIsVisible(!isVisible)} className="text-orange-200 hover:text-white">
                        {isVisible ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a10.05 10.05 0 015.313-6.494m4.23-1.031a10.034 10.034 0 015.494 6.494M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" /></svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Cards;
