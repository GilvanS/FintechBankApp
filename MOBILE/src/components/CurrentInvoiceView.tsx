import React, { useState } from 'react';
import { Transaction, User } from '../types';
import ExtratoCompra from './ExtratoCompra'; // Reusing the detail component

interface CurrentInvoiceProps {
    user: User;
    onBack: () => void;
}

/**
 * CurrentInvoiceView: Displays all transactions for the current credit card invoice.
 * It allows clicking on a transaction to see its details.
 */
const CurrentInvoiceView: React.FC<CurrentInvoiceProps> = ({ user, onBack }) => {
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    // If a transaction is selected, render the detail view.
    if (selectedTransaction) {
        return <ExtratoCompra transaction={selectedTransaction} onBack={() => setSelectedTransaction(null)} />;
    }

    const { creditCard } = user;

    // Logic to determine current transactions (very simplified for this mock data)
    // In a real scenario, this would be based on billing cycle dates.
    const invoiceDueDate = creditCard.invoiceDueDate ? new Date(creditCard.invoiceDueDate) : new Date();
    const endOfDay = new Date(invoiceDueDate); // Get the due date
    endOfDay.setHours(23, 59, 59, 999); // Set to end of day
    
    // Assume transactions before the due date belong to the current or closed invoice
    const currentTransactions = creditCard.transactions.filter(tx => new Date(tx.date) <= endOfDay);

    // Group transactions by date for a cleaner UI
    const groupedTransactions = currentTransactions.reduce((acc, tx) => {
        const dateKey = new Date(tx.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
        const formattedKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1).replace('-feira', '-feira,');
        if (!acc[formattedKey]) acc[formattedKey] = [];
        acc[formattedKey].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    const transactionGroups = Object.entries(groupedTransactions).reverse(); // Show most recent first

    return (
        <div className="bg-background-dark text-white flex flex-col h-full">
            <header className="flex items-center p-4 sticky top-0 bg-background-dark z-10">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-2xl font-bold">Fatura Aberta</h1>
            </header>

            <main className="flex-grow overflow-y-auto p-4 space-y-6">
                {transactionGroups.length > 0 ? transactionGroups.map(([date, txs]: [string, Transaction[]]) => (
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
                        <p className="text-gray-500">Nenhuma compra na sua fatura atual.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default CurrentInvoiceView;
