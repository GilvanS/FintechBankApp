import React, { useState } from 'react';
import { Transaction, User } from '../types';

interface StatementProps {
    user: User;
    onBack: () => void;
}

// FIX: This component now correctly receives the `user` object as a prop 
// and does not depend on its own context fetching, resolving the error.
function Statement({ user, onBack }: StatementProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPeriod, setFilterPeriod] = useState('all';
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);

    // Ensure transactions exist before trying to filter and reduce them
    const filteredTransactions = (user?.transactions || [])
        .filter(tx => {
            const txDate = new Date(tx.date);
            const now = new Date();
            if (filterPeriod === '7d') {
                const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                return txDate >= sevenDaysAgo;
            }
            if (filterPeriod === '30d') {
                const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
                return txDate >= thirtyDaysAgo;
            }
            return true;
        })
        .filter(tx =>
            tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.amount.toString().includes(searchTerm) ||
            (tx.recipientName && tx.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (tx.senderName && tx.senderName.toLowerCase().includes(searchTerm.toLowerCase()))
        );

    const getIconForType = (type: Transaction['type']) => {
        switch (type) {
            case 'PIX_SENT':
            case 'PIX_RECEIVED':
            case 'PIX_CREDIT_SENT': return 'currency_exchange';
            case 'PAYMENT': return 'receipt_long';
            case 'DEPOSIT': return 'savings';
            case 'SHOP_DEBIT': return 'shopping_cart';
            case 'CASHBACK_CREDIT': return 'redeem';
            case 'POINTS_EARNED': return 'star';
            default: return 'receipt_long';
        }
    };
    
    if (!user) {
        return <p>Usuário não encontrado.</p>;
    }

    return (
        <div className="text-white">
            <header className="flex items-center mb-6">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-white/10">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h1 className="text-2xl font-bold">Extrato da Conta</h1>
            </header>

            <div className="bg-surface-dark rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between text-sm text-gray-400">
                    <p>Saldo atual</p>
                    <button onClick={() => setIsBalanceVisible(!isBalanceVisible)} className="p-1">
                        <span className="material-symbols-outlined text-lg">{isBalanceVisible ? 'visibility' : 'visibility_off'}</span>
                    </button>
                </div>
                <p className={`text-3xl font-bold text-primary mt-1 transition-all duration-300 ${!isBalanceVisible && 'blur-md'}`}>
                    {isBalanceVisible ? user.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ ********'}
                </p>
            </div>

            <div className="space-y-4 mb-4">
                <input
                    className="w-full px-4 py-3 bg-surface-dark border border-subtle-dark/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-gray-500"
                    placeholder="Buscar por nome, valor..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <div className="flex gap-2 overflow-x-auto pb-2">
                    <button onClick={() => setFilterPeriod('all')} className={`px-4 py-2 text-sm rounded-lg ${filterPeriod === 'all' ? 'bg-primary text-background-dark font-semibold' : 'bg-surface-dark hover:bg-white/10'}`}>
                        Tudo
                    </button>
                    <button onClick={() => setFilterPeriod('7d')} className={`px-4 py-2 text-sm rounded-lg ${filterPeriod === '7d' ? 'bg-primary text-background-dark font-semibold' : 'bg-surface-dark hover:bg-white/10'}`}>
                        Últimos 7 dias
                    </button>
                    <button onClick={() => setFilterPeriod('30d')} className={`px-4 py-2 text-sm rounded-lg ${filterPeriod === '30d' ? 'bg-primary text-background-dark font-semibold' : 'bg-surface-dark hover:bg-white/10'}`}>
                        Últimos 30 dias
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-4 hover:bg-surface-dark rounded-lg p-3 transition-colors duration-200">
                        <div className="text-white flex items-center justify-center rounded-full bg-background-dark shrink-0 size-10">
                            <span className="material-symbols-outlined text-primary">{getIconForType(tx.type)}</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-medium">{tx.description}</p>
                            <p className="text-gray-400 text-sm">{new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                        </div>
                        <div className="text-right">
                            <p className={`font-semibold ${tx.amount < 0 ? 'text-orange-400' : 'text-green-400'}`}>
                                {tx.amount < 0 ? '- ' : '+ '}{Math.abs(tx.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10">
                        <p className="text-gray-500">Nenhuma transação encontrada.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Statement;
