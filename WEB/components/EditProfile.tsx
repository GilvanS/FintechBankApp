import React, { useState } from 'react';
// FIX: Corrected import path for User type from parent directory.
import { User } from '../types';
import { updateUserProfile } from '../services/mockApi';

interface EditProfileProps {
    user: User;
    onBack: () => void;
    onSave: (updatedUser: Omit<User, 'password'>) => void;
}

const EditProfile: React.FC<EditProfileProps> = ({ user, onBack, onSave }) => {
    const [fullName, setFullName] = useState(user.fullName);
    const [username, setUsername] = useState(user.username || '');
    const [description, setDescription] = useState(user.profileDescription || '');
    const [showPopup, setShowPopup] = useState(user.showStoriesPopup ?? true);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const result = await updateUserProfile(user.cpf, {
            fullName,
            username,
            profileDescription: description,
            showStoriesPopup: showPopup
        });

        setIsLoading(false);
        if (result.success && result.user) {
            onSave(result.user as Omit<User, 'password'>);
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="bg-background-dark text-white p-4 min-h-full flex flex-col">
            <header className="flex items-center mb-6">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-white/10">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Editar Perfil</h2>
            </header>

            <form onSubmit={handleSave} className="flex-grow flex flex-col space-y-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-400">Nome do perfil</label>
                        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full px-4 py-3 mt-1 bg-surface-dark border-transparent rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-400">Nome do usuário</label>
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full px-4 py-3 mt-1 bg-surface-dark border-transparent rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-400">Descrição do perfil</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={100} rows={3} className="w-full px-4 py-3 mt-1 bg-surface-dark border-transparent rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                        <p className="text-right text-xs text-gray-500 mt-1">{description.length}/100 caracteres</p>
                    </div>
                </div>

                <div className="border-t border-subtle-dark/50 pt-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Privacidade</h3>
                    <div className="bg-surface-dark p-4 rounded-lg flex items-center justify-between">
                        <div>
                            <p className="font-medium text-white">Novidades e Dicas</p>
                            <p className="text-sm text-gray-400">Receber stories com novidades após o login.</p>
                        </div>
                         <label htmlFor="show-popup-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="show-popup-toggle" className="sr-only peer" checked={showPopup} onChange={() => setShowPopup(!showPopup)} />
                            <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-primary peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="mt-auto pt-6 space-y-3">
                     <button type="submit" disabled={isLoading} className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 disabled:opacity-50">
                        {isLoading ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                    <button type="button" onClick={onBack} className="w-full py-3 font-semibold text-primary bg-transparent rounded-lg hover:bg-surface-dark">
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditProfile;