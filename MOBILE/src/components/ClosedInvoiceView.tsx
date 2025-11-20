import React, { useState } from 'react';
import { Transaction, User } from '../types';
import ExtratoCompra from './ExtratoCompra'; // Reusing the detail component

interface ClosedInvoiceProps {
    user: User;
    onBack: () => void;
}

/**
 * ClosedInvoiceView: Displays transactions from the last closed invoice.
 * Each transaction is clickable to show its details.
 */
const ClosedInvoiceView: React.FC<ClosedInvoiceProps> = ({ user, onBack }) => {
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    if (selectedTransaction) {
        return <ExtratoCompra transaction={selectedTransaction} onBack={() => setSelectedTransaction(null)} />;
    }

    const { creditCard } = user;

    // This is a simplified logic. A real implementation would use start and end dates
    // of the closed billing cycle. Here, we'll just take a few recent transactions 
    // and pretend they are from the closed invoice for demonstration.
    const closedTransactions = creditCard.transactions.slice(0, 5); // Mock: Taking first 5 txs as "closed"

    const groupedTransactions = closedTransactions.reduce((acc, tx) => {
        const dateKey = new Date(tx.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
        const formattedKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1).replace('-feira', '-feira,');
        if (!acc[formattedKey]) acc[formattedKey] = [];
        acc[formattedKey].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    const transactionGroups = Object.entries(groupedTransactions).reverse();

    return (
        <div className="bg-background-dark text-white flex flex-col h-full">
            <header className="flex items-center p-4 sticky top-0 bg-background-dark z-10">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-2xl font-bold">Fatura Fechada</h1>
            </header>

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
                                    <div className="flex items-center justify-center rounded-md bg-surface-dark shrink-0 size-10">
                                        <span className="material-symbols-outlined text-primary">receipt_long</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white font-medium">{tx.merchant} {tx.installments && <span className="text-xs text-gray-400">{tx.installments}</span>}</p>
                                        <p className="text-gray-400 text-sm">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold text-white`}>
                                            {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10">
                        <p className="text-gray-500">Nenhuma compra na sua fatura fechada.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ClosedInvoiceView;
