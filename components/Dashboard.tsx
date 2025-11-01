

import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { User } from '../types';
import { getUserData } from '../services/mockApi';
import Header from './Header';
import Balance from './Balance';
import Pix from './Pix';
import Statement from './Statement';
import Contacts from './Contacts';

type DashboardView = 'home' | 'pix' | 'statement' | 'contacts';

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [userData, setUserData] = useState<User | null>(null);
    const [currentView, setCurrentView] = useState<DashboardView>('home');
    const [loading, setLoading] = useState(true);

    const fetchUserData = async () => {
        if (user) {
            setLoading(true);
            const data = await getUserData(user.cpf);
            setUserData(data);
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchUserData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const handleTransactionSuccess = () => {
        fetchUserData(); // Refetch user data to update balance and transactions
        setCurrentView('statement'); // Switch to statement to see the new transaction
    }
    
    if (loading || !userData) {
        return <div className="flex items-center justify-center h-screen"><div className="w-16 h-16 border-4 border-t-transparent border-blue-500 rounded-full animate-spin"></div></div>;
    }

    const renderContent = () => {
        switch (currentView) {
            case 'pix':
                return <Pix currentUser={userData} onTransactionSuccess={handleTransactionSuccess} onBack={() => setCurrentView('home')} />;
            case 'statement':
                return <Statement transactions={userData.transactions} />;
            case 'contacts':
                return <Contacts currentUser={userData} onContactsUpdate={fetchUserData} />;
            case 'home':
            default:
                return (
                    <>
                        <Balance balance={userData.balance} />
                        <Statement transactions={userData.transactions.slice(0, 5)} isPreview={true} />
                    </>
                );
        }
    };
    
    return (
        <div className="flex flex-col h-screen max-h-screen">
            <Header userName={userData.fullName} onLogout={logout} />
            <main className="flex-grow overflow-y-auto p-1 pb-24">
                 {renderContent()}
            </main>
            
            {/* Bottom Navigation */}
            <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
                <nav className="flex justify-around py-2">
                    <button onClick={() => setCurrentView('home')} className={`flex flex-col items-center justify-center w-full text-sm transition-colors ${currentView === 'home' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                        Início
                    </button>
                    <button onClick={() => setCurrentView('pix')} className={`flex flex-col items-center justify-center w-full text-sm transition-colors ${currentView === 'pix' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                         <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"/></svg>
                        Área Pix
                    </button>
                    <button onClick={() => setCurrentView('statement')} className={`flex flex-col items-center justify-center w-full text-sm transition-colors ${currentView === 'statement' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                         <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Extrato
                    </button>
                    <button onClick={() => setCurrentView('contacts')} className={`flex flex-col items-center justify-center w-full text-sm transition-colors ${currentView === 'contacts' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.965 5.965 0 0112 13a5.965 5.965 0 013-1.197"></path></svg>
                        Contatos
                    </button>
                </nav>
            </footer>
        </div>
    );
};

export default Dashboard;
