import React, { useState, useEffect } from 'react';
import { Transaction, User } from '../types';
import { getUserStatementPaginated } from '../services/api';
import TransactionReceipt from './TransactionReceipt';
import { formatDateBR, formatTimeBR } from '../utils/formatters';

interface StatementPaginatedProps {
    user: User;
    onNavigate: (view: string) => void;
    onBack: () => void;
}

type TabType = 'all' | 'purchases' | 'pix' | 'transfers' | 'payments';

function StatementPaginated({ user, onNavigate, onBack }: StatementPaginatedProps) {
    const [activeTab, setActiveTab] = useState<TabType>('all');
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
            const result = await getUserStatementPaginated(user.cpf, page, limit, type === 'all' ? undefined : type);
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

    const getIconForType = (type: string) => {
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

    const getTypeLabel = (type: string): string => {
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
            className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-volt-yellow test-statement-paginated"
            id="statement-paginated"
            data-testid="statement-paginated"
            data-cy="statement-paginated"
            data-playwright="statement-paginated"
            role="main"
        >
            <header className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-volt-yellow border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:opacity-80 transition-opacity test-statement-paginated-back-button"
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
                    className="text-black text-3xl font-black leading-tight test-statement-paginated-title"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    id="statement-paginated-title"
                    data-testid="statement-paginated-title"
                >Extrato da Conta</h1>
            </header>

            {/* Saldo */}
            <div className="volt-card p-5">
                <div className="flex items-center justify-between">
                    <p className="text-black/60 text-xs font-bold uppercase tracking-widest">Saldo atual</p>
                </div>
                <p
                    className="text-black text-4xl font-black mt-1 test-statement-paginated-balance"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    id="statement-paginated-balance"
                    data-testid="statement-paginated-balance"
                    data-cy="statement-paginated-balance"
                    data-playwright="statement-paginated-balance"
                >{user.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>

            {/* Filtros por categoria — estilo volt */}
            <div
                className="flex gap-2 overflow-x-auto no-scrollbar test-statement-paginated-tabs"
                id="statement-paginated-tabs"
                data-testid="statement-paginated-tabs"
                role="tablist"
                aria-label="Filtros de transações"
            >
                {([
                    { key: 'all',       label: 'Todos'          },
                    { key: 'purchases', label: 'Compras'        },
                    { key: 'pix',       label: 'PIX'            },
                    { key: 'transfers', label: 'Transferências' },
                    { key: 'payments',  label: 'Pagamentos'     },
                ] as const).map(tab => (
                    <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                        className={`flex-shrink-0 py-2 px-4 font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap rounded-full border-2 border-black test-tab-${tab.key} ${
                            activeTab === tab.key
                                ? 'bg-black text-volt-yellow shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-volt-cream text-black hover:bg-volt-yellow'
                        }`}
                        id={`tab-${tab.key}`}
                        data-testid={`tab-${tab.key}`}
                        data-cy={`tab-${tab.key}`}
                        data-playwright={`tab-${tab.key}`}
                        role="tab" aria-selected={activeTab === tab.key} type="button">
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Lista de transações */}
            <div className="space-y-4">
                <h2 className="text-black text-xs font-black uppercase tracking-widest px-1">Transações</h2>
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
                            <p className="text-black/60 font-semibold">Carregando transações...</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div
                            className="flex items-center justify-center p-8 test-statement-paginated-empty"
                            id="statement-paginated-empty"
                            data-testid="statement-paginated-empty"
                            role="status"
                            aria-live="polite"
                        >
                            <p className="text-black/60 font-semibold">Nenhuma transação encontrada</p>
                        </div>
                    ) : (
                        transactions.map((tx) => {
                            const time = formatTimeBR(tx.date);
                            const date = formatDateBR(tx.date);
                            const typeLabel = getTypeLabel(tx.type);
                            return (
                                <button
                                    key={tx.id}
                                    onClick={() => setSelectedTransaction(tx)}
                                    className="w-full flex items-center gap-4 volt-card p-4 mb-2 transition-all duration-200 text-left cursor-pointer hover:bg-volt-cream active:scale-[0.99] test-statement-paginated-item"
                                    data-testid="statement-paginated-item"
                                    data-cy="statement-paginated-item"
                                    data-playwright="statement-paginated-item"
                                    data-transaction-id={tx.id}
                                    data-transaction-type={tx.type}
                                    aria-label={`Transação: ${tx.description}`}
                                    type="button"
                                    role="listitem"
                                >
                                    <div className="flex items-center justify-center rounded-full bg-black shrink-0 size-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                        <span className="material-symbols-outlined text-volt-yellow" aria-hidden="true" style={{ fontSize: '18px' }}>{getIconForType(tx.type)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-black/50 text-xs mb-0.5 font-semibold test-statement-paginated-item-date" data-testid="statement-paginated-item-date">{date} • {time} • {typeLabel}</p>
                                        <p className="text-black text-sm font-black leading-normal truncate test-statement-paginated-item-description" data-testid="statement-paginated-item-description">{tx.description}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p
                                            className={`text-base font-black test-statement-paginated-item-amount ${tx.amount < 0 ? 'text-red-600' : 'text-green-700'}`}
                                            data-testid="statement-paginated-item-amount"
                                            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
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
