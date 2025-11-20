
import React, { useState } from 'react';
import { User } from '../types';

// Placeholder components for the sub-views
const MyData = ({ onBack }) => <div className="p-4"><button onClick={onBack} className="text-primary">&lt; Voltar</button><h1 className="text-white text-xl mt-4">Meus Dados</h1></div>;
const Security = ({ onBack }) => <div className="p-4"><button onClick={onBack} className="text-primary">&lt; Voltar</button><h1 className="text-white text-xl mt-4">Segurança</h1></div>;
const Notifications = ({ onBack }) => <div className="p-4"><button onClick={onBack} className="text-primary">&lt; Voltar</button><h1 className="text-white text-xl mt-4">Notificações</h1></div>;

interface ProfileProps {
    user: User;
    onLogout: () => void;
    onNavigate: (view: string) => void; // Added for potential top-level navigation
}

type ProfileView = 'main' | 'myData' | 'security' | 'notifications';

const Profile: React.FC<ProfileProps> = ({ user, onLogout, onNavigate }) => {
    const [view, setView] = useState<ProfileView>('main');

    if (!user) {
        return <p className="p-4 text-white">Carregando perfil...</p>;
    }

    const MainView = () => {
        const SettingButton: React.FC<{label: string, icon: React.ReactNode, onClick: () => void, notification?: boolean }> = ({ label, icon, onClick, notification }) => (
            <button onClick={onClick} className="w-full text-left p-4 bg-surface-dark rounded-lg font-medium text-white hover:bg-white/10 flex justify-between items-center relative">
                <div className="flex items-center space-x-4">
                    <div className="text-primary">{icon}</div>
                    <span>{label}</span>
                </div>
                <div className="flex items-center space-x-2">
                    {notification && <div className="w-2 h-2 bg-orange-500 rounded-full"></div>}
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                </div>
            </button>
        );

        const iconClasses = "w-6 h-6";
        const userInitial = user.fullName ? user.fullName.charAt(0).toUpperCase() : '?';

        return (
             <div className="bg-background-dark min-h-full p-4 space-y-4">
                 <div className="text-center py-4">
                    <div className="w-24 h-24 rounded-full bg-surface-dark text-white flex items-center justify-center font-bold text-4xl mx-auto mb-3 border-4 border-subtle-dark">
                        {userInitial}
                    </div>
                    <p className="font-bold text-xl text-white">{user.fullName || 'Usuário'}</p>
                    <p className="text-sm text-gray-400">{user.email}</p>
                </div>
                
                <div className="space-y-2">
                    <SettingButton label="Meus dados" icon={<span className="material-symbols-outlined">person</span>} onClick={() => setView('myData')} />
                    <SettingButton label="Segurança" icon={<span className="material-symbols-outlined">shield</span>} onClick={() => setView('security')} />
                    <SettingButton label="Notificações" notification icon={<span className="material-symbols-outlined">notifications</span>} onClick={() => setView('notifications')} />
                </div>

                <div className="pt-4">
                    <button 
                        onClick={onLogout}
                        className="w-full bg-red-600/80 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                        Sair da Conta
                    </button>
                </div>
            </div>
        );
    };
    
    const renderView = () => {
        switch (view) {
            case 'myData':
                return <MyData onBack={() => setView('main')} />;
            case 'security':
                return <Security onBack={() => setView('main')} />;
            case 'notifications':
                return <Notifications onBack={() => setView('main')} />;
            case 'main':
            default:
                return <MainView />;
        }
    }

    return <div className="h-full flex flex-col bg-background-dark">{renderView()}</div>;
};

export default Profile;
