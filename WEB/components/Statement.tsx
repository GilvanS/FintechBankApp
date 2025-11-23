import React, { useState, useEffect } from 'react';
import { Transaction, User } from '../types';
import { getUserStatement } from '../services/api';
import TransactionReceipt from './TransactionReceipt';

interface StatementProps {
    user: User;
    onNavigate: (view: string) => void;
    onBack: () => void;
}

function Statement({ user, onNavigate, onBack }: StatementProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPeriod, setFilterPeriod] = useState('all');
    const [transactions, setTransactions] = useState<Transaction[]>(user.transactions || []);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    // Buscar extrato quando o componente for montado
    useEffect(() => {
        const fetchStatement = async () => {
            if (!user?.cpf) return;
            setIsLoading(true);
            try {
                const result = await getUserStatement(user.cpf);
                if (result.success && result.transactions) {
                    setTransactions(result.transactions);
                } else {
                    // Manter transações existentes se houver erro
                    if (user.transactions && user.transactions.length > 0) {
                        setTransactions(user.transactions);
                    }
                }
            } catch (error) {
                // Silenciar erro - usar transações existentes se houver
                if (user.transactions && user.transactions.length > 0) {
                    setTransactions(user.transactions);
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchStatement();
    }, [user?.cpf]); // Recarregar quando o CPF mudar

    const filteredTransactions = transactions
        .filter(tx => {
            const txDate = new Date(tx.date);
            if (filterPeriod === '7d') {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return txDate >= sevenDaysAgo;
            }
            if (filterPeriod === '30d') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
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

    const getIconForType = (type: Transaction['type'], category?: string) => {
        if (category) {
            switch (category) {
                case 'food': return 'restaurant';
                case 'transport': return 'directions_car';
                case 'shopping': return 'shopping_cart';
            }
        }
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

    // Se uma transação foi selecionada, mostrar o comprovante
    if (selectedTransaction) {
        return (
            <TransactionReceipt 
                transaction={selectedTransaction} 
                onBack={() => setSelectedTransaction(null)} 
            />
        );
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-8">
            <header className="flex items-center">
                <button onClick={onBack} className="mr-4 text-white"><span className="material-symbols-outlined">arrow_back</span></button>
                <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em]">Extrato da Conta</h1>
            </header>
            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <p className="text-white/70 text-base font-normal leading-normal">Saldo atual</p>
                    <button className="text-white/70 hover:text-white">
                        <span className="material-symbols-outlined">visibility</span>
                    </button>
                </div>
                <p className="text-white text-4xl font-bold mt-2">{user.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            <div className="space-y-4">
                <h2 className="text-white/90 text-lg font-semibold px-4">Transações</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="px-3">
                        <label className="flex flex-col min-w-40 h-12 w-full">
                            <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                                <div className="text-primary/70 flex border-none bg-primary/10 items-center justify-center pl-4 rounded-l-lg border-r-0">
                                    <span className="material-symbols-outlined">search</span>
                                </div>
                                <input
                                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border-none bg-primary/10 h-full placeholder:text-primary/70 px-4 pl-2 text-base font-normal leading-normal"
                                    placeholder="Buscar por nome ou valor..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </label>
                    </div>
                    <div className="flex gap-2 p-3 overflow-x-auto md:justify-end">
                        <button onClick={() => setFilterPeriod('all')} className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg px-4 ${filterPeriod === 'all' ? 'bg-primary/20' : 'bg-primary/10 hover:bg-primary/20'}`}>
                            <p className="text-white text-sm font-medium leading-normal">Tudo</p>
                        </button>
                        <button onClick={() => setFilterPeriod('7d')} className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg px-4 ${filterPeriod === '7d' ? 'bg-primary/20' : 'bg-primary/10 hover:bg-primary/20'}`}>
                            <p className="text-white text-sm font-medium leading-normal">Últimos 7 dias</p>
                        </button>
                        <button onClick={() => setFilterPeriod('30d')} className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg px-4 ${filterPeriod === '30d' ? 'bg-primary/20' : 'bg-primary/10 hover:bg-primary/20'}`}>
                            <p className="text-white text-sm font-medium leading-normal">Este mês</p>
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <p className="text-white/60">Carregando transações...</p>
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <div className="flex items-center justify-center p-8">
                        <p className="text-white/60">Nenhuma transação encontrada</p>
                    </div>
                ) : (
                    filteredTransactions.map((tx) => (
                    <button
                        key={tx.id}
                        onClick={() => setSelectedTransaction(tx)}
                        className="w-full flex items-center gap-4 hover:bg-white/5 rounded-lg p-4 transition-colors duration-200 text-left cursor-pointer"
                    >
                        <div className="text-white flex items-center justify-center rounded-full bg-primary/10 shrink-0 size-10">
                            <span className="material-symbols-outlined text-primary">{getIconForType(tx.type, (tx as any).category)}</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-white text-base font-medium leading-normal">{tx.description}</p>
                            <p className="text-white/60 text-sm">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="text-right">
                            <p className={`text-base font-semibold ${tx.amount < 0 ? 'text-orange-400' : 'text-primary'}`}>{tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </button>
                    ))
                )}
            </div>
        </main>
    );
};

export default Statement;
