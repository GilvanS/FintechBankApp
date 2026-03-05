import React, { useState, useEffect } from 'react';
import { Transaction, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { getUserStatement } from '../services/api';
import TransactionReceipt from './TransactionReceipt';

interface StatementProps {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

function Statement({ onNavigate, onBack }: StatementProps) {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPeriod, setFilterPeriod] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [transactions, setTransactions] = useState<Transaction[]>(user?.transactions || []);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Função para buscar extrato
    const fetchStatement = async (showLoading = true) => {
        if (!user?.cpf) return;
        if (showLoading) setIsLoading(true);
        try {
            const result = await getUserStatement(user.cpf);
            if (result.success && result.transactions) {
                setTransactions(result.transactions);
            } else {
                if (user.transactions && user.transactions.length > 0) {
                    setTransactions(user.transactions);
                }
            }
        } catch (error) {
            if (user.transactions && user.transactions.length > 0) {
                setTransactions(user.transactions);
            }
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatement();
    }, [user?.cpf]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchStatement(false);
        setTimeout(() => {
            setIsRefreshing(false);
        }, 500);
    };

    if (!user) return null;

    // Categorias de filtro
    const categories = [
        { id: 'all', label: 'Todos', icon: '' },
        { id: 'food', label: 'Refeição', icon: 'restaurant' },
        { id: 'transport', label: 'Mobilidade', icon: 'directions_car' },
        { id: 'shopping', label: 'Compras', icon: 'shopping_cart' },
        { id: 'pix', label: 'PIX', icon: 'currency_exchange' },
        { id: 'deposit', label: 'Depósitos', icon: 'savings' },
        { id: 'payment', label: 'Pagamentos', icon: 'receipt_long' },
    ];

    // Determinar categoria da transação
    const getTxCategory = (tx: Transaction): string => {
        if ((tx as any).category) return (tx as any).category;
        if (tx.type === 'PIX_SENT' || tx.type === 'PIX_RECEIVED' || tx.type === 'PIX_CREDIT_SENT') return 'pix';
        if (tx.type === 'DEPOSIT') return 'deposit';
        if (tx.type === 'PAYMENT' || tx.type === 'INVOICE_PAYMENT') return 'payment';
        if (tx.type === 'SHOP_DEBIT' || tx.type === 'SHOP_CREDIT' || tx.type === 'INVOICE_INSTALLMENT') return 'shopping';
        return 'other';
    };

    // Label do tipo de transação
    const getTypeLabel = (type: Transaction['type']): string => {
        switch (type) {
            case 'PIX_SENT': return 'PIX Enviado';
            case 'PIX_RECEIVED': return 'PIX Recebido';
            case 'PIX_CREDIT_SENT': return 'PIX Parcelado';
            case 'DEPOSIT': return 'Depósito';
            case 'PAYMENT': return 'Pagamento';
            case 'SHOP_DEBIT': return 'Compra';
            case 'SHOP_CREDIT': return 'Compra no Crédito';
            case 'INVOICE_INSTALLMENT': return 'Compra Parcelada';
            case 'INVOICE_PAYMENT': return 'Pagamento de Fatura';
            case 'CASHBACK_CREDIT': return 'Cashback';
            case 'POINTS_EARNED': return 'Pontos';
            default: return 'Transação';
        }
    };

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
            case 'SHOP_DEBIT':
            case 'SHOP_CREDIT': return 'shopping_cart';
            case 'CASHBACK_CREDIT': return 'redeem';
            case 'POINTS_EARNED': return 'star';
            case 'INVOICE_INSTALLMENT': return 'event_repeat';
            default: return 'receipt_long';
        }
    };

    // Filtrar transações
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
        .filter(tx => {
            if (categoryFilter !== 'all') {
                return getTxCategory(tx) === categoryFilter;
            }
            return true;
        })
        .filter(tx =>
            tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.amount.toString().includes(searchTerm) ||
            (tx.recipientName && tx.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (tx.senderName && tx.senderName.toLowerCase().includes(searchTerm.toLowerCase()))
        );

    // Agrupar por data
    const groupedTransactions = filteredTransactions.reduce((groups, tx) => {
        const date = new Date(tx.date);
        const dateKey = date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const capitalizedKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);
        if (!groups[capitalizedKey]) {
            groups[capitalizedKey] = [];
        }
        groups[capitalizedKey].push(tx);
        return groups;
    }, {} as Record<string, Transaction[]>);

    // Ordenar datas (mais recente primeiro)
    const sortedDateKeys = Object.keys(groupedTransactions).sort((a, b) => {
        const dateA = groupedTransactions[a][0]?.date;
        const dateB = groupedTransactions[b][0]?.date;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    if (selectedTransaction) {
        return <TransactionReceipt transaction={selectedTransaction} onBack={() => setSelectedTransaction(null)} />;
    }

    return (
        <div className="bg-background-dark text-white min-h-screen flex flex-col" id="statement-page" data-testid="statement-page" aria-label="Extrato">
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-subtle-dark/50 pt-[calc(1rem+env(safe-area-inset-top))] shadow-md" id="statement-header" data-testid="statement-header" aria-label="Cabeçalho do extrato">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10" id="statement-back" data-testid="statement-back" aria-label="Voltar">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-xl font-bold text-white">Extrato da Conta</h1>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`p-2 rounded-full hover:bg-white/10 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                >
                    <span className="material-symbols-outlined">refresh</span>
                </button>
            </header>

            <main
                className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto no-scrollbar"
                onTouchStart={(e) => {
                    const startY = e.touches[0].clientY;
                    const scrollTop = e.currentTarget.scrollTop;
                    if (scrollTop === 0) {
                        e.currentTarget.setAttribute('data-pull-start', startY.toString());
                    }
                }}
                onTouchMove={(e) => {
                    const startY = parseFloat(e.currentTarget.getAttribute('data-pull-start') || '0');
                    const currentY = e.touches[0].clientY;
                    const scrollTop = e.currentTarget.scrollTop;
                    if (scrollTop === 0 && startY > 0 && (currentY - startY) > 80 && !isRefreshing) {
                        e.currentTarget.removeAttribute('data-pull-start');
                        handleRefresh();
                    }
                }}
                onTouchEnd={(e) => {
                    e.currentTarget.removeAttribute('data-pull-start');
                }}
            >
                {/* Saldo */}
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <p className="text-white/70 text-base font-normal leading-normal">Saldo atual</p>
                        <button className="text-white/70 hover:text-white">
                            <span className="material-symbols-outlined">visibility</span>
                        </button>
                    </div>
                    <p className="text-white text-4xl font-bold mt-2">{user.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>

                {/* Filtros de categoria */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCategoryFilter(cat.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${categoryFilter === cat.id
                                    ? 'bg-primary text-black font-semibold'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            {cat.icon && <span className="material-symbols-outlined text-sm">{cat.icon}</span>}
                            <span className="text-sm">{cat.label}</span>
                        </button>
                    ))}
                </div>

                {/* Busca e filtros de período */}
                <div className="space-y-4">
                    <h2 className="text-white/90 text-lg font-semibold">Transações</h2>
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
                        <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar md:justify-end">
                            <button onClick={() => setFilterPeriod('all')} className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg px-4 ${filterPeriod === 'all' ? 'bg-primary/20' : 'bg-primary/10 hover:bg-primary/20'}`}>
                                <p className="text-white text-sm font-medium leading-normal">Tudo</p>
                            </button>
                            <button onClick={() => setFilterPeriod('7d')} className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg px-4 ${filterPeriod === '7d' ? 'bg-primary/20' : 'bg-primary/10 hover:bg-primary/20'}`}>
                                <p className="text-white text-sm font-medium leading-normal">7 dias</p>
                            </button>
                            <button onClick={() => setFilterPeriod('30d')} className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg px-4 ${filterPeriod === '30d' ? 'bg-primary/20' : 'bg-primary/10 hover:bg-primary/20'}`}>
                                <p className="text-white text-sm font-medium leading-normal">30 dias</p>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Lista de transações agrupadas por data */}
                <div className="flex flex-col gap-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <p className="text-white/60">Carregando transações...</p>
                        </div>
                    ) : sortedDateKeys.length === 0 ? (
                        <div className="flex items-center justify-center p-8">
                            <p className="text-white/60">Nenhuma transação encontrada</p>
                        </div>
                    ) : (
                                sortedDateKeys.map(dateKey => (
                                    <div key={dateKey} className="space-y-3">
                                        <h3 className="text-white/70 text-sm font-medium px-2">{dateKey}</h3>
                                        <div className="flex flex-col gap-2">
                                            {groupedTransactions[dateKey].map((tx) => {
                                                const time = new Date(tx.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                                const typeLabel = getTypeLabel(tx.type);
                                                return (
                                                    <button
                                                        key={tx.id}
                                                        onClick={() => setSelectedTransaction(tx)}
                                                        className="w-full flex items-center gap-4 hover:bg-white/5 rounded-lg p-4 transition-colors duration-200 text-left cursor-pointer"
                                                    >
                                                        <div className="text-white flex items-center justify-center rounded-full bg-primary/10 shrink-0 size-10">
                                                            <span className="material-symbols-outlined text-primary">{getIconForType(tx.type, (tx as any).category)}</span>
                                                        </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white/50 text-xs mb-0.5">{time} • {typeLabel}</p>
                                                    <p className="text-white text-base font-medium leading-normal truncate">{tx.description}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-base font-semibold ${tx.amount < 0 ? 'text-orange-400' : 'text-primary'}`}>
                                                        {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default Statement;