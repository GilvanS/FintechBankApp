import React, { useState } from 'react';
import { Transaction, User } from '../types';
import ExtratoCompra from './ExtratoCompra'; // Reusing the detail component

interface ClosedInvoiceProps {
    user: User;
    onBack: () => void;
    onPayInvoice: () => void;
    onParcel: () => void;
}

/**
 * ClosedInvoiceView: Displays transactions from the last closed invoice.
 * Each transaction is clickable to show its details.
 */
const ClosedInvoiceView: React.FC<ClosedInvoiceProps> = ({ user, onBack, onPayInvoice, onParcel }) => {
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    if (selectedTransaction) {
        return <ExtratoCompra transaction={selectedTransaction} onBack={() => setSelectedTransaction(null)} />;
    }

    const { creditCard } = user;
    const isOverdue = creditCard.closedInvoice > 0 && creditCard.closedInvoiceDueDate && new Date() > new Date(creditCard.closedInvoiceDueDate);
    const canAfford = user.balance >= creditCard.closedInvoice;

    const handlePay = async () => {
        setIsLoading(true);
        try {
            await onPayInvoice();
        } finally {
            setIsLoading(false);
        }
    };

    // This is a simplified logic. A real implementation would use start and end dates
    // of the closed billing cycle. Here, we'll just take a few recent transactions 
    // and pretend they are from the closed invoice for demonstration.
    const closedTransactions = creditCard.closedTransactions.length > 0 ? creditCard.closedTransactions : creditCard.transactions.slice(0, 5);

    const groupedTransactions = closedTransactions.reduce((acc, tx) => {
        const dateKey = new Date(tx.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
        const formattedKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1).replace('-feira', '-feira,');
        if (!acc[formattedKey]) acc[formattedKey] = [];
        acc[formattedKey].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    const transactionGroups = Object.entries(groupedTransactions).reverse();

    return (
        <div className="bg-background-dark text-white flex flex-col h-full">
            <header className="flex items-center p-4 sticky top-0 bg-background-dark z-10">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-2xl font-bold">Fatura Fechada</h1>
            </header>

            <main className="flex-grow overflow-y-auto p-4 space-y-6">
                {creditCard.isBlocked && (
                    <div className="bg-red-800 border border-red-600 text-red-200 p-4 rounded-lg text-center animate-fade-in">
                        <h3 className="font-bold text-lg flex items-center justify-center gap-2"><span className="material-symbols-outlined">lock</span>Cartão Bloqueado</h3>
                        <p className="text-sm mt-1">Sua fatura está em atraso. Pague agora para desbloquear seu cartão e evitar mais juros.</p>
                    </div>
                )}
                {isOverdue && !creditCard.isBlocked && (
                    <div className="bg-orange-800 border border-orange-600 text-orange-200 p-4 rounded-lg text-center">
                        <h3 className="font-bold text-lg flex items-center justify-center gap-2"><span className="material-symbols-outlined">warning</span>Fatura Atrasada</h3>
                        <p className="text-sm mt-1">Pague agora para evitar juros e o bloqueio do seu cartão.</p>
                    </div>
                )}
                <div className="bg-surface-dark rounded-lg divide-y divide-subtle-dark/50 px-4">
                    <div className="flex justify-between items-center py-4">
                        <span className="text-sm text-gray-400">Fatura fechada</span>
                        <span className="text-sm font-semibold text-orange-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.closedInvoice)}</span>
                    </div>
                    <div className="flex justify-between items-center py-4">
                        <span className="text-sm text-gray-400">Vencimento</span>
                        <span className="text-sm font-semibold text-white">{creditCard.closedInvoiceDueDate ? new Date(creditCard.closedInvoiceDueDate).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'}) : '--'}</span>
                    </div>
                    <div className="flex justify-between items-center py-4">
                        <span className="text-sm text-gray-400">Limite disponível</span>
                        <span className="text-sm font-semibold text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.availableLimit)}</span>
                    </div>
                </div>
                
                <div className="flex flex-col gap-3">
                    <button onClick={onParcel} disabled={creditCard.closedInvoice <= 0} className="w-full py-3 font-semibold text-orange-400 bg-transparent border border-orange-400 rounded-lg hover:bg-orange-400/10 disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed">
                        Parcelar Fatura
                    </button>
                    <button onClick={handlePay} disabled={isLoading || creditCard.closedInvoice <= 0 || !canAfford} className={`w-full py-3 font-semibold text-background-dark rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed ${isOverdue ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-400 hover:bg-orange-500'}`}>
                        {isLoading ? 'Pagando...' : 'Pagar valor total'}
                    </button>
                    {!canAfford && creditCard.closedInvoice > 0 && <p className="text-xs text-red-400 text-center">Saldo em conta insuficiente para o pagamento total. Tente parcelar.</p>}
                </div>

                <div>
                    <h3 className="font-bold text-white mb-3 text-lg">Lançamentos da Fatura Fechada</h3>
                    {transactionGroups.length > 0 ? transactionGroups.map(([date, txs]) => (
                     <div key={date} className="space-y-4">
                        <p className="font-semibold text-gray-400">{date}</p>
                        <div className="space-y-2">
                            {txs.map(tx => (
                                <button 
                                    key={tx.id} 
                                    onClick={() => setSelectedTransaction(tx)}
                                    className="w-full flex items-center gap-4 hover:bg-surface-dark rounded-lg p-3 transition-colors duration-200 text-left"
                                >
                                    <div className="flex items-center justify-center rounded-md bg-surface-dark shrink-0 size-10">
                                        <span className="material-symbols-outlined text-primary">receipt_long</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white font-medium">{tx.merchant} {tx.installments && <span className="text-xs text-gray-400">{tx.installments}</span>}</p>
                                        <p className="text-gray-400 text-sm">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold text-white`}>
                                            {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10">
                        <p className="text-gray-500">Nenhuma compra na sua fatura fechada.</p>
                    </div>
                )}
                </div>
            </main>
        </div>
    );
};

export default ClosedInvoiceView;
