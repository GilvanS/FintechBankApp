import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { View, Transaction } from '../types';
import TransactionReceipt from './TransactionReceipt';

interface CardDashboardProps {
    onBack: () => void;
    onNavigate: (view: View) => void;
}

const CardDashboard: React.FC<CardDashboardProps> = ({ onBack, onNavigate }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'current' | 'future'>('current');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    if (!user || !user.creditCard) {
        return (
            <div className="bg-background-dark text-white min-h-screen flex flex-col">
                <header className="flex items-center p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 className="text-xl font-bold text-white mx-auto">Meu Cartão</h2>
                    <div className="w-6"></div>
                </header>
                <main className="flex-grow flex items-center justify-center">
                    <p>Informações do cartão indisponíveis.</p>
                </main>
            </div>
        );
    }

    const { creditCard } = user;

    // Uma fatura só está atrasada DEPOIS do fim do dia de vencimento
    // Se hoje for o dia de vencimento ou anterior, não está atrasada
    const isOverdue = creditCard.closedInvoice > 0 && creditCard.closedInvoiceDueDate && (() => {
        const dueDate = new Date(creditCard.closedInvoiceDueDate);
        // Definir fim do dia de vencimento (23:59:59.999)
        dueDate.setUTCHours(23, 59, 59, 999);
        const now = new Date();
        // Só está atrasada se a data atual for depois do fim do dia de vencimento
        return now > dueDate;
    })();

    const hasInvoiceDueDate = !!creditCard.invoiceDueDate && !isNaN(new Date(creditCard.invoiceDueDate).getTime());
    const invoiceDueDate = hasInvoiceDueDate ? new Date(creditCard.invoiceDueDate) : null;
    const endOfDay = invoiceDueDate ? new Date(invoiceDueDate) : null;
    if (endOfDay) endOfDay.setHours(23, 59, 59, 999);

    const currentTransactions = hasInvoiceDueDate
        ? creditCard.transactions.filter(tx => new Date(tx.date) <= (endOfDay as Date))
        : creditCard.transactions;
    const futureTransactions = hasInvoiceDueDate
        ? creditCard.transactions.filter(tx => new Date(tx.date) > (endOfDay as Date))
        : [];

    const transactionsToDisplay = activeTab === 'current' ? currentTransactions : futureTransactions;

    const vencimentoLabel = hasInvoiceDueDate
        ? new Date(creditCard.invoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        : '--';

    const getIconForTx = (merchant: string) => {
        const lowerMerchant = merchant.toLowerCase();
        if (lowerMerchant.includes('supermercado')) return 'shopping_cart';
        if (lowerMerchant.includes('restaurante')) return 'restaurant';
        if (lowerMerchant.includes('loja')) return 'storefront';
        if (lowerMerchant.includes('pix')) return 'currency_exchange';
        if (lowerMerchant.includes('pagamento') || lowerMerchant.includes('antecipação') || lowerMerchant.includes('parcelamento')) return 'check_circle';
        return 'receipt_long';
    };

    if (selectedTransaction) {
        return (
            <TransactionReceipt
                transaction={selectedTransaction}
                onBack={() => setSelectedTransaction(null)}
            />
        );
    }

    return (
        <div 
            className="bg-background-dark text-white min-h-screen flex flex-col test-card-dashboard"
            id="card-dashboard"
            data-testid="card-dashboard"
            data-cy="card-dashboard"
            data-playwright="card-dashboard"
        >
            <header 
                className="flex-shrink-0 flex items-center justify-between p-4 border-b border-subtle-dark/50 pt-[calc(1rem+env(safe-area-inset-top))] shadow-md test-card-header"
                id="card-header"
                data-testid="card-header"
                data-cy="card-header"
            >
                 <button 
                    onClick={onBack} 
                    className="p-2 -ml-2 rounded-full hover:bg-white/10 test-card-back-button"
                    id="btn-card-back"
                    name="card-back-button"
                    data-testid="card-back-button"
                    data-cy="card-back-button"
                    data-playwright="card-back-button"
                    aria-label="Voltar"
                    type="button"
                >
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                </button>
                <h1 
                    className="text-xl font-bold text-white test-card-title"
                    id="card-title"
                    data-testid="card-title"
                    data-cy="card-title"
                    data-playwright="card-title"
                >
                    Meu Cartão
                </h1>
                <div className="w-6"></div>
            </header>
            <main 
                className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6 test-card-main"
                id="card-main"
                data-testid="card-main"
                data-cy="card-main"
            >
                 {creditCard.isBlocked && (
                    <div className="bg-red-800 border border-red-600 text-red-200 p-4 rounded-lg text-center animate-fade-in">
                        <h3 className="font-bold text-lg flex items-center justify-center gap-2"><span className="material-symbols-outlined">lock</span>Cartão Bloqueado</h3>
                        <p className="text-sm mt-1">Efetue o pagamento da fatura fechada para desbloquear.</p>
                    </div>
                )}
                {isOverdue && !creditCard.isBlocked && (
                    <div className="bg-orange-800 border border-orange-600 text-orange-200 p-4 rounded-lg text-center animate-fade-in">
                        <h3 className="font-bold text-lg flex items-center justify-center gap-2"><span className="material-symbols-outlined">warning</span>Fatura Atrasada</h3>
                        <p className="text-sm mt-1">Sua fatura fechada está vencida. Pague agora para evitar mais juros.</p>
                    </div>
                )}
                <button 
                    onClick={() => onNavigate('currentInvoice')} 
                    className="bg-surface-dark p-6 rounded-2xl shadow-lg space-y-4 bg-gradient-to-br from-primary/10 to-surface-dark w-full text-left hover:ring-2 hover:ring-primary/50 transition-all test-current-invoice-card"
                    id="btn-current-invoice"
                    name="current-invoice-button"
                    data-testid="card-current-invoice-button"
                    data-cy="card-current-invoice-button"
                    data-playwright="card-current-invoice-button"
                    aria-label="Ver fatura atual"
                    type="button"
                >
                    <div className="flex justify-between items-start">
                        <span className="font-bold text-lg test-current-invoice-label" data-testid="card-current-invoice-label">Fatura Atual</span>
                        <span className="font-mono text-sm bg-white/20 px-2 py-1 rounded test-current-invoice-due-date" id="current-invoice-due-date" data-testid="card-current-invoice-due-date">Venc. {vencimentoLabel}</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-400 test-current-invoice-value" id="current-invoice-value" data-testid="card-current-invoice-value" data-cy="card-current-invoice-value" data-playwright="card-current-invoice-value">{creditCard.currentInvoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <div className="text-sm test-current-invoice-limit">
                        <p>Limite Disponível: <span className="font-semibold text-primary test-available-limit-value" id="available-limit-value" data-testid="card-available-limit-value" data-cy="card-available-limit-value">{creditCard.availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                    </div>
                </button>

                <div className="grid grid-cols-2 gap-3 test-card-actions-grid" id="card-actions-grid" data-testid="card-actions-grid" data-cy="card-actions-grid">
                    <button 
                        onClick={() => onNavigate('closedInvoice')} 
                        className={`p-4 bg-surface-dark rounded-lg text-center hover:bg-white/10 transition-all test-closed-invoice-button ${(isOverdue || creditCard.isBlocked) ? 'border-2 border-red-500 animate-pulse' : ''}`}
                        id="btn-closed-invoice"
                        name="closed-invoice-button"
                        data-testid="card-closed-invoice-button"
                        data-cy="card-closed-invoice-button"
                        data-playwright="card-closed-invoice-button"
                        aria-label="Ver fatura fechada"
                        type="button"
                    >
                        <p className="font-semibold text-white test-closed-invoice-label" data-testid="card-closed-invoice-label">Fatura Fechada</p>
                        <p className={`font-bold test-closed-invoice-value ${(isOverdue || creditCard.isBlocked) ? 'text-red-400' : 'text-orange-400'}`} id="closed-invoice-value" data-testid="card-closed-invoice-value" data-cy="card-closed-invoice-value">{creditCard.closedInvoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </button>
                    <button 
                        onClick={() => onNavigate('anticipateInstallments')} 
                        className="p-4 bg-surface-dark rounded-lg text-center hover:bg-white/10 test-anticipate-button"
                        id="btn-anticipate"
                        name="anticipate-button"
                        data-testid="card-anticipate-button"
                        data-cy="card-anticipate-button"
                        data-playwright="card-anticipate-button"
                        aria-label="Antecipar parcelas"
                        type="button"
                    >
                        <p className="font-semibold text-white test-anticipate-label" data-testid="card-anticipate-label">Antecipar Parcelas</p>
                         <p className="text-xs text-gray-400 test-anticipate-subtitle" data-testid="card-anticipate-subtitle">Ganhe descontos</p>
                    </button>
                </div>

                <button 
                    onClick={() => onNavigate('points')} 
                    className="w-full flex items-center p-4 bg-surface-dark rounded-lg hover:bg-white/10 transition-colors text-left space-x-4 test-points-button"
                    id="btn-points"
                    name="points-button"
                    data-testid="card-points-button"
                    data-cy="card-points-button"
                    data-playwright="card-points-button"
                    aria-label="Ver pontos Fintech Cashback"
                    type="button"
                >
                    <span className="material-symbols-outlined text-2xl text-orange-400" aria-hidden="true">workspace_premium</span>
                    <div className="flex-grow">
                        <p className="font-bold text-white test-points-title" data-testid="card-points-title">Fintech Cashback</p>
                        <p className="text-sm text-gray-400 test-points-value" id="points-value" data-testid="card-points-value" data-cy="card-points-value">{creditCard.pointsBalance.toLocaleString('pt-BR')} pontos</p>
                    </div>
                    <span className="material-symbols-outlined text-gray-500" aria-hidden="true">chevron_right</span>
                </button>

                <div className="test-transactions-section" id="transactions-section" data-testid="card-transactions-section" data-cy="card-transactions-section">
                    <div className="flex border-b border-subtle-dark test-transactions-tabs" id="transactions-tabs" data-testid="card-transactions-tabs">
                        <button 
                            onClick={() => setActiveTab('current')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors test-tab-current ${activeTab === 'current' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
                            id="btn-tab-current"
                            name="tab-current"
                            data-testid="card-tab-current"
                            data-cy="card-tab-current"
                            data-playwright="card-tab-current"
                            aria-label="Fatura Atual"
                            aria-selected={activeTab === 'current'}
                            role="tab"
                            type="button"
                        >
                            Fatura Atual
                        </button>
                        <button 
                            onClick={() => setActiveTab('future')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors test-tab-future ${activeTab === 'future' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
                            id="btn-tab-future"
                            name="tab-future"
                            data-testid="card-tab-future"
                            data-cy="card-tab-future"
                            data-playwright="card-tab-future"
                            aria-label="Futuros"
                            aria-selected={activeTab === 'future'}
                            role="tab"
                            type="button"
                        >
                            Futuros
                        </button>
                    </div>

                    <div className="pt-3 test-transactions-list" id="transactions-list" data-testid="card-transactions-list" data-cy="card-transactions-list">
                        {transactionsToDisplay.length > 0 ? (
                            <div className="space-y-2 test-transactions-items" data-testid="card-transactions-items" data-cy="card-transactions-items">
                            {transactionsToDisplay.map(tx => (
                                <button
                                    key={tx.id}
                                    onClick={() => setSelectedTransaction(tx)}
                                    className="w-full p-3 rounded-lg flex items-center bg-surface-dark space-x-3 hover:bg-white/5 transition-colors text-left test-transaction-item"
                                    id={`transaction-${tx.id}`}
                                    data-testid={`card-transaction-${tx.id}`}
                                    data-cy={`card-transaction-${tx.id}`}
                                    data-playwright={`card-transaction-${tx.id}`}
                                    aria-label={`Transação ${tx.merchant}`}
                                    type="button"
                                >
                                    <div className="p-2 bg-background-dark rounded-full test-transaction-icon">
                                        <span className={`material-symbols-outlined ${tx.type === 'PAYMENT' ? 'text-green-400' : 'text-primary'}`} aria-hidden="true">{getIconForTx(tx.merchant)}</span>
                                    </div>
                                    <div className="flex-grow text-left test-transaction-details">
                                        <p className="font-semibold text-white test-transaction-merchant" data-testid={`card-transaction-merchant-${tx.id}`}>
                                            {tx.merchant} {tx.installments && <span className="text-xs text-gray-400 test-transaction-installments" data-testid={`card-transaction-installments-${tx.id}`}>{tx.installments}</span>}
                                        </p>
                                        <p className="text-sm text-gray-400 test-transaction-date" data-testid={`card-transaction-date-${tx.id}`}>
                                            {new Date(tx.date).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="text-right test-transaction-amount">
                                        <p className={`font-semibold test-transaction-amount-value ${tx.type === 'PAYMENT' ? 'text-green-400' : 'text-white'}`} id={`transaction-amount-${tx.id}`} data-testid={`card-transaction-amount-${tx.id}`} data-cy={`card-transaction-amount-${tx.id}`}>
                                            {tx.type === 'PAYMENT' ? '+' : ''} {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                    </div>
                                </button>
                            ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-4 test-no-transactions" id="no-transactions-message" data-testid="card-no-transactions" data-cy="card-no-transactions">
                               {activeTab === 'current' ? 'Nenhum lançamento nesta fatura.' : 'Nenhum lançamento futuro.'}
                            </p>
                        )}
                    </div>
                </div>
            </main>
             <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default CardDashboard;