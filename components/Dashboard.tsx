
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { User } from '../types';
import { getUserData } from '../services/mockApi';
import Header from './Header';
import Statement from './Statement';
import Pix from './Pix';
import Settings from './Settings';
import Notifications from './Notifications';
import Admin from './Admin';
import AccountInfo from './AccountInfo';
import MainActions from './MainActions';
import CardDashboard from './CardDashboard';
import Contacts from './Contacts';
import Limits from './Limits';

type MainView = 'home' | 'cards' | 'pix' | 'settings';
type SubView = 'notifications' | 'admin' | 'contacts' | 'limits' | 'statement' | null;

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [userData, setUserData] = useState<User | null>(null);
    const [mainView, setMainView] = useState<MainView>('home');
    const [subView, setSubView] = useState<SubView>(null);
    const [loading, setLoading] = useState(true);

    const fetchUserData = async () => {
        if (user) {
            const data = await getUserData(user.cpf);
            setUserData(data);
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchUserData();
    }, [user]);

    const handleTransactionSuccess = () => {
        fetchUserData();
        setSubView('statement');
    }
    
    if (loading || !userData) {
        return <div className="flex items-center justify-center min-h-screen bg-black"><div className="w-16 h-16 border-4 border-t-transparent border-green-500 rounded-full animate-spin"></div></div>;
    }

    const renderSubView = () => {
        switch (subView) {
            case 'notifications':
                return <Notifications onBack={() => setSubView(null)} />;
            case 'admin':
                return <Admin onBack={() => setSubView(null)} />;
            case 'contacts':
                return <Contacts currentUser={userData} onContactsUpdate={fetchUserData} onBack={() => setSubView(null)} />;
            case 'limits':
                 return <Limits currentUser={userData} onLimitsUpdate={fetchUserData} onBack={() => setSubView(null)} />;
            case 'statement':
                return <Statement balance={userData.balance} transactions={userData.transactions} onBack={() => setSubView(null)} />;
            default:
                return null;
        }
    }

    const renderMainView = () => {
        if (subView) return renderSubView();

        switch (mainView) {
            case 'cards':
                return <CardDashboard user={userData} />;
            case 'pix':
                 return <Pix currentUser={userData} onTransactionSuccess={handleTransactionSuccess} onBack={() => setMainView('home')} />;
            case 'settings':
                return <Settings user={userData} onLogout={logout} onNavigateToAdmin={() => setSubView('admin')} onBack={() => setMainView('home')} />;
            case 'home':
            default:
                return (
                    <div className="p-4 space-y-6">
                        <AccountInfo balance={userData.balance} />
                        <div className="bg-gray-900 p-4 rounded-lg text-center text-white">
                            <h3 className="font-semibold">Débito Automático next</h3>
                            <p className="text-sm text-gray-400">Cadastre aqui para ter as contas sempre em dia</p>
                        </div>
                        <MainActions onNavigate={(view) => {
                            if (view === 'pix') setMainView('pix');
                            if (view === 'statement') setSubView('statement');
                        }} />
                        <div className="space-y-4">
                             <h2 className="text-xl font-bold text-white">nextShop</h2>
                              <div className="bg-gray-900 p-4 rounded-lg text-white">
                                <h3 className="font-semibold">Seguro Cartão de Crédito 💚</h3>
                                <p className="text-sm text-gray-400">Proteja seu cartão para as compras da Black Friday e das festas de fim de ano</p>
                                <button className="mt-4 text-black bg-green-400 font-bold py-2 px-4 rounded-lg text-sm">QUERO CONTRATAR</button>
                            </div>
                        </div>
                    </div>
                );
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-black text-white">
            { !subView && <Header user={userData} onNavigateToSettings={() => setMainView('settings')} /> }
            
            <main className="flex-grow overflow-y-auto pb-20">
                 {renderMainView()}
            </main>
            
            <footer className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-gray-900">
                <nav className="flex justify-around py-2">
                    <button onClick={() => setMainView('home')} className={`flex flex-col items-center w-full text-xs transition-colors ${mainView === 'home' ? 'text-green-400' : 'text-gray-400'}`}>
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                        Início
                    </button>
                     <button onClick={() => setMainView('cards')} className={`flex flex-col items-center w-full text-xs transition-colors ${mainView === 'cards' ? 'text-green-400' : 'text-gray-400'}`}>
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                        Cartões
                    </button>
                    <button onClick={() => setMainView('pix')} className={`flex flex-col items-center w-full text-xs transition-colors ${mainView === 'pix' ? 'text-green-400' : 'text-gray-400'}`}>
                         <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"/></svg>
                        PIX
                    </button>
                     <button onClick={() => setMainView('settings')} className={`flex flex-col items-center w-full text-xs transition-colors ${mainView === 'settings' ? 'text-green-400' : 'text-gray-400'}`}>
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Ajustes
                    </button>
                </nav>
            </footer>
        </div>
    );
};

export default Dashboard;