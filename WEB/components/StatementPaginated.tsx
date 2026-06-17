import React, { useState, useEffect } from 'react';
import { Transaction, User } from '../types';
import { getUserStatementPaginated } from '../services/api';
import TransactionReceipt from './TransactionReceipt';

interface StatementPaginatedProps {
    user: User;
    onNavigate: (view: string) => void;
    onBack: () => void;
}

type TabType = 'purchases' | 'pix' | 'transfers' | 'payments';

function StatementPaginated({ user, onNavigate, onBack }: StatementPaginatedProps) {
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
        <main
            className="flex-1 p-4 md:p-6 lg:p-8 space-y-8 test-statement-paginated"
            id="statement-paginated"
            data-testid="statement-paginated"
            data-cy="statement-paginated"
            data-playwright="statement-paginated"
            role="main"
        >
            <header className="flex items-center">
                <button
                    onClick={onBack}
                    className="mr-4 text-white test-statement-paginated-back-button"
                    id="btn-statement-paginated-back"
                    name="statement-paginated-back"
                    data-testid="statement-paginated-back-button"
                    data-cy="statement-paginated-back-button"
                    data-playwright="statement-paginated-back-button"
                    aria-label="Voltar"
                    type="button"
                >
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                </button>
                <h1
                    className="text-white text-4xl font-black leading-tight tracking-[-0.033em] test-statement-paginated-title"
                    id="statement-paginated-title"
                    data-testid="statement-paginated-title"
                >Extrato da Conta</h1>
            </header>

            {/* Saldo */}
            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <p className="text-white/70 text-base font-normal leading-normal">Saldo atual</p>
                    <button className="text-white/70 hover:text-white" type="button" aria-label="Mostrar saldo">
                        <span className="material-symbols-outlined" aria-hidden="true">visibility</span>
                    </button>
                </div>
                <p
                    className="text-white text-4xl font-bold mt-2 test-statement-paginated-balance"
                    id="statement-paginated-balance"
                    data-testid="statement-paginated-balance"
                    data-cy="statement-paginated-balance"
                    data-playwright="statement-paginated-balance"
                >{user.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>

            {/* Abas de filtro */}
            <div
                className="flex gap-2 border-b border-subtle-dark/50 overflow-x-auto no-scrollbar test-statement-paginated-tabs"
                id="statement-paginated-tabs"
                data-testid="statement-paginated-tabs"
                role="tablist"
                aria-label="Filtros de transações"
            >
                <button
                    onClick={() => handleTabChange('purchases')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-semibold transition-colors whitespace-nowrap test-tab-purchases ${
                        activeTab === 'purchases'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-white/60 hover:text-white'
                    }`}
                    id="tab-purchases"
                    data-testid="tab-purchases"
                    data-cy="tab-purchases"
                    data-playwright="tab-purchases"
                    role="tab"
                    aria-selected={activeTab === 'purchases'}
                    type="button"
                >
                    Compras
                </button>
                <button
                    onClick={() => handleTabChange('pix')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-semibold transition-colors whitespace-nowrap test-tab-pix ${
                        activeTab === 'pix'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-white/60 hover:text-white'
                    }`}
                    id="tab-pix"
                    data-testid="tab-pix"
                    data-cy="tab-pix"
                    data-playwright="tab-pix"
                    role="tab"
                    aria-selected={activeTab === 'pix'}
                    type="button"
                >
                    PIX
                </button>
                <button
                    onClick={() => handleTabChange('transfers')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-semibold transition-colors whitespace-nowrap test-tab-transfers ${
                        activeTab === 'transfers'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-white/60 hover:text-white'
                    }`}
                    id="tab-transfers"
                    data-testid="tab-transfers"
                    data-cy="tab-transfers"
                    data-playwright="tab-transfers"
                    role="tab"
                    aria-selected={activeTab === 'transfers'}
                    type="button"
                >
                    Transferências
                </button>
                <button
                    onClick={() => handleTabChange('payments')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-semibold transition-colors whitespace-nowrap test-tab-payments ${
                        activeTab === 'payments'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-white/60 hover:text-white'
                    }`}
                    id="tab-payments"
                    data-testid="tab-payments"
                    data-cy="tab-payments"
                    data-playwright="tab-payments"
                    role="tab"
                    aria-selected={activeTab === 'payments'}
                    type="button"
                >
                    Pagamentos
                </button>
            </div>

            {/* Lista de transações */}
            <div className="space-y-4">
                <h2 className="text-white/90 text-lg font-semibold px-4">Transações</h2>
                <div
                    className="flex flex-col gap-2 test-statement-paginated-list"
                    id="statement-paginated-list"
                    data-testid="statement-paginated-list"
                    data-cy="statement-paginated-list"
                    data-playwright="statement-paginated-list"
                    role="list"
                >
                    {isLoading ? (
                        <div
                            className="flex items-center justify-center p-8 test-statement-paginated-loading"
                            id="statement-paginated-loading"
                            data-testid="statement-paginated-loading"
                            role="status"
                            aria-live="polite"
                        >
                            <p className="text-white/60">Carregando transações...</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div
                            className="flex items-center justify-center p-8 test-statement-paginated-empty"
                            id="statement-paginated-empty"
                            data-testid="statement-paginated-empty"
                            role="status"
                            aria-live="polite"
                        >
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
                                    className="w-full flex items-center gap-4 hover:bg-white/5 rounded-lg p-4 transition-colors duration-200 text-left cursor-pointer test-statement-paginated-item"
                                    data-testid="statement-paginated-item"
                                    data-cy="statement-paginated-item"
                                    data-playwright="statement-paginated-item"
                                    data-transaction-id={tx.id}
                                    data-transaction-type={tx.type}
                                    aria-label={`Transação: ${tx.description}`}
                                    type="button"
                                    role="listitem"
                                >
                                    <div className="text-white flex items-center justify-center rounded-full bg-primary/10 shrink-0 size-10">
                                        <span className="material-symbols-outlined text-primary" aria-hidden="true">{getIconForType(tx.type)}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white/50 text-xs mb-0.5 test-statement-paginated-item-date" data-testid="statement-paginated-item-date">{date} • {time} • {typeLabel}</p>
                                        <p className="text-white text-base font-medium leading-normal test-statement-paginated-item-description" data-testid="statement-paginated-item-description">{tx.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <p
                                            className={`text-base font-semibold test-statement-paginated-item-amount ${tx.amount < 0 ? 'text-orange-400' : 'text-primary'}`}
                                            data-testid="statement-paginated-item-amount"
                                        >
                                            {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Paginação */}
            {!isLoading && transactions.length > 0 && (
                <div
                    className="flex items-center justify-between pt-4 border-t border-subtle-dark/50 test-statement-pagination"
                    id="statement-pagination"
                    data-testid="statement-pagination"
                    role="navigation"
                    aria-label="Paginação do extrato"
                >
                    <button
                        onClick={handlePrevPage}
                        disabled={!pagination.hasPrev}
                        className={`px-6 py-3 rounded-lg font-medium transition-colors test-prev-page ${
                            pagination.hasPrev
                                ? 'bg-primary/20 text-white hover:bg-primary/30'
                                : 'bg-white/5 text-white/30 cursor-not-allowed'
                        }`}
                        id="btn-prev-page"
                        name="prev-page"
                        data-testid="btn-prev-page"
                        data-cy="btn-prev-page"
                        data-playwright="btn-prev-page"
                        aria-label="Página anterior"
                        type="button"
                    >
                        Anterior
                    </button>
                    <div
                        className="text-white/70 text-sm test-pagination-info"
                        id="statement-pagination-info"
                        data-testid="statement-pagination-info"
                        data-current-page={pagination.page}
                        data-total-pages={pagination.totalPages}
                        data-total-items={pagination.total}
                        aria-live="polite"
                    >
                        Página {pagination.page} de {pagination.totalPages} ({pagination.total} itens)
                    </div>
                    <button
                        onClick={handleNextPage}
                        disabled={!pagination.hasNext}
                        className={`px-6 py-3 rounded-lg font-medium transition-colors test-next-page ${
                            pagination.hasNext
                                ? 'bg-primary/20 text-white hover:bg-primary/30'
                                : 'bg-white/5 text-white/30 cursor-not-allowed'
                        }`}
                        id="btn-next-page"
                        name="next-page"
                        data-testid="btn-next-page"
                        data-cy="btn-next-page"
                        data-playwright="btn-next-page"
                        aria-label="Próxima página"
                        type="button"
                    >
                        Próxima
                    </button>
                </div>
            )}
        </main>
    );
}

export default StatementPaginated;
