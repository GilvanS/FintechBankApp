import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';

interface StatementProps {
    transactions: Transaction[];
    balance: number;
    isPreview?: boolean;
    onSeeAll?: () => void;
    onBack?: () => void;
}

const TransactionItem: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
    const isCredit = transaction.amount > 0;
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Math.abs(transaction.amount));

    const icon = {
        PIX_SENT: "M13 7l5 5m0 0l-5 5m5-5H6",
        PIX_RECEIVED: "M11 17l-5-5m0 0l5-5m-5 5h12",
        DEPOSIT: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z",
        ADMIN_DEPOSIT: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
    }[transaction.type];

    const iconColor = isCredit ? 'text-green-500 bg-green-100' : 'text-red-500 bg-red-100';
    
    return (
        <li className="flex items-center justify-between py-4">
            <div className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${iconColor}`}>
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} /></svg>
                </div>
                <div className="ml-3">
                    <p className="font-semibold text-gray-800">{transaction.description}</p>
                    <p className="text-sm text-gray-500">{new Date(transaction.date).toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
            <p className={`font-semibold ${isCredit ? 'text-green-600' : 'text-gray-800'}`}>
                {isCredit ? '+' : '-'} {formattedAmount}
            </p>
        </li>
    );
};

const Statement: React.FC<StatementProps> = ({ transactions, balance, isPreview = false, onSeeAll, onBack }) => {
    const [filterDays, setFilterDays] = useState<number>(30);

    const filteredTransactions = useMemo(() => {
        if (isPreview) return transactions;
        const filterDate = new Date();
        filterDate.setDate(filterDate.getDate() - filterDays);
        return transactions.filter(t => new Date(t.date) >= filterDate);
    }, [transactions, filterDays, isPreview]);


    if (isPreview) {
        return (
             <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-bold text-gray-800">Últimas movimentações</h2>
                    <button onClick={onSeeAll} className="text-sm font-semibold text-orange-600">Ver todas</button>
                </div>
                {transactions.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                        {transactions.map(t => <TransactionItem key={t.id} transaction={t} />)}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 py-4">Nenhuma transação recente.</p>
                )}
             </div>
        )
    }

    return (
        <div className="bg-white min-h-full">
            <header className="bg-orange-500 text-white p-4 sticky top-0 z-10">
                <div className="flex items-center">
                    <button onClick={onBack} className="mr-4 p-2 -ml-2 rounded-full hover:bg-white/20">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <h2 className="text-xl font-bold">Extrato</h2>
                </div>
                 <div className="mt-4">
                    <p className="text-sm">Saldo disponível</p>
                    <p className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance)}</p>
                </div>
            </header>
            
            <div className="p-4">
                <div className="mb-4">
                     <label htmlFor="filter" className="sr-only">Filtrar período</label>
                     <select id="filter" value={filterDays} onChange={(e) => setFilterDays(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                        <option value="7">Últimos 7 dias</option>
                        <option value="15">Últimos 15 dias</option>
                        <option value="30">Últimos 30 dias</option>
                        <option value="60">Últimos 60 dias</option>
                        <option value="90">Últimos 90 dias</option>
                    </select>
                </div>
                
                {filteredTransactions.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                        {filteredTransactions.map(t => <TransactionItem key={t.id} transaction={t} />)}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 py-8">Nenhuma transação neste período.</p>
                )}
            </div>
        </div>
    );
};

export default Statement;