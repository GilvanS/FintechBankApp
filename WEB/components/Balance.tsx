
import React, { useState } from 'react';

interface BalanceProps {
    balance: number;
}

const Balance: React.FC<BalanceProps> = ({ balance }) => {
    const [isVisible, setIsVisible] = useState(true);

    const formattedBalance = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(balance);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 my-4">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-gray-500 dark:text-gray-400">Saldo em conta</h2>
                <button onClick={() => setIsVisible(!isVisible)} className="text-gray-500 dark:text-gray-400">
                    {isVisible ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a10.05 10.05 0 015.313-6.494m4.23-1.031a10.034 10.034 0 015.494 6.494M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" /></svg>
                    )}
                </button>
            </div>
            <p className={`text-3xl font-bold text-gray-800 dark:text-white transition-all duration-300 ${!isVisible && 'blur-md'}`}>
                {isVisible ? formattedBalance : 'R$ ••••••'}
            </p>
        </div>
    );
};

export default Balance;
