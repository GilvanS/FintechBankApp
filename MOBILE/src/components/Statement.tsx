import React from 'react';
import { User, Transaction } from '../types'; // Assuming these types are defined

interface StatementProps {
    user: User;
    onBack: () => void;
}

// FIX: Adiciona o cabeçalho com o botão "Voltar", permitindo que o usuário
// navegue para a tela anterior e melhorando a usabilidade.
const Statement: React.FC<StatementProps> = ({ user, onBack }) => {

    const transactions: Transaction[] = user.transactions || [];

    const getIconForTx = (category: string = 'Outros') => {
        const lowerCategory = category.toLowerCase();
        if (lowerCategory.includes('salário')) return 'attach_money';
        if (lowerCategory.includes('pix')) return 'currency_exchange';
        if (lowerCategory.includes('pagamento')) return 'receipt';
        if (lowerCategory.includes('transferência')) return 'swap_horiz';
        return 'receipt_long'; 
    };

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center p-4">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-2xl font-bold text-white">Extrato da Conta</h2>
            </header>

            <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-4">
                {transactions.length > 0 ? (
                    <div className="space-y-3">
                        {transactions.map(tx => (
                            <div key={tx.id} className="w-full p-4 rounded-lg flex items-center bg-surface-dark space-x-4">
                                <div className="p-3 bg-background-dark rounded-full">
                                    <span 
                                        className={`material-symbols-outlined ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                                        {getIconForTx(tx.category)}
                                    </span>
                                </div>
                                <div className="flex-grow">
                                    <p className="font-semibold text-white">{tx.description}</p>
                                    <p className="text-sm text-gray-400">{new Date(tx.date).toLocaleDateString('pt-BR')} - {tx.category}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold text-lg ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                                        {tx.type === 'credit' ? '+' : '-'} {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-gray-500">Nenhuma transação recente.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Statement;
