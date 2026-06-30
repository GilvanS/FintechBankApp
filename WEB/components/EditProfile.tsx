import React, { useState } from 'react';
// FIX: Corrected import path for User type from parent directory.
import { User } from '../types';
import { updateUserProfile } from '../services/api';
import { useToast, ToastContainer } from './Toast';

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

    const { toast, showSuccess, showError, hide } = useToast();

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
            showSuccess('Perfil atualizado com sucesso');
        } else {
            const msg = result.message || 'Falha ao atualizar perfil.';
            setError(msg);
            showError(msg);
        }
    };

    return (
        <div
            className="bg-volt-dark text-white p-4 min-h-full flex flex-col w-full max-w-md mx-auto pb-28 test-edit-profile"
            id="edit-profile"
            data-testid="edit-profile"
            data-cy="edit-profile"
            data-playwright="edit-profile"
        >
            <header className="flex items-center mb-6">
                <button
                    onClick={onBack}
                    className="mr-2 p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors test-cancel-edit"
                    id="btn-cancel-edit"
                    name="cancel-edit"
                    data-testid="cancel-edit-button"
                    data-cy="cancel-edit-button"
                    data-playwright="cancel-edit-button"
                    aria-label="Voltar"
                    type="button"
                >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Editar Perfil</h2>
            </header>

            <form
                onSubmit={handleSave}
                className="flex-grow flex flex-col space-y-6 test-edit-profile-form"
                id="edit-profile-form"
                name="edit-profile-form"
                data-testid="edit-profile-form"
                data-cy="edit-profile-form"
                data-playwright="edit-profile-form"
                aria-label="Formulário de edição de perfil"
            >
                <div className="space-y-4">
                    <div>
                        <label htmlFor="edit-fullname" className="text-sm font-medium text-on-surface-variant">Nome do perfil</label>
                        <input
                            id="edit-fullname"
                            name="fullname"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            className="w-full px-4 py-3 mt-1 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-volt-green transition-all font-bold test-input-fullname"
                            data-testid="edit-input-fullname"
                            data-cy="edit-input-fullname"
                            data-playwright="edit-input-fullname"
                            aria-label="Nome do perfil"
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-username" className="text-sm font-medium text-on-surface-variant">Nome do usuário</label>
                        <input
                            id="edit-username"
                            name="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full px-4 py-3 mt-1 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-volt-green transition-all font-bold test-input-username"
                            data-testid="edit-input-username"
                            data-cy="edit-input-username"
                            data-playwright="edit-input-username"
                            aria-label="Nome do usuário"
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-description" className="text-sm font-medium text-on-surface-variant">Descrição do perfil</label>
                        <textarea
                            id="edit-description"
                            name="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={100}
                            rows={3}
                            className="w-full px-4 py-3 mt-1 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-volt-green transition-all font-bold resize-none test-input-description"
                            data-testid="edit-input-description"
                            data-cy="edit-input-description"
                            data-playwright="edit-input-description"
                            aria-label="Descrição do perfil"
                        />
                        <p className="text-right text-xs text-on-surface-variant mt-1">{description.length}/100 caracteres</p>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Privacidade</h3>
                    <div className="bg-volt-surface border border-white/5 p-4 rounded-2xl shadow-2xl flex items-center justify-between">
                        <div>
                            <p className="font-medium text-white">Novidades e Dicas</p>
                            <p className="text-sm text-on-surface-variant">Receber stories com novidades após o login.</p>
                        </div>
                         <label htmlFor="toggle-show-popup" className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="toggle-show-popup"
                                name="show-popup"
                                className="sr-only peer"
                                checked={showPopup}
                                onChange={() => setShowPopup(!showPopup)}
                                data-testid="edit-toggle-show-popup"
                                data-cy="edit-toggle-show-popup"
                                data-playwright="edit-toggle-show-popup"
                                aria-label="Receber stories com novidades após o login"
                            />
                            <div className="w-10 h-6 rounded-full transition-colors bg-white/10 border-white/5 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border after:border-transparent after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white"></div>
                        </label>
                    </div>
                </div>

                {error && (
                    <p
                        className="text-sm text-red-400 alert"
                        data-testid="edit-profile-error"
                        role="alert"
                        aria-live="polite"
                    >
                        {error}
                    </p>
                )}

                <div className="mt-auto pt-6 space-y-3">
                     <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 text-xs tracking-widest uppercase font-black text-black bg-volt-green border border-transparent rounded-2xl hover:bg-volt-green/90 transition-all shadow-lg test-save-profile"
                        id="btn-save-profile"
                        name="save-profile"
                        data-testid="save-profile-button"
                        data-cy="save-profile-button"
                        data-playwright="save-profile-button"
                        aria-label={isLoading ? 'Salvando...' : 'Salvar alterações'}
                    >
                        {isLoading ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-full py-4 text-xs tracking-widest uppercase font-black text-volt-green bg-transparent border border-transparent hover:border-white/10 hover:bg-white/5 rounded-2xl transition-all test-cancel-edit-footer"
                        id="btn-cancel-edit-footer"
                        name="cancel-edit-footer"
                        data-testid="cancel-edit-footer-button"
                        data-cy="cancel-edit-footer-button"
                        data-playwright="cancel-edit-footer-button"
                        aria-label="Cancelar"
                    >
                        Cancelar
                    </button>
                </div>
            </form>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default EditProfile;