
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { User } from '../types';
import { getUserData } from '../services/mockApi';
import Header from './Header';
import AccountInfo from './AccountInfo';
import ActionGrid from './ActionGrid';
import Statement from './Statement';
import Pix from './Pix';
import Settings from './Settings';
import Notifications from './Notifications';
import FeaturePopup from './FeaturePopup';

type View = 'home' | 'pix' | 'statement' | 'settings' | 'notifications' | 'account';

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [userData, setUserData] = useState<User | null>(null);
    const [currentView, setCurrentView] = useState<View>('home');
    const [loading, setLoading] = useState(true);
    const [showPopup, setShowPopup] = useState(false);

    const fetchUserData = async () => {
        if (user) {
            const data = await getUserData(user.cpf);
            setUserData(data);
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchUserData();
        
        const shouldShow = localStorage.getItem('showFeaturePopup') !== 'false';
        const hasSeen = sessionStorage.getItem('hasSeenPopup');
        if (shouldShow && !hasSeen) {
            setShowPopup(true);
            sessionStorage.setItem('hasSeenPopup', 'true');
        }

    }, [user]);

    const handleNavigation = (view: View) => {
        setCurrentView(view);
    };

    const handleTransactionSuccess = () => {
        fetchUserData();
        setCurrentView('statement');
    }
    
    if (loading || !userData) {
        return <div className="flex items-center justify-center min-h-screen"><div className="w-16 h-16 border-4 border-t-transparent border-orange-500 rounded-full animate-spin"></div></div>;
    }

    const renderContent = () => {
        switch (currentView) {
            case 'pix':
                return <Pix currentUser={userData} onTransactionSuccess={handleTransactionSuccess} onBack={() => setCurrentView('home')} />;
            case 'statement':
                return <Statement balance={userData.balance} transactions={userData.transactions} onBack={() => setCurrentView('home')} />;
            case 'account':
                 return <AccountInfo user={userData} onBack={() => setCurrentView('home')} />;
            case 'settings':
                return <Settings user={userData} onLogout={logout} onBack={() => setCurrentView('home')} />;
            case 'notifications':
                return <Notifications onBack={() => setCurrentView('home')} />;
            case 'home':
            default:
                return (
                    <div className="p-4 space-y-4">
                        <AccountInfo user={userData} onBack={() => handleNavigation('account')} />
                        <ActionGrid onNavigate={(view) => handleNavigation(view as View)} />
                        {/* Fix: Property 'balance' is missing in type. */}
                        <Statement balance={userData.balance} transactions={userData.transactions.slice(0, 3)} isPreview={true} onSeeAll={() => setCurrentView('statement')} />
                    </div>
                );
        }
    };
    
    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            {showPopup && <FeaturePopup onClose={() => setShowPopup(false)} />}
            <Header 
                user={userData}
                onNavigateToSettings={() => setCurrentView('settings')} 
                onNavigateToNotifications={() => setCurrentView('notifications')} 
            />
            <main className="flex-grow overflow-y-auto pb-20">
                 {renderContent()}
            </main>
            
            <footer className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white border-t border-gray-200">
                <nav className="flex justify-around py-2">
                    <button onClick={() => setCurrentView('home')} className={`flex flex-col items-center w-full text-xs transition-colors ${currentView === 'home' ? 'text-orange-500' : 'text-gray-500'}`}>
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                        Início
                    </button>
                    <button onClick={() => setCurrentView('statement')} className={`flex flex-col items-center w-full text-xs transition-colors ${currentView === 'statement' ? 'text-orange-500' : 'text-gray-500'}`}>
                         <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Extrato
                    </button>
                    <button onClick={() => setCurrentView('pix')} className={`flex flex-col items-center w-full text-xs transition-colors ${currentView === 'pix' ? 'text-orange-500' : 'text-gray-500'}`}>
                         <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"/></svg>
                        PIX
                    </button>
                     <button className="flex flex-col items-center w-full text-xs text-gray-400 cursor-not-allowed">
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                        Cartões
                    </button>
                </nav>
            </footer>
        </div>
    );
};

export default Dashboard;