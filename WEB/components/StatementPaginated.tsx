import React, { useState, useEffect } from 'react';
import { Transaction, User } from '../types';
import { getUserStatementPaginated } from '../services/api';
import TransactionReceipt from './TransactionReceipt';
import { formatDateBR, formatTimeBR } from '../utils/formatters';
import { useAppState } from '../contexts/AppStateContext';
import D3Heatmap from './charts/D3Heatmap';

interface StatementPaginatedProps {
    user: User;
    onNavigate: (view: string) => void;
    onBack: () => void;
}

type TabType = 'all' | 'purchases' | 'pix' | 'transfers' | 'payments';

function StatementPaginated({ user, onNavigate, onBack }: StatementPaginatedProps) {
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    // Classes derivadas do tema (Yellow = claro neo-brutal, Midnight = original)
    const textCls = isMidnight ? 'text-white' : 'text-black';
    const mutedCls = isMidnight ? 'text-white/60' : 'text-black/60';
    const cardCls = isMidnight ? 'bg-volt-surface border border-white/10' : 'bg-white border-2 border-black';
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
            className={`flex-1 p-4 md:p-6 space-y-6 w-full test-statement-paginated ${isMidnight ? 'bg-[#0a0a0a] text-white' : 'bg-volt-yellow text-black'}`}
            id="statement-paginated"
            data-testid="statement-paginated"
            data-cy="statement-paginated"
            data-playwright="statement-paginated"
            role="main"
        >

            {/* Saldo */}
            <div className={`rounded-2xl p-5 ${cardCls} ${isMidnight ? '' : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}>
                <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold uppercase tracking-widest ${mutedCls}`}>Saldo atual</p>
                </div>
                <p
                    className={`text-4xl font-black mt-1 test-statement-paginated-balance ${textCls}`}
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    id="statement-paginated-balance"
                    data-testid="statement-paginated-balance"
                    data-cy="statement-paginated-balance"
                    data-playwright="statement-paginated-balance"
                >{user.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>

            {/* Filtros por categoria — estilo volt */}
            <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2"
                id="statement-paginated-tabs"
                data-testid="statement-paginated-tabs"
            >
                {([
                    { key: 'all',       label: 'Todos'          },
                    { key: 'purchases', label: 'Compras'        },
                    { key: 'pix',       label: 'PIX'            },
                    { key: 'transfers', label: 'Transferências' },
                    { key: 'payments',  label: 'Pagamentos'     },
                ] as const).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                            activeTab === tab.key
                                ? (isMidnight
                                    ? 'bg-white/10 text-volt-primary border-white/10'
                                    : 'bg-black text-volt-lime border-black')
                                : (isMidnight
                                    ? 'bg-transparent text-white/50 border-white/5 hover:bg-volt-surface hover:text-white'
                                    : 'bg-white/60 text-black/60 border-black/20 hover:bg-white hover:text-black')
                        } test-statement-tab-${tab.key}`}
                        id={`tab-${tab.key}`}
                        data-testid={`tab-${tab.key}`}
                        data-cy={`tab-${tab.key}`}
                        data-playwright={`tab-${tab.key}`}
                        role="tab" aria-selected={activeTab === tab.key} type="button">
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Buscador */}
            <div className="relative">
                <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 ${isMidnight ? 'text-white/40' : 'text-black/40'}`}>search</span>
                <input
                    type="text"
                    placeholder="Buscar transação..."
                    className={`w-full rounded-xl py-3 pl-12 pr-4 focus:outline-none transition-colors ${isMidnight ? 'bg-volt-surface border border-white/10 text-white placeholder-white/40 focus:border-volt-primary' : 'bg-white border-2 border-black text-black placeholder-black/40 focus:border-black'}`}
                    id="statement-search-input"
                    data-testid="statement-search-input"
                />
            </div>

            {/* Lista de transações */}
            <div className="space-y-4">
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
                            <p className={`font-semibold ${mutedCls}`}>Carregando transações...</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div
                            className="flex items-center justify-center p-8 test-statement-paginated-empty"
                            id="statement-paginated-empty"
                            data-testid="statement-paginated-empty"
                            role="status"
                            aria-live="polite"
                        >
                            <p className={`font-semibold ${mutedCls}`}>Nenhuma transação encontrada</p>
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
                                    className={`w-full flex items-center gap-4 bg-transparent border-b p-4 mb-2 transition-all duration-200 text-left cursor-pointer active:scale-[0.99] test-statement-paginated-item ${isMidnight ? 'border-white/5 hover:bg-volt-surface' : 'border-black/10 hover:bg-white/70'}`}
                                    data-testid="statement-paginated-item"
                                    data-cy="statement-paginated-item"
                                    data-playwright="statement-paginated-item"
                                    data-transaction-id={tx.id}
                                    data-transaction-type={tx.type}
                                    aria-label={`Transação: ${tx.description}`}
                                    type="button"
                                    role="listitem"
                                >
                                    <div className={`flex items-center justify-center rounded-full shrink-0 size-10 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] ${isMidnight ? 'bg-volt-surface border border-white/10' : 'bg-white border-2 border-black'}`}>
                                        <span className="material-symbols-outlined text-volt-primary" aria-hidden="true" style={{ fontSize: '18px' }}>{getIconForType(tx.type)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs mb-0.5 font-semibold test-statement-paginated-item-date ${isMidnight ? 'text-white/50' : 'text-black/50'}`} data-testid="statement-paginated-item-date">{date} • {time} • {typeLabel}</p>
                                        <p className={`text-sm font-black leading-normal truncate test-statement-paginated-item-description ${textCls}`} data-testid="statement-paginated-item-description">{tx.description}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p
                                            className={`text-base font-black test-statement-paginated-item-amount ${tx.amount < 0 ? (isMidnight ? 'text-red-500' : 'text-red-600') : (isMidnight ? 'text-green-500' : 'text-green-700')}`}
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
                    className={`flex items-center justify-between pt-4 border-t test-statement-pagination ${isMidnight ? 'border-subtle-dark/50' : 'border-black/15'}`}
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
                                ? (isMidnight
                                    ? 'bg-primary/20 text-white hover:bg-primary/30'
                                    : 'bg-black text-white hover:bg-black/80')
                                : (isMidnight
                                    ? 'bg-volt-surface text-white/30 cursor-not-allowed'
                                    : 'bg-black/10 text-black/30 cursor-not-allowed')
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
                        className={`text-sm test-pagination-info ${isMidnight ? 'text-white/70' : 'text-black/70'}`}
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
                                ? (isMidnight
                                    ? 'bg-primary/20 text-white hover:bg-primary/30'
                                    : 'bg-black text-white hover:bg-black/80')
                                : (isMidnight
                                    ? 'bg-volt-surface text-white/30 cursor-not-allowed'
                                    : 'bg-black/10 text-black/30 cursor-not-allowed')
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
