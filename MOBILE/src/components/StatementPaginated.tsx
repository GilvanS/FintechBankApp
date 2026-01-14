import React, { useState, useEffect } from 'react';
import { Transaction, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { getUserStatementPaginated } from '../services/api';
import TransactionReceipt from './TransactionReceipt';

interface StatementPaginatedProps {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

type TabType = 'purchases' | 'pix' | 'transfers' | 'payments';

function StatementPaginated({ onNavigate, onBack }: StatementPaginatedProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('purchases');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
    });

    const limit = 10;

    // Função para buscar extrato paginado
    const fetchStatement = React.useCallback(async (page: number, type?: TabType) => {
        if (!user?.cpf) return;
        setIsLoading(true);
        try {
            const result = await getUserStatementPaginated(user.cpf, page, limit, type);
            if (result.success && result.transactions) {
                setTransactions(result.transactions);
                if (result.pagination) {
                    setPagination(result.pagination);
                }
            } else {
                setTransactions([]);
            }
        } catch (error) {
            console.error('Erro ao buscar extrato:', error);
            setTransactions([]);
        } finally {
            setIsLoading(false);
        }
    }, [user?.cpf, limit]);

    // Carregar dados quando mudar a aba
    useEffect(() => {
        setCurrentPage(1);
        fetchStatement(1, activeTab);
    }, [activeTab, fetchStatement]);

    // Carregar dados quando mudar a página
    useEffect(() => {
        fetchStatement(currentPage, activeTab);
    }, [currentPage, activeTab, fetchStatement]);

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setCurrentPage(1);
    };

    const handlePrevPage = () => {
        if (pagination.hasPrev) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (pagination.hasNext) {
            setCurrentPage(currentPage + 1);
        }
    };

    const getIconForType = (type: Transaction['type']) => {
        switch (type) {
            case 'PIX_SENT':
            case 'PIX_RECEIVED':
            case 'PIX_CREDIT_SENT': return 'currency_exchange';
            case 'PAYMENT': return 'receipt_long';
            case 'DEPOSIT': return 'savings';
            case 'SHOP_DEBIT':
            case 'SHOP_CREDIT':
            case 'CREDIT': return 'shopping_cart';
            case 'INVOICE_INSTALLMENT': return 'event_repeat';
            case 'CASHBACK_CREDIT': return 'redeem';
            case 'INVOICE_PAYMENT':
            case 'INVOICE_ANTICIPATION': return 'credit_card';
            default: return 'receipt_long';
        }
    };

    const getTypeLabel = (type: Transaction['type']): string => {
        switch (type) {
            case 'PIX_SENT': return 'PIX Enviado';
            case 'PIX_RECEIVED': return 'PIX Recebido';
            case 'PIX_CREDIT_SENT': return 'PIX Parcelado';
            case 'DEPOSIT': return 'Depósito';
            case 'PAYMENT': return 'Pagamento';
            case 'SHOP_DEBIT': return 'Compra';
            case 'SHOP_CREDIT': return 'Compra no Crédito';
            case 'CREDIT': return 'Compra no Crédito';
            case 'INVOICE_INSTALLMENT': return 'Compra Parcelada';
            case 'INVOICE_PAYMENT': return 'Pagamento de Fatura';
            case 'INVOICE_ANTICIPATION': return 'Antecipação de Parcelas';
            case 'CASHBACK_CREDIT': return 'Cashback';
            default: return 'Transação';
        }
    };

    if (!user) return null;

    if (selectedTransaction) {
        return <TransactionReceipt transaction={selectedTransaction} onBack={() => setSelectedTransaction(null)} />;
    }

    return (
        <div className="bg-background-dark text-white min-h-screen flex flex-col">
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-subtle-dark/50 pt-[calc(1rem+env(safe-area-inset-top))] shadow-md">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-xl font-bold text-white">Extrato da Conta</h1>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto no-scrollbar">
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

                {/* Abas de filtro */}
                <div className="flex gap-2 border-b border-subtle-dark/50 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => handleTabChange('purchases')}
                        className={`flex-shrink-0 py-3 px-4 text-center font-semibold transition-colors whitespace-nowrap ${
                            activeTab === 'purchases'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        Compras
                    </button>
                    <button
                        onClick={() => handleTabChange('pix')}
                        className={`flex-shrink-0 py-3 px-4 text-center font-semibold transition-colors whitespace-nowrap ${
                            activeTab === 'pix'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        PIX
                    </button>
                    <button
                        onClick={() => handleTabChange('transfers')}
                        className={`flex-shrink-0 py-3 px-4 text-center font-semibold transition-colors whitespace-nowrap ${
                            activeTab === 'transfers'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        Transferências
                    </button>
                    <button
                        onClick={() => handleTabChange('payments')}
                        className={`flex-shrink-0 py-3 px-4 text-center font-semibold transition-colors whitespace-nowrap ${
                            activeTab === 'payments'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        Pagamentos
                    </button>
                </div>

                {/* Lista de transações */}
                <div className="flex flex-col gap-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <p className="text-white/60">Carregando transações...</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="flex items-center justify-center p-8">
                            <p className="text-white/60">Nenhuma transação encontrada</p>
                        </div>
                    ) : (
                        transactions.map((tx) => {
                            const time = new Date(tx.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            const date = new Date(tx.date).toLocaleDateString('pt-BR');
                            const typeLabel = getTypeLabel(tx.type);
                            return (
                                <button
                                    key={tx.id}
                                    onClick={() => setSelectedTransaction(tx)}
                                    className="w-full flex items-center gap-4 hover:bg-white/5 rounded-lg p-4 transition-colors duration-200 text-left cursor-pointer"
                                >
                                    <div className="text-white flex items-center justify-center rounded-full bg-primary/10 shrink-0 size-10">
                                        <span className="material-symbols-outlined text-primary">{getIconForType(tx.type)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white/50 text-xs mb-0.5">{date} • {time} • {typeLabel}</p>
                                        <p className="text-white text-base font-medium leading-normal truncate">{tx.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-base font-semibold ${tx.amount < 0 ? 'text-orange-400' : 'text-primary'}`}>
                                            {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Paginação */}
                {!isLoading && transactions.length > 0 && (
                    <div className="flex items-center justify-between pt-4 border-t border-subtle-dark/50">
                        <button
                            onClick={handlePrevPage}
                            disabled={!pagination.hasPrev}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                pagination.hasPrev
                                    ? 'bg-primary/20 text-white hover:bg-primary/30'
                                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                            }`}
                        >
                            Anterior
                        </button>
                        <div className="text-white/70 text-sm">
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} itens)
                        </div>
                        <button
                            onClick={handleNextPage}
                            disabled={!pagination.hasNext}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                pagination.hasNext
                                    ? 'bg-primary/20 text-white hover:bg-primary/30'
                                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                            }`}
                        >
                            Próxima
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

export default StatementPaginated;
