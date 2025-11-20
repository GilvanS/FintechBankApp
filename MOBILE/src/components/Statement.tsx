import React, { useState } from 'react';
import { Transaction, User } from '../types';
import ExtratoCompra from './ExtratoCompra'; // Import the new detail component

interface StatementProps {
    user: User;
    onBack: () => void;
}

// The categories for the filter bar
const categories = ['Todos', 'Refeição', 'Mobilidade', 'Cultura', 'Home'];

/**
 * Statement: A completely redesigned component to display transactions.
 * - It now supports filtering by category.
 * - Groups transactions by date.
 * - Allows clicking on a transaction to see its details in the ExtratoCompra component.
 */
const Statement: React.FC<StatementProps> = ({ user, onBack }) => {
    const [activeFilter, setActiveFilter] = useState('Todos');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    // If a transaction is selected, show the detail view.
    if (selectedTransaction) {
        return <ExtratoCompra transaction={selectedTransaction} onBack={() => setSelectedTransaction(null)} />;
    }

    const transactions = user?.transactions || [];

    // Filter transactions based on the active category.
    const filteredTransactions = transactions.filter(tx => {
        if (activeFilter === 'Todos') return true;
        // This assumes the `category` property exists on the transaction object.
        return tx.category === activeFilter;
    });

    // Group transactions by date, matching the design.
    const groupedTransactions = filteredTransactions.reduce((acc, tx) => {
        const dateKey = new Date(tx.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
        const formattedKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1).replace('-feira', '-feira,');
        
        if (!acc[formattedKey]) {
            acc[formattedKey] = [];
        }
        acc[formattedKey].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    const transactionGroups = Object.entries(groupedTransactions);

    return (
        <div className="bg-background-dark text-white flex flex-col h-full">
            {/* Header */}
            <header className="flex items-center justify-between p-4 sticky top-0 bg-background-dark z-10">
                <h1 className="text-2xl font-bold">Extrato</h1>
                <button className="p-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">help_outline</span>
                </button>
            </header>

            {/* Category Filters */}
            <div className="px-4 py-2 sticky top-[68px] bg-background-dark z-10">
                 <div className="flex gap-3 overflow-x-auto pb-2 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => setActiveFilter(cat)}
                            className={`px-5 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-colors ${activeFilter === cat ? 'bg-[#A40F4C] text-white' : 'bg-surface-dark text-gray-300 hover:bg-white/20'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Transaction List */}
            <main className="flex-grow overflow-y-auto p-4 space-y-6">
                {transactionGroups.length > 0 ? transactionGroups.map(([date, txs]) => (
                    <div key={date} className="space-y-4">
                        <p className="font-semibold text-gray-400">{date}</p>
                        <div className="space-y-2">
                            {txs.map(tx => (
                                <button 
                                    key={tx.id} 
                                    onClick={() => setSelectedTransaction(tx)}
                                    className="w-full flex items-center gap-4 hover:bg-surface-dark rounded-lg p-3 transition-colors duration-200 text-left"
                                >
                                    <div className="flex items-center justify-center rounded-md bg-surface-dark shrink-0 size-10 font-bold text-yellow-400">
                                        YP
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Compra › {tx.category}</p>
                                        <p className="text-white font-medium mt-1">{tx.merchant}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-red-400">- {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10">
                        <p className="text-gray-500">Nenhuma transação encontrada para "{activeFilter}".</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Statement;
