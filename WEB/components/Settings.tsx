


import React from 'react';
// FIX: Corrected import path for useAuth from parent directory.
import { useAuth } from '../context/AuthContext';
// FIX: Corrected import path for User type from parent directory.
import { User } from '../types';
// FIX: Imported formatCPF for consistency and removed local implementation.
import { formatCPF } from '../utils/formatters';

interface SettingsProps {
    user: User;
    onLogout: () => void;
    onBack: () => void;
    onNavigateToAdmin: () => void;
}

const Settings: React.FC<SettingsProps> = ({ user, onLogout, onBack, onNavigateToAdmin }) => {

    const SettingButton: React.FC<{label: string, onClick: () => void, testId?: string}> = ({ label, onClick, testId }) => (
        <button onClick={onClick} className="w-full text-left p-4 bg-gray-900 rounded-lg font-medium text-white hover:bg-gray-800 flex justify-between items-center" type="button" data-testid={testId} data-cy={testId} data-playwright={testId} aria-label={label}>
            <span>{label}</span>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
        </button>
    );

    return (
        <div
            className="bg-black min-h-full test-settings"
            id="settings"
            data-testid="settings"
            data-cy="settings"
            data-playwright="settings"
        >
            <header className="p-4 flex items-center border-b border-gray-800">
                 <button
                    onClick={onBack}
                    className="mr-4 p-2 -ml-2 rounded-full hover:bg-gray-800 test-settings-back"
                    id="btn-settings-back"
                    name="settings-back"
                    data-testid="settings-back-button"
                    data-cy="settings-back-button"
                    data-playwright="settings-back-button"
                    aria-label="Voltar"
                    type="button"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-xl font-bold text-white">Ajustes</h2>
            </header>

            <div className="p-4 space-y-4">
                 <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-3xl mx-auto mb-2">
                        {user.fullName.charAt(0)}
                    </div>
                    <p className="font-bold text-lg text-white">{user.fullName}</p>
                    <p className="text-sm text-gray-400">CPF: {formatCPF(user.cpf)}</p>
                </div>
                
                <div className="space-y-2">
                    {user.role === 'admin' && (
                        <SettingButton testId="settings-admin" label="Painel do Administrador" onClick={onNavigateToAdmin} />
                    )}
                    <SettingButton testId="settings-mydata" label="Meus dados" onClick={() => alert('Em desenvolvimento')} />
                    <SettingButton testId="settings-security" label="Segurança" onClick={() => alert('Em desenvolvimento')} />
                    <SettingButton testId="settings-notifications" label="Notificações" onClick={() => alert('Em desenvolvimento')} />
                </div>

                <div className="pt-4">
                    <button
                        onClick={onLogout}
                        className="w-full text-center py-3 font-semibold text-red-400 bg-red-900/50 rounded-lg hover:bg-red-900/70 test-settings-logout"
                        id="btn-settings-logout"
                        name="settings-logout"
                        data-testid="settings-logout-button"
                        data-cy="settings-logout-button"
                        data-playwright="settings-logout-button"
                        aria-label="Sair do App"
                        type="button"
                    >
                        Sair do App
                    </button>
                </div>

                 <div className="text-center text-xs text-gray-500 pt-4" data-testid="settings-version" data-cy="settings-version">
                    Versão do App: 2.0.0
                </div>
            </div>
        </div>
    );
};

export default Settings;