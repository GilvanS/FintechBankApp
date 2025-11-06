import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { User } from '../types';

interface SettingsProps {
    user: User;
    onLogout: () => void;
    onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ user, onLogout, onBack }) => {
    const [showPopup, setShowPopup] = useState(true);

    useEffect(() => {
        const storedPreference = localStorage.getItem('showFeaturePopup');
        if (storedPreference !== null) {
            setShowPopup(storedPreference === 'true');
        }
    }, []);

    const handleTogglePopup = () => {
        const newValue = !showPopup;
        setShowPopup(newValue);
        localStorage.setItem('showFeaturePopup', String(newValue));
    };

    return (
        <div className="bg-white min-h-full">
            <header className="bg-orange-500 text-white p-4 flex items-center">
                 <button onClick={onBack} className="mr-4 p-2 -ml-2 rounded-full hover:bg-white/20">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-xl font-bold">Ajustes</h2>
            </header>

            <div className="p-4 space-y-6">
                 <div className="bg-gray-100 p-4 rounded-lg">
                    <p className="font-bold text-lg text-gray-800">{user.fullName}</p>
                    <p className="text-sm text-gray-600">CPF: {user.cpf}</p>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg">
                    <label htmlFor="popup-toggle" className="text-gray-800 font-medium">
                        Exibir novidades ao iniciar
                    </label>
                    <button
                        onClick={handleTogglePopup}
                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${showPopup ? 'bg-orange-500' : 'bg-gray-300'}`}
                    >
                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${showPopup ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                
                {user.role === 'admin' && (
                     <button onClick={() => alert("Navegar para Admin")} className="w-full text-left p-3 bg-gray-100 rounded-lg font-medium text-gray-800 hover:bg-gray-200">
                        Painel do Administrador
                    </button>
                )}

                <div className="text-center text-xs text-gray-400">
                    Versão do App: 1.0.0
                </div>

                <div className="pt-4 border-t border-gray-200">
                    <button onClick={onLogout} className="w-full text-center py-3 font-semibold text-red-600 bg-red-100 rounded-lg hover:bg-red-200">
                        Sair do App
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;