
import React, { useState } from 'react';

interface PasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string) => void;
    title: string;
    description?: string;
    isLoading: boolean;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onClose, onConfirm, title, description, isLoading }) => {
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(password);
    };
    
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 test-modal-overlay"
            id="password-modal-overlay"
            data-testid="password-modal-overlay"
            data-cy="password-modal-overlay"
            data-playwright="password-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-modal-title"
            aria-describedby={description ? "password-modal-description" : undefined}
        >
            <div 
                className="bg-surface-dark p-8 rounded-lg shadow-xl w-full max-w-sm test-modal"
                id="password-modal"
                data-testid="password-modal"
                data-cy="password-modal"
                data-playwright="password-modal"
                role="document"
            >
                <h2 
                    id="password-modal-title"
                    className="text-2xl font-bold mb-2 text-white test-modal-title"
                    data-testid="password-modal-title"
                    data-cy="password-modal-title"
                    data-playwright="password-modal-title"
                >
                    {title}
                </h2>
                {description && (
                    <p 
                        id="password-modal-description"
                        className="text-subtle-dark mb-4 test-modal-description"
                        data-testid="password-modal-description"
                        data-cy="password-modal-description"
                    >
                        {description}
                    </p>
                )}
                <form 
                    onSubmit={handleSubmit} 
                    className="space-y-4 test-modal-form" 
                    id="password-modal-form"
                    name="password-modal-form"
                    data-testid="password-modal-form"
                    data-cy="password-modal-form"
                    data-playwright="password-modal-form"
                    aria-label="Formulário de confirmação de senha"
                >
                    <div 
                        className="test-field-password"
                        id="password-modal-field-password"
                        data-testid="password-modal-field-password"
                        data-cy="password-modal-field-password"
                    >
                       <label 
                           htmlFor="password-modal-input"
                           className="text-sm font-medium text-subtle-dark"
                       >
                           Senha
                       </label>
                       <input 
                           id="password-modal-input"
                           name="password"
                           type="password" 
                           value={password} 
                           onChange={e => setPassword(e.target.value)} 
                           required 
                           className="w-full bg-white/5 border border-white/20 rounded-lg py-3 px-4 mt-1 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all test-input-password"
                           data-testid="password-modal-input"
                           data-cy="password-modal-input"
                           data-playwright="password-modal-input"
                           aria-label="Senha"
                           aria-required="true"
                           autoComplete="current-password"
                           placeholder="Digite seu PIN (4 dígitos)"
                           autoFocus
                       />
                    </div>
                    <div 
                        className="flex justify-end space-x-4 pt-2 test-modal-actions" 
                        id="password-modal-actions"
                        data-testid="password-modal-actions"
                        data-cy="password-modal-actions"
                    >
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-4 py-2 text-white bg-white/10 rounded-md hover:bg-white/20 test-cancel-button"
                            id="btn-modal-cancel"
                            name="modal-cancel"
                            data-testid="password-modal-cancel-button"
                            data-cy="password-modal-cancel-button"
                            data-playwright="password-modal-cancel-button"
                            aria-label="Cancelar"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="px-4 py-2 text-black bg-primary font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50 test-confirm-button"
                            id="btn-modal-confirm"
                            name="modal-confirm"
                            data-testid="password-modal-confirm-button"
                            data-cy="password-modal-confirm-button"
                            data-playwright="password-modal-confirm-button"
                            aria-label={isLoading ? 'Confirmando...' : 'Confirmar'}
                        >
                            {isLoading ? 'Confirmando...' : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordModal;
