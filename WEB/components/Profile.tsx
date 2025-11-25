import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import MyData from './MyData';
import EditProfile from './EditProfile';
import Security from './Security';
import Limits from './Limits';
import Notifications from './Notifications';
import Settings from './Settings';
import PointsDashboard from './PointsDashboard';
import { AppVersion } from '../utils/AppVersion';

// FIX: Removed 'admin' from ProfileView as it's now a top-level view handled by Dashboard.
type ProfileView = 'main' | 'myData' | 'editProfile' | 'security' | 'limits' | 'notifications' | 'points';

// FIX: Added ProfileProps interface to accept `onNavigate` from the parent component.
interface ProfileProps {
    onNavigate: (view: string) => void;
}

const Profile: React.FC<ProfileProps> = ({ onNavigate }) => {
    const { user, logout, updateUser } = useAuth();
    const [view, setView] = useState<ProfileView>('main');
    const [showVersionPopup, setShowVersionPopup] = useState(false);
    
    // ... (existing code)

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

        return (
            <div className="bg-background-dark min-h-full relative">
                {/* Version Popup */}
                {showVersionPopup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowVersionPopup(false)}>
                        <div className="bg-surface-dark p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-white/10" onClick={e => e.stopPropagation()}>
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-3xl text-primary">info</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Informações do App</h3>
                            <div className="bg-background-dark p-4 rounded-lg mb-6 text-left space-y-2">
                                <p className="text-gray-400 text-sm">Versão do Projeto</p>
                                <p className="text-white font-mono text-lg">{AppVersion.current}</p>
                                <div className="h-px bg-white/10 my-2"></div>
                                <p className="text-gray-400 text-sm">Detalhes da Build</p>
                                <pre className="text-primary font-mono text-xs whitespace-pre-wrap">{AppVersion.fullDetails}</pre>
                            </div>
                            <button
                                onClick={() => setShowVersionPopup(false)}
                                className="w-full py-3 bg-primary text-background-dark font-bold rounded-lg hover:bg-primary-light transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                )}

                <header className="p-4 flex items-center border-b border-subtle-dark/50">
                    <button onClick={() => onNavigate('home')} className="p-2 -ml-2 rounded-full hover:bg-white/10 mr-2">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h2 className="text-2xl font-bold text-white">Meu Perfil</h2>
                </header>

                <div className="p-4 space-y-4">
                    {/* ... (existing user info) */}
                     <div className="text-center">
                        <div className="w-24 h-24 rounded-full bg-surface-dark text-white flex items-center justify-center font-bold text-4xl mx-auto mb-3 border-4 border-subtle-dark">
                            {user.fullName.charAt(0)}
                        </div>
                        <p className="font-bold text-xl text-white">{user.fullName}</p>
                        <p className="text-sm text-gray-400">{user.username || user.email}</p>
                    </div>
                    
                    <div className="space-y-2">
                        <SettingButton label="Meus dados" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} onClick={() => setView('myData')} />
                        <SettingButton label="Segurança" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} onClick={() => setView('security')} />
                        <SettingButton label="Notificações" notification icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>} onClick={() => setView('notifications')} />
                        <SettingButton label="Fintech Loop" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v1h-1.5V5a.5.5 0 00-.5-.5H7a.5.5 0 00-.5.5v.5H2v10a2 2 0 002 2h10a2 2 0 002-2V19h.5v.5a.5.5 0 01-.5.5H7a.5.5 0 01-.5-.5v-1H5v1z" /></svg>} onClick={() => setView('points')} />
                        {user.role === 'admin' && (
                            <SettingButton label="Painel do Admin" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} onClick={() => onNavigate('admin')} />
                        )}
                    </div>

                    <div className="pt-4 space-y-4">
                        <button onClick={logout} className="w-full text-center py-3 font-semibold text-red-400 bg-transparent border border-red-900/80 rounded-lg hover:bg-red-900/70">
                            Sair do App
                        </button>

                        <button onClick={() => setShowVersionPopup(true)} className="w-full text-center py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                            Versão do App
                        </button>
                    </div>
                </div>
            </div>
        )
    };
    
    const onSaveProfile = (updatedUser: Omit<User, 'password'>) => {
        updateUser(updatedUser);
        setView('myData');
    };

    const renderView = () => {
        switch (view) {
            case 'myData':
                return <MyData user={user} onBack={() => setView('main')} onNavigateToEdit={() => setView('editProfile')} />;
            case 'editProfile':
                return <EditProfile user={user} onBack={() => setView('myData')} onSave={onSaveProfile} />;
            case 'security':
                return <Security onBack={() => setView('main')} onNavigateToLimits={() => setView('limits')} />;
            case 'limits':
                // FIX: Removed incorrect props ('currentUser', 'onUpdate', 'onClose') and passed the required 'onBack' prop to the Limits component.
                return <Limits onBack={() => setView('security')} />;
            case 'notifications':
                return <Notifications onBack={() => setView('main')} />;
             case 'points':
                return <PointsDashboard user={user} onBack={() => setView('main')} />;
            case 'main':
            default:
                return <MainView />;
        }
    }


    return <div className="h-full flex flex-col bg-background-dark max-w-2xl mx-auto w-full">{renderView()}</div>;
};

export default Profile;