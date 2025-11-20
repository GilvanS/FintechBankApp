import React, { useState } from 'react';
import { User, View } from '../types'; // Importa User e View

interface CardDashboardProps {
    user: User;
    onBack: () => void;
    onNavigate: (view: View) => void; // Usa o tipo View
}

const CardDashboard: React.FC<CardDashboardProps> = ({ user, onBack, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'current' | 'future'>('current');

    if (!user || !user.creditCard) {
        return (
            <div className="bg-background-dark text-white min-h-full flex flex-col">
                <header className="flex items-center p-4">
                    <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 className="text-2xl font-bold text-white">Meu Cartão</h2>
                </header>
                <main className="flex-grow flex items-center justify-center">
                    <p>Informações do cartão indisponíveis.</p>
                </main>
            </div>
        );
    }

    // FIX: Safely access nested properties using optional chaining (?.) and provide default values.
    const { creditCard } = user;
    const invoices = user.invoices || [];
    const openInvoice = invoices.find(inv => inv.status === 'open');
    const closedInvoice = invoices.find(inv => inv.status === 'closed');

    const isOverdue = closedInvoice?.dueDate && new Date() > new Date(closedInvoice.dueDate);

    const transactionsToDisplay = activeTab === 'current' 
        ? (openInvoice?.items || []) 
        : [];

    const getIconForTx = (category: string) => {
        const lowerCategory = category?.toLowerCase() || '';
        if (lowerCategory.includes('comida')) return 'restaurant';
        if (lowerCategory.includes('transporte')) return 'directions_bus';
        if (lowerCategory.includes('compras')) return 'shopping_bag';
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

                <button 
                    onClick={() => onNavigate('currentInvoice')} 
                    className="bg-surface-dark p-6 rounded-2xl w-full text-left hover:ring-2 hover:ring-primary/50 transition-all"
                >
                    <div className="flex justify-between items-start">
                        <span className="font-bold text-lg">Fatura Atual</span>
                        <span className="font-mono text-sm bg-white/20 px-2 py-1 rounded">
                            Venc. {openInvoice?.dueDate ? new Date(openInvoice.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '--'}
                        </span>
                    </div>
                    <p className="text-3xl font-bold text-blue-400">
                        {(openInvoice?.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <div className="text-sm">
                        {/* FIX: Ensured safe access to creditCard.limit with a fallback value. */}
                        <p>Limite Disponível: <span className="font-semibold text-primary">{(creditCard?.limit || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                    </div>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => onNavigate('closedInvoice')} className={`p-4 bg-surface-dark rounded-lg text-center hover:bg-white/10 transition-all ${isOverdue ? 'border-2 border-red-500' : ''}`}>
                        <p className="font-semibold text-white">Fatura Fechada</p>
                        <p className={`font-bold ${isOverdue ? 'text-red-400' : 'text-orange-400'}`}>
                            {/* FIX: Ensured safe access to closedInvoice.amount with a fallback value. */}
                            {(closedInvoice?.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </button>
                     <button onClick={() => {}} className="p-4 bg-surface-dark rounded-lg text-center hover:bg-white/10">
                        <p className="font-semibold text-white">Antecipar Parcelas</p>
                         <p className="text-xs text-gray-400">Ganhe descontos</p>
                    </button>
                </div>

                <div>
                    <div className="flex border-b border-subtle-dark">
                        <button 
                            onClick={() => setActiveTab('current')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'current' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
                        >
                            Lançamentos
                        </button>
                    </div>

                    <div className="pt-3">
                        {transactionsToDisplay.length > 0 ? (
                            <div className="space-y-2">
                            {transactionsToDisplay.map(tx => (
                                <div key={tx.id} className="w-full p-3 rounded-lg flex items-center bg-surface-dark space-x-3">
                                    <div className="p-2 bg-background-dark rounded-full">
                                        <span className={`material-symbols-outlined text-primary`}>{getIconForTx(tx.category)}</span>
                                    </div>
                                    <div className="flex-grow text-left">
                                        <p className="font-semibold text-white">{tx.description}</p>
                                        <p className="text-sm text-gray-400">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold text-white`}>{tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    </div>
                                </div>
                            ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-4">Nenhum lançamento nesta fatura.</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CardDashboard;
