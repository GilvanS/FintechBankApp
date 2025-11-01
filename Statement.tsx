import React, { useState, useMemo } from 'react';
import { Transaction } from './types';

interface StatementProps {
    transactions: Transaction[];
    isPreview?: boolean;
}

const TransactionItem: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
    const isCredit = transaction.amount > 0;
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Math.abs(transaction.amount));

    const icon = {
        PIX_SENT: (
            <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
            </div>
        ),
        PIX_RECEIVED: (
            <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-full">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
            </div>
        ),
        DEPOSIT: (
            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full">
               <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"/></svg>
            </div>
        ),
        ADMIN_DEPOSIT: (
             <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-full">
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            </div>
        )
    }[transaction.type];
    
    return (
        <li className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
                {icon}
                <div className="ml-4">
                    <p className="font-semibold text-gray-800 dark:text-white">{transaction.description}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(transaction.date).toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
            <p className={`font-bold ${isCredit ? 'text-green-500' : 'text-red-500'}`}>
                {isCredit ? '+' : ''}{formattedAmount}
            </p>
        </li>
    );
};

const Statement: React.FC<StatementProps> = ({ transactions, isPreview = false }) => {
    const [filterDays, setFilterDays] = useState<number>(30);

    const filteredTransactions = useMemo(() => {
        if (isPreview) return transactions;
        const filterDate = new Date();
        filterDate.setDate(filterDate.getDate() - filterDays);
        return transactions.filter(t => new Date(t.date) >= filterDate);
    }, [transactions, filterDays, isPreview]);

    const filterOptions = [1, 7, 15, 30, 60, 90];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 my-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                {isPreview ? 'Atividade Recente' : 'Extrato'}
            </h2>
            
            {!isPreview && (
                <div className="flex space-x-2 overflow-x-auto pb-4 mb-4 -mx-6 px-6">
                    {filterOptions.map(days => (
                        <button key={days} onClick={() => setFilterDays(days)} className={`px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-colors ${filterDays === days ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
                            Últimos {days} dias
                        </button>
                    ))}
                </div>
            )}
            
            {filteredTransactions.length > 0 ? (
                <ul>
                    {filteredTransactions.map(t => <TransactionItem key={t.id} transaction={t} />)}
                </ul>
            ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhuma transação neste período.</p>
            )}
        </div>
    );
};

export default Statement;