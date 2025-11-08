import React, { useState } from 'react';
import { useAuth } from '../App';
import { CardTransaction } from '../types';
import ClosedInvoice from './ClosedInvoice';

interface CardDashboardProps {
    onBack: () => void;
    onPayInvoice: () => void;
    onParcelInvoice: (payload: { amount: number; installments: number }) => void;
    onNavigateToAnticipate: () => void;
}

const CardDashboard: React.FC<CardDashboardProps> = ({ onBack, onPayInvoice, onParcelInvoice, onNavigateToAnticipate }) => {
    const { user } = useAuth();
    const [showClosedInvoice, setShowClosedInvoice] = useState(false);
    
    if (!user) return null;

    const { creditCard } = user;

    const TransactionRow: React.FC<{ tx: CardTransaction }> = ({ tx }) => (
        <div className="w-full p-3 rounded-lg flex items-center bg-gray-900">
            <div className="flex-grow text-left">
                <p className="font-semibold text-white">{tx.merchant}</p>
                <p className="text-sm text-gray-400">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="text-right">
                <p className="font-semibold text-white">- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}</p>
                {tx.installments && <p className="text-xs text-gray-500">Parc. {tx.installments}</p>}
            </div>
        </div>
    );
    
    if (showClosedInvoice) {
        return (
            <ClosedInvoice 
                user={user} 
                onBack={() => setShowClosedInvoice(false)} 
                onPayInvoice={onPayInvoice} 
                onParcel={onParcelInvoice} 
            />
        );
    }
    
    return (
         <div className="bg-black text-white min-h-full flex flex-col">
            <header className="flex items-center p-4">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-xl font-bold text-white">Cartão de Crédito</h2>
            </header>

            <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
                <div className="bg-orange-500 rounded-2xl p-6 relative overflow-hidden shadow-lg">
                    <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full"></div>
                    <p className="text-sm text-orange-200">Fatura atual</p>
                    <p className="text-3xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.currentInvoice)}</p>
                    <p className="text-xs text-orange-200 mt-1">Fecha em {new Date(creditCard.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                    <div className="mt-4 flex justify-between items-end">
                        <p className="text-sm">Limite disponível<br/><span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.availableLimit)}</span></p>
                        <img src="https://i.imgur.com/gK2oYvY.png" alt="Card Chip" className="w-10 h-auto opacity-80" />
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button onClick={() => setShowClosedInvoice(true)} className="w-full text-center py-3 text-sm font-semibold bg-gray-800 rounded-lg hover:bg-gray-700">Resumo de faturas</button>
                    <button className="w-full text-center py-3 text-sm font-semibold bg-gray-800 rounded-lg hover:bg-gray-700">Cartão virtual</button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                    <div className="flex items-center space-x-3">
                        <div className="text-orange-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <p className="font-semibold">Antecipar parcelas</p>
                    </div>
                     <button onClick={onNavigateToAnticipate} className="px-4 py-1.5 text-xs font-bold bg-orange-400 text-black rounded-lg hover:bg-orange-500">Ver ofertas</button>
                </div>
                
                 <div>
                    <h3 className="font-bold text-white mb-3 text-lg">Lançamentos Recentes</h3>
                    {creditCard.transactions.length > 0 ? (
                        <div className="space-y-1">
                            {creditCard.transactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-4">Nenhum lançamento recente.</p>
                    )}
                </div>
            </main>
        </div>
    );
};

export default CardDashboard;