import React, { useState } from 'react';
import { User } from '../types';
import TransferForm from './TransferForm';

interface PixProps {
    currentUser: User;
    onTransactionSuccess: () => void;
    onBack: () => void;
}

const Pix: React.FC<PixProps> = ({ currentUser, onTransactionSuccess, onBack }) => {
    const [view, setView] = useState<'main' | 'transfer'>('main');

    const ActionButton: React.FC<{ label: string; icon: React.ReactNode; onClick: () => void, isLarge?: boolean }> = ({ label, icon, onClick, isLarge = false }) => (
        <button onClick={onClick} className={`flex items-center p-4 rounded-lg transition-colors ${isLarge ? 'flex-col justify-center text-center h-24 bg-gray-100 hover:bg-gray-200' : 'bg-white hover:bg-gray-50'}`}>
            <div className={`text-orange-500 ${isLarge ? 'mb-2' : 'mr-4'}`}>{icon}</div>
            <span className={`font-semibold ${isLarge ? 'text-sm' : 'text-md'} text-gray-800`}>{label}</span>
        </button>
    );

    const iconClasses = "w-6 h-6";

    if (view === 'transfer') {
        return <TransferForm currentUser={currentUser} onTransactionSuccess={onTransactionSuccess} onBack={() => setView('main')} />;
    }

    return (
        <div className="p-4 bg-white min-h-full">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-100">
                     <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-gray-800">Área Pix</h2>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
                <ActionButton label="Transferir" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"/></svg>} onClick={() => setView('transfer')} isLarge />
                <ActionButton label="QR Code" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>} onClick={() => alert('Funcionalidade em desenvolvimento.')} isLarge />
                <ActionButton label="Minhas Chaves" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7h1a2 2 0 012 2v1a2 2 0 01-2 2h-1m-6 4H8a2 2 0 01-2-2v-1a2 2 0 012-2h1m3-4h.01M12 12h.01M12 16h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} onClick={() => alert('Funcionalidade em desenvolvimento.')} isLarge />
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 px-2">Outras opções</h3>
                 <ActionButton label="Pix Copia e Cola" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>} onClick={() => alert('Funcionalidade em desenvolvimento.')} />
                 <ActionButton label="Meus Limites" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>} onClick={() => alert('Funcionalidade em desenvolvimento.')} />
                 <ActionButton label="Extrato Pix" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>} onClick={() => alert('Funcionalidade em desenvolvimento.')} />
            </div>

        </div>
    );
};

export default Pix;