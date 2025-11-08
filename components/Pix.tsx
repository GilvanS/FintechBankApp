

import React, { useState, useEffect } from 'react';
import { User, Transaction, PixContact } from '../types';
import TransferForm from './TransferForm';
import PixReceipt from './PixReceipt';
import PixKeyManagement from './PixKeyManagement';
import Contacts from './Contacts';
// FIX: Removed .ts extension from import path.
import { getPixContacts } from '../services/mockApi';

interface PixProps {
    currentUser: User;
    onDataRefresh: () => void;
    onBack: () => void;
    onGoToInstallmentDetails: (details: any) => void;
    isTabRoot?: boolean;
}

type PixView = 'main' | 'transfer' | 'receipt' | 'keyManagement' | 'contacts';

const Pix: React.FC<PixProps> = ({ currentUser, onDataRefresh, onBack, onGoToInstallmentDetails, isTabRoot = false }) => {
    const [view, setView] = useState<PixView>('main');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [pixTransactions, setPixTransactions] = useState<Transaction[]>([]);
    const [contacts, setContacts] = useState<PixContact[]>([]);
    const [initialPixKeyForTransfer, setInitialPixKeyForTransfer] = useState<string | undefined>();

    const fetchData = async () => {
        const filtered = currentUser.transactions.filter(
            t => t.type === 'PIX_SENT' || t.type === 'PIX_RECEIVED' || t.type === 'PIX_CREDIT_SENT'
        );
        setPixTransactions(filtered);
        const userContacts = await getPixContacts(currentUser.cpf);
        setContacts(userContacts);
    };

    useEffect(() => {
        fetchData();
    }, [currentUser]);

    const handleTransactionSuccess = (transaction: Transaction) => {
        onDataRefresh();
        setSelectedTransaction(transaction);
        setView('receipt');
        setInitialPixKeyForTransfer(undefined);
    };

    const handleViewTransaction = (transaction: Transaction) => {
        setSelectedTransaction(transaction);
        setView('receipt');
    };

    const handleSelectFavorite = (contact: PixContact) => {
        setInitialPixKeyForTransfer(contact.key);
        setView('transfer');
    };

    const handleContactsUpdate = () => {
        fetchData();
        onDataRefresh();
    };

    const renderMainView = () => {
        const ActionButton: React.FC<{label: string, icon: React.ReactNode, onClick: () => void}> = ({label, icon, onClick}) => (
            <div className="flex flex-col items-center space-y-2">
                <button onClick={onClick} className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-green-400 hover:bg-gray-700 transition-colors">
                    {icon}
                </button>
                <span className="text-sm text-center text-white">{label}</span>
            </div>
        );

        const iconClasses = "w-7 h-7";

        return (
            <>
                <header className="flex items-center mb-6">
                    {!isTabRoot && (
                        <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-gray-800">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                        </button>
                    )}
                    <h2 className="text-2xl font-bold text-white">Área Pix</h2>
                </header>

                <main className="flex-grow overflow-y-auto no-scrollbar space-y-8">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-300 mb-4">Enviar</h3>
                        <div className="flex justify-around">
                            <ActionButton label="Transferir" onClick={() => setView('transfer')} icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>} />
                            <ActionButton label="Pix Copia e Cola" onClick={() => setView('transfer')} icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>} />
                            <ActionButton label="Ler QR code" onClick={() => alert('Em desenvolvimento')} icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m-4-12v10M8 4v16m8-14v12m-4-10v8" /></svg>} />
                        </div>
                    </div>

                    {contacts.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-300 mb-4">Contatos Favoritos</h3>
                            <div className="flex space-x-4 overflow-x-auto no-scrollbar pb-2">
                                {contacts.map(contact => (
                                    <button key={contact.key} onClick={() => handleSelectFavorite(contact)} className="flex flex-col items-center flex-shrink-0 w-20 text-center group">
                                        <div className="w-16 h-16 text-2xl flex items-center justify-center rounded-full bg-gray-800 group-hover:bg-gray-700 transition-colors mb-2">
                                            {contact.name.charAt(0)}
                                        </div>
                                        <span className="text-xs font-medium text-white truncate w-full">{contact.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div>
                         <h3 className="text-lg font-semibold text-gray-300 mb-4">Receber</h3>
                         <div className="flex justify-around">
                             <ActionButton label="Cobrar" onClick={() => alert('Em desenvolvimento')} icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm-5-12v-2m4 2v-2m-2-4h-2" /></svg>} />
                             <ActionButton label="Depositar" onClick={() => alert('Em desenvolvimento')} icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>} />
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <button onClick={() => setView('keyManagement')} className="w-full flex justify-between items-center bg-gray-900 p-4 rounded-lg hover:bg-gray-800 transition-colors">
                            <span className="font-semibold text-white">Minhas Chaves Pix</span>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                        </button>
                        <button onClick={() => setView('contacts')} className="w-full flex justify-between items-center bg-gray-900 p-4 rounded-lg hover:bg-gray-800 transition-colors">
                            <span className="font-semibold text-white">Gerenciar Contatos Favoritos</span>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                        </button>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-gray-300 mb-2">Movimentações</h3>
                        {pixTransactions.length > 0 ? (
                            <ul className="space-y-2">
                                {pixTransactions.slice(0, 3).map(tx => (
                                    <li key={tx.id}>
                                        <button onClick={() => handleViewTransaction(tx)} className="w-full flex items-center p-3 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors">
                                            <div className="flex-grow text-left">
                                                <p className="font-semibold text-md text-white">{tx.type.includes('SENT') ? 'Pix - Pagamento' : 'Pix - Recebimento'}</p>
                                                <p className="text-sm text-gray-400">{tx.type.includes('SENT') ? tx.to : tx.from}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-semibold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}
                                                </p>
                                                <p className="text-sm text-gray-500">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                                {pixTransactions.length > 3 && (
                                     <button onClick={onDataRefresh} className="text-sm w-full text-center py-2 font-semibold text-green-400 hover:text-green-300">Acessar todas</button>
                                )}
                            </ul>
                        ) : (
                            <p className="text-gray-500 text-center py-4">Nenhuma movimentação Pix ainda.</p>
                        )}
                    </div>
                </main>
            </>
        );
    };

    const renderView = () => {
        switch (view) {
            case 'transfer':
                return <TransferForm 
                    currentUser={currentUser} 
                    onTransactionSuccess={handleTransactionSuccess} 
                    onBack={() => { setView('main'); setInitialPixKeyForTransfer(undefined); }}
                    initialPixKey={initialPixKeyForTransfer}
                    onGoToInstallmentDetails={onGoToInstallmentDetails}
                />;
            case 'receipt':
                return selectedTransaction ? <PixReceipt transaction={selectedTransaction} onBack={() => { setView('main'); setSelectedTransaction(null); }} /> : renderMainView();
            case 'keyManagement':
                return <PixKeyManagement currentUser={currentUser} onBack={() => setView('main')} onUpdate={onDataRefresh} />;
            case 'contacts':
                return <Contacts currentUser={currentUser} onContactsUpdate={handleContactsUpdate} onBack={() => setView('main')} />;
            case 'main':
            default:
                return renderMainView();
        }
    };

    return (
        <div className="p-4 bg-black min-h-full text-white flex flex-col">
            {renderView()}
        </div>
    );
};

export default Pix;
