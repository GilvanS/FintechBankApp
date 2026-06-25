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
        const SettingButton: React.FC<{label: string, icon: React.ReactNode, onClick: () => void, notification?: boolean, testId?: string }> = ({ label, icon, onClick, notification, testId }) => (
            <button onClick={onClick} className="w-full text-left p-4 volt-card font-bold text-black hover:bg-volt-cream flex justify-between items-center relative cursor-pointer active:scale-[0.99] transition-all" type="button" data-testid={testId} data-cy={testId} data-playwright={testId} aria-label={label}>
                <div className="flex items-center space-x-4">
                    <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-volt-yellow flex-shrink-0">{icon}</div>
                    <span className="font-black text-black" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{label}</span>
                </div>
                <div className="flex items-center space-x-2">
                    {notification && <div className="w-2 h-2 bg-orange-500 rounded-full border border-black"></div>}
                    <svg className="w-5 h-5 text-black/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                </div>
            </button>
        );

        const iconClasses = "w-6 h-6";

        return (
            <div
                className="bg-volt-yellow min-h-full relative test-profile"
                id="profile"
                data-testid="profile"
                data-cy="profile"
                data-playwright="profile"
            >
                {/* Version Popup */}
                {showVersionPopup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowVersionPopup(false)}>
                        <div className="volt-card p-8 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
                            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <span className="material-symbols-outlined text-3xl text-volt-yellow">info</span>
                            </div>
                            <h3 className="text-xl font-black text-black mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Informações do App</h3>
                            <div className="volt-surface-high p-4 mb-6 text-left space-y-2">
                                <p className="text-black/60 text-sm font-semibold">Versão do Projeto</p>
                                <p className="text-black font-mono text-lg font-black">{AppVersion.current}</p>
                                <div className="h-px bg-black/20 my-2"></div>
                                <p className="text-black/60 text-sm font-semibold">Detalhes da Build</p>
                                <pre className="text-black font-mono text-xs whitespace-pre-wrap">{AppVersion.fullDetails}</pre>
                            </div>
                            <button
                                onClick={() => setShowVersionPopup(false)}
                                className="w-full py-3 bg-black text-volt-yellow font-black rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:opacity-90 transition-opacity active:scale-[0.98]"
                                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                )}

                <header className="px-4 pt-6 pb-4 flex items-center gap-3">
                    <button
                        onClick={() => onNavigate('home')}
                        className="w-10 h-10 rounded-full bg-black flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:opacity-80 transition-opacity test-back-button"
                        id="btn-profile-back"
                        name="back-button"
                        data-testid="profile-back-button"
                        data-cy="profile-back-button"
                        data-playwright="profile-back-button"
                        aria-label="Voltar"
                        type="button"
                    >
                        <svg className="w-5 h-5 text-volt-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h2 className="text-2xl font-black text-black" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Meu Perfil</h2>
                </header>

                <div className="px-4 pb-4 space-y-4">
                    {/* ── Profile Info Card ── */}
                     <div className="volt-card p-5 flex flex-col items-center text-center space-y-3" id="profile-info" data-testid="profile-info" data-cy="profile-info">
                        <div className="w-20 h-20 rounded-full bg-black text-volt-yellow flex items-center justify-center font-black text-3xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                            {user.fullName.charAt(0)}
                        </div>
                        <div>
                            <p className="font-black text-xl text-black test-profile-name" data-testid="profile-name" data-cy="profile-name"
                                style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{user.fullName}</p>
                            <p className="text-sm text-black/60 font-medium test-profile-username" data-testid="profile-email" data-cy="profile-email">{user.username || user.email}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <SettingButton testId="edit-profile-button" label="Meus dados" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} onClick={() => setView('myData')} />
                        <SettingButton testId="profile-security-button" label="Segurança" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} onClick={() => setView('security')} />
                        <SettingButton testId="profile-notifications-button" label="Notificações" notification icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>} onClick={() => setView('notifications')} />
                        <SettingButton testId="profile-points-button" label="Fintech Loop" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v1h-1.5V5a.5.5 0 00-.5-.5H7a.5.5 0 00-.5.5v.5H2v10a2 2 0 002 2h10a2 2 0 002-2V19h.5v.5a.5.5 0 01-.5.5H7a.5.5 0 01-.5-.5v-1H5v1z" /></svg>} onClick={() => setView('points')} />
                        {user.role === 'admin' && (
                            <SettingButton testId="profile-admin-button" label="Painel do Admin" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} onClick={() => onNavigate('admin')} />
                        )}
                    </div>

                    <div className="pt-4 space-y-4">
                        <button
                            onClick={logout}
                            className="w-full text-center py-3 font-black text-white bg-black border-4 border-black rounded-2xl hover:bg-red-700 hover:border-red-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-[0.98] transition-all test-logout"
                            id="btn-logout"
                            name="logout"
                            data-testid="logout-button"
                            data-cy="logout-button"
                            data-playwright="logout-button"
                            aria-label="Sair do App"
                            type="button"
                            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                        >
                            Sair do App
                        </button>

                        <button
                            onClick={() => setShowVersionPopup(true)}
                            className="w-full text-center py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors test-app-version"
                            id="btn-app-version"
                            name="app-version"
                            data-testid="profile-version-button"
                            data-cy="profile-version-button"
                            data-playwright="profile-version-button"
                            aria-label="Versão do App"
                            type="button"
                        >
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


    return <div className="h-full flex flex-col bg-volt-yellow max-w-2xl mx-auto w-full">{renderView()}</div>;
};

export default Profile;