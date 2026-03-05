
// Dentro do componente ResetPassword
import React, { useState } from 'react';
import { confirmPasswordReset } from '../services/api';
import { formatCPF } from '../utils/formatters';
import { useToast, ToastContainer } from './Toast';

interface ResetPasswordProps {
    onResetSuccess: () => void;
    onNavigateToLogin: () => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onResetSuccess, onNavigateToLogin }) => {
    const [cpf, setCpf] = useState('');
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { toast, showSuccess, showError, hide } = useToast();

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('As senhas nao coincidem.');
            showError('As senhas nao coincidem.');
            return;
        }
        setIsLoading(true);
        setError('');
        setSuccess('');

        const result = await confirmPasswordReset(
            cpf.replace(/\D/g, ''),
            token,
            newPassword
        );

        setIsLoading(false);
        if (result.success) {
            setSuccess(result.message);
            showSuccess('Senha redefinida com sucesso');
            setTimeout(() => {
                onResetSuccess();
            }, 1500);
        } else {
            const msg = result.message || 'Reset de senha indisponivel no momento.';
            setError(msg);
            showError(msg);
        }
    };

    return (
        <div className="bg-background-dark text-text-dark h-full flex flex-col p-6 sm:p-8" id="reset-password-page" data-testid="reset-password-page" aria-label="Redefinir senha">
            <header className="mb-8" id="reset-password-header" data-testid="reset-password-header" aria-label="Cabeçalho redefinir senha">
                 <button onClick={onNavigateToLogin} className="flex items-center space-x-2 text-subtle-dark hover:text-text-dark mb-4" id="reset-password-back" data-testid="reset-password-back" aria-label="Voltar ao login">
                    <span className="material-symbols-outlined">arrow_back</span>
                 </button>
                <h1 className="text-3xl font-bold text-white">Redefinir Senha</h1>
                <p className="text-gray-400">Crie uma nova senha de acesso.</p>
            </header>

            <main className="flex-grow overflow-y-auto no-scrollbar">
                <form onSubmit={handleReset} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300">CPF</label>
                        <input type="text" value={formatCPF(cpf)} onChange={(e) => setCpf(e.target.value)} required maxLength={14} className="w-full input-style" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300">Token de Redefinição</label>
                        <input type="text" value={token} onChange={(e) => setToken(e.target.value)} required placeholder="Últimos 4 dígitos do seu CPF" className="w-full input-style" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Nova Senha</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full input-style" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300">Confirme a Nova Senha</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full input-style" />
                    </div>
                    
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {success && <p className="text-sm text-primary">{success}</p>}

                    <div className="pt-2">
                        <button type="submit" disabled={isLoading} className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 disabled:opacity-50">
                            {isLoading ? 'Redefinindo...' : 'Redefinir Senha'}
                        </button>
                    </div>
                </form>
            </main>
            <style>{`.input-style { background-color: #1A2C1F; border: 2px solid #1A2C1F; border-radius: 0.5rem; padding: 0.75rem 1rem; margin-top: 0.25rem; color: #E5E7EB; } .input-style:focus { outline: none; box-shadow: 0 0 0 2px #13ec5b; border-color: transparent; }`}</style>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default ResetPassword;
