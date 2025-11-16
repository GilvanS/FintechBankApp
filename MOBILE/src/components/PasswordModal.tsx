
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-surface-dark p-8 rounded-lg shadow-xl w-full max-w-sm">
                <h2 className="text-2xl font-bold mb-2 text-white">{title}</h2>
                {description && <p className="text-subtle-dark mb-4">{description}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                       <label className="text-sm font-medium text-subtle-dark">Senha</label>
                       <input 
                           type="password" 
                           value={password} 
                           onChange={e => setPassword(e.target.value)} 
                           required 
                           className="w-full bg-white/5 border border-white/20 rounded-lg py-3 px-4 mt-1 text-white placeholder:text-white/40 focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
                       />
                    </div>
                    <div className="flex justify-end space-x-4 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-white bg-white/10 rounded-md hover:bg-white/20">Cancelar</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 text-black bg-primary font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50">
                            {isLoading ? 'Confirmando...' : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordModal;
