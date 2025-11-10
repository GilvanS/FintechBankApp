import React, { useState } from 'react';
import { signUp } from '../services/api';
import { formatCPF } from '../utils/formatters';

interface SignUpProps {
    onSignUpSuccess: () => void;
    onNavigateToLogin: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onSignUpSuccess, onNavigateToLogin }) => {
    const [cpf, setCpf] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        setIsLoading(true);
        setError('');
        setSuccess('');

        const result = await signUp({
            cpf: cpf.replace(/\D/g, ''),
            fullName,
            email,
            password,
            showStoriesPopup: true,
        });

        setIsLoading(false);
        if (result.success) {
            setSuccess(result.message);
            setTimeout(() => {
                onSignUpSuccess();
            }, 2000);
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="bg-background-dark text-text-dark h-full flex flex-col p-6 sm:p-8">
            <header className="mb-8">
                 <button onClick={onNavigateToLogin} className="flex items-center space-x-2 text-subtle-dark hover:text-text-dark mb-4">
                    <span className="material-symbols-outlined">arrow_back</span>
                 </button>
                <h1 className="text-3xl font-bold text-white">Crie sua conta</h1>
                <p className="text-gray-400">É rápido, fácil e seguro.</p>
            </header>

            <main className="flex-grow overflow-y-auto no-scrollbar">
                <form onSubmit={handleSignUp} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Nome Completo</label>
                        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full input-style" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">E-mail</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full input-style" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">CPF</label>
                        <input type="text" value={formatCPF(cpf)} onChange={(e) => setCpf(e.target.value)} required maxLength={14} className="w-full input-style" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Senha</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full input-style" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300">Confirme a Senha</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full input-style" />
                    </div>
                    
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {success && <p className="text-sm text-primary">{success}</p>}

                    <div className="pt-2">
                        <button type="submit" disabled={isLoading} className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 disabled:opacity-50">
                            {isLoading ? 'Criando conta...' : 'Criar Conta'}
                        </button>
                    </div>
                </form>
            </main>
            <style>{`.input-style { background-color: #1A2C1F; border: 2px solid #1A2C1F; border-radius: 0.5rem; padding: 0.75rem 1rem; margin-top: 0.25rem; color: #E5E7EB; } .input-style:focus { outline: none; box-shadow: 0 0 0 2px #13ec5b; border-color: transparent; }`}</style>
        </div>
    );
};

export default SignUp;
