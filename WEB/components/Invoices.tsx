

import React from 'react';
// FIX: Corrected import path for Transaction type from parent directory.
import { Transaction } from '../types';

interface InvoicesProps {
    transactions: Transaction[];
    onBack: () => void;
}

const Invoices: React.FC<InvoicesProps> = ({ transactions, onBack }) => {
    // Lógica de exemplo para filtrar despesas do "cartão"
    const cardExpenses = transactions.filter(t => t.amount < 0 && t.type === 'PIX_SENT');

    return (
        <div className="bg-[#1C1C1E] rounded-2xl shadow-lg p-6 my-4">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Fatura do Cartão</h2>
            </div>

            <div className="text-center py-16">
                <div className="text-5xl mb-4">💳</div>
                <h3 className="text-xl font-bold text-white">Funcionalidade em Desenvolvimento</h3>
                <p className="text-gray-400 mt-2">
                    Em breve, você poderá visualizar e gerenciar a fatura do seu cartão por aqui.
                </p>
            </div>
        </div>
    );
};

export default Invoices;