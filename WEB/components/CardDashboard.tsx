import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface CardDashboardProps {
    onBack: () => void;
    onNavigate: (view: 'closedInvoice' | 'anticipateInstallments' | 'points' | 'currentInvoice') => void;
}

const CardDashboard: React.FC<CardDashboardProps> = ({ onBack, onNavigate }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'current' | 'future'>('current');

    if (!user) return null;
    const { creditCard } = user;

    const isOverdue = creditCard.closedInvoice > 0 && creditCard.closedInvoiceDueDate && new Date() > new Date(creditCard.closedInvoiceDueDate);

    // Filter transactions based on the invoice due date
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

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center p-4">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-2xl font-bold text-white">Meu Cartão</h2>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
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
                    className="bg-surface-dark p-6 rounded-2xl shadow-lg space-y-4 bg-gradient-to-br from-primary/10 to-surface-dark w-full text-left hover:ring-2 hover:ring-primary/50 transition-all"
                >
                    <div className="flex justify-between items-start">
                        <span className="font-bold text-lg">Fatura Atual</span>
                        <span className="font-mono text-sm bg-white/20 px-2 py-1 rounded">Venc. {vencimentoLabel}</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-400">{creditCard.currentInvoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <div className="text-sm">
                        <p>Limite Disponível: <span className="font-semibold text-primary">{creditCard.availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                    </div>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => onNavigate('closedInvoice')} className={`p-4 bg-surface-dark rounded-lg text-center hover:bg-white/10 transition-all ${(isOverdue || creditCard.isBlocked) ? 'border-2 border-red-500 animate-pulse' : ''}`}>
                        <p className="font-semibold text-white">Fatura Fechada</p>
                        <p className={`font-bold ${(isOverdue || creditCard.isBlocked) ? 'text-red-400' : 'text-orange-400'}`}>{creditCard.closedInvoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </button>
                    <button onClick={() => onNavigate('anticipateInstallments')} className="p-4 bg-surface-dark rounded-lg text-center hover:bg-white/10">
                        <p className="font-semibold text-white">Antecipar Parcelas</p>
                         <p className="text-xs text-gray-400">Ganhe descontos</p>
                    </button>
                </div>

                <button onClick={() => onNavigate('points')} className="w-full flex items-center p-4 bg-surface-dark rounded-lg hover:bg-white/10 transition-colors text-left space-x-4">
                    <span className="material-symbols-outlined text-2xl text-orange-400">workspace_premium</span>
                    <div className="flex-grow">
                        <p className="font-bold text-white">Fintech Loop</p>
                        <p className="text-sm text-gray-400">{creditCard.pointsBalance.toLocaleString('pt-BR')} pontos</p>
                    </div>
                    <span className="material-symbols-outlined text-gray-500">chevron_right</span>
                </button>

                <div>
                    <div className="flex border-b border-subtle-dark">
                        <button 
                            onClick={() => setActiveTab('current')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'current' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
                        >
                            Fatura Atual
                        </button>
                        <button 
                            onClick={() => setActiveTab('future')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'future' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
                        >
                            Futuros
                        </button>
                    </div>

                    <div className="pt-3">
                        {activeTab === 'future' && transactionsToDisplay.length > 0 && (
                            <div className="mb-4 flex justify-end">
                                <button 
                                    onClick={() => onNavigate('anticipateInstallments')}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-semibold"
                                >
                                    <span className="material-symbols-outlined text-lg">fast_forward</span>
                                    Antecipar Parcelas
                                </button>
                            </div>
                        )}
                        {transactionsToDisplay.length > 0 ? (
                            <div className="space-y-2">
                            {transactionsToDisplay.map(tx => (
                                <div 
                                    key={tx.id} 
                                    onClick={() => activeTab === 'future' ? onNavigate('anticipateInstallments') : null}
                                    className={`w-full p-3 rounded-lg flex items-center bg-surface-dark space-x-3 ${activeTab === 'future' ? 'cursor-pointer hover:bg-white/5' : ''}`}
                                >
                                    <div className="p-2 bg-background-dark rounded-full">
                                        <span className={`material-symbols-outlined ${tx.type === 'PAYMENT' ? 'text-green-400' : 'text-primary'}`}>{getIconForTx(tx.merchant)}</span>
                                    </div>
                                    <div className="flex-grow text-left">
                                        <p className="font-semibold text-white">{tx.merchant} {tx.installments && <span className="text-xs text-gray-400">{tx.installments}</span>}</p>
                                        <p className="text-sm text-gray-400">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold ${tx.type === 'PAYMENT' ? 'text-green-400' : 'text-white'}`}>{tx.type === 'PAYMENT' ? '+' : ''} {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        {activeTab === 'future' && <p className="text-xs text-primary mt-1">Toque para antecipar</p>}
                                    </div>
                                </div>
                            ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-4">
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