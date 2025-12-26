import React, { useState } from 'react';
import { signUp } from '../services/api';
import { formatCPF } from '../utils/formatters';
import { useToast, ToastContainer } from './Toast';

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
    const { toast, showSuccess, showError, hide } = useToast();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('As senhas nao coincidem.');
            showError('As senhas nao coincidem.');
            return;
        }
        const cpfDigits = cpf.replace(/\D/g, '');
        if (cpfDigits.length !== 11) {
            setError('CPF deve ter 11 digitos.');
            showError('CPF deve ter 11 digitos.');
            return;
        }
        if (password.length < 6 || password.length > 12) {
            setError('A senha deve ter entre 6 e 12 caracteres.');
            showError('A senha deve ter entre 6 e 12 caracteres.');
            return;
        }
        if (!fullName.trim()) {
            setError('Nome completo e obrigatorio.');
            showError('Nome completo e obrigatorio.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Formato de email invalido.');
            showError('Formato de email invalido.');
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        const result = await signUp({
            cpf: cpfDigits,
            fullName,
            email,
            password,
            showStoriesPopup: true,
        });

        setIsLoading(false);
        if (result.success) {
            setSuccess(result.message);
            showSuccess('Conta criada com sucesso');
            setTimeout(() => {
                onSignUpSuccess();
            }, 1500);
        } else {
            const msg = result.message || 'Falha ao criar conta.';
            setError(msg);
            showError(msg);
        }
    };

    return (
        <div 
            className="bg-background-dark text-text-dark h-full flex flex-col p-6 sm:p-8 test-signup-page"
            id="signup-page"
            data-testid="signup-page"
            data-cy="signup-page"
            data-playwright="signup-page"
            role="main"
        >
            <header className="mb-8 test-signup-header" id="signup-header" data-testid="signup-header" data-cy="signup-header">
                 <button 
                    onClick={onNavigateToLogin} 
                    className="flex items-center space-x-2 text-subtle-dark hover:text-text-dark mb-4 test-back-button"
                    id="btn-signup-back"
                    name="signup-back-button"
                    data-testid="signup-back-button"
                    data-cy="signup-back-button"
                    data-playwright="signup-back-button"
                    aria-label="Voltar para login"
                    type="button"
                 >
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                 </button>
                <h1 
                    className="text-3xl font-bold text-white test-signup-title" 
                    id="signup-title"
                    data-testid="signup-title"
                    data-cy="signup-title"
                    data-playwright="signup-title"
                >
                    Crie sua conta
                </h1>
                <p 
                    className="text-gray-400 test-signup-subtitle" 
                    id="signup-subtitle"
                    data-testid="signup-subtitle"
                    data-cy="signup-subtitle"
                >
                    É rápido, fácil e seguro.
                </p>
            </header>

            <main 
                className="flex-grow overflow-y-auto no-scrollbar test-signup-main" 
                id="signup-main"
                data-testid="signup-main"
                data-cy="signup-main"
            >
                <form 
                    onSubmit={handleSignUp} 
                    className="space-y-4 test-signup-form" 
                    id="signup-form"
                    name="signup-form"
                    data-testid="signup-form"
                    data-cy="signup-form"
                    data-playwright="signup-form"
                    aria-label="Formulário de cadastro"
                >
                    <div 
                        className="test-field-fullname"
                        id="signup-field-fullname"
                        data-testid="signup-field-fullname"
                        data-cy="signup-field-fullname"
                    >
                        <label htmlFor="signup-fullname" className="block text-sm font-medium text-gray-300">Nome Completo</label>
                        <input 
                            id="signup-fullname"
                            name="fullname"
                            type="text" 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)} 
                            required 
                            className="w-full input-style test-input-fullname"
                            data-testid="signup-input-fullname"
                            data-cy="signup-input-fullname"
                            data-playwright="signup-input-fullname"
                            aria-label="Nome completo"
                            aria-required="true"
                            autoComplete="name"
                            placeholder="Digite seu nome completo"
                        />
                    </div>
                    <div 
                        className="test-field-email"
                        id="signup-field-email"
                        data-testid="signup-field-email"
                        data-cy="signup-field-email"
                    >
                        <label htmlFor="signup-email" className="block text-sm font-medium text-gray-300">E-mail</label>
                        <input 
                            id="signup-email"
                            name="email"
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                            className="w-full input-style test-input-email"
                            data-testid="signup-input-email"
                            data-cy="signup-input-email"
                            data-playwright="signup-input-email"
                            aria-label="E-mail"
                            aria-required="true"
                            autoComplete="email"
                            placeholder="seu.email@exemplo.com"
                        />
                    </div>
                    <div 
                        className="test-field-cpf"
                        id="signup-field-cpf"
                        data-testid="signup-field-cpf"
                        data-cy="signup-field-cpf"
                    >
                        <label htmlFor="signup-cpf" className="block text-sm font-medium text-gray-300">CPF</label>
                        <input 
                            id="signup-cpf"
                            name="cpf"
                            type="text" 
                            value={formatCPF(cpf)} 
                            onChange={(e) => setCpf(e.target.value)} 
                            required 
                            maxLength={14} 
                            className="w-full input-style test-input-cpf"
                            data-testid="signup-input-cpf"
                            data-cy="signup-input-cpf"
                            data-playwright="signup-input-cpf"
                            aria-label="CPF"
                            aria-required="true"
                            autoComplete="off"
                            inputMode="numeric"
                            placeholder="000.000.000-00"
                        />
                    </div>
                    <div 
                        className="test-field-password"
                        id="signup-field-password"
                        data-testid="signup-field-password"
                        data-cy="signup-field-password"
                    >
                        <label htmlFor="signup-password" className="block text-sm font-medium text-gray-300">Senha</label>
                        <input 
                            id="signup-password"
                            name="password"
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                            className="w-full input-style test-input-password"
                            data-testid="signup-input-password"
                            data-cy="signup-input-password"
                            data-playwright="signup-input-password"
                            aria-label="Senha"
                            aria-required="true"
                            autoComplete="new-password"
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>
                     <div 
                        className="test-field-confirm-password"
                        id="signup-field-confirm-password"
                        data-testid="signup-field-confirm-password"
                        data-cy="signup-field-confirm-password"
                    >
                        <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-300">Confirme a Senha</label>
                        <input 
                            id="signup-confirm-password"
                            name="confirm-password"
                            type="password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            required 
                            className="w-full input-style test-input-confirm-password"
                            data-testid="signup-input-confirm-password"
                            data-cy="signup-input-confirm-password"
                            data-playwright="signup-input-confirm-password"
                            aria-label="Confirme a senha"
                            aria-required="true"
                            autoComplete="new-password"
                            placeholder="Digite a senha novamente"
                        />
                    </div>
                    
                    {error && (
                        <div 
                            className="text-sm text-red-400" 
                            data-testid="signup-error-message"
                            role="alert"
                            aria-live="polite"
                        >
                            {error}
                        </div>
                    )}
                    {success && (
                        <div 
                            className="text-sm text-primary" 
                            data-testid="signup-success-message"
                            role="status"
                            aria-live="polite"
                        >
                            {success}
                        </div>
                    )}

                    <div 
                        className="pt-2 test-submit-container" 
                        id="signup-submit-container"
                        data-testid="signup-submit-container"
                        data-cy="signup-submit-container"
                    >
                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 disabled:opacity-50 test-submit-button"
                            id="btn-signup-submit"
                            name="signup-submit"
                            data-testid="signup-submit-button"
                            data-cy="signup-submit-button"
                            data-playwright="signup-submit-button"
                            aria-label={isLoading ? 'Criando conta...' : 'Criar conta'}
                        >
                            {isLoading ? 'Criando conta...' : 'Criar Conta'}
                        </button>
                    </div>
                </form>
            </main>
            <style>{`.input-style { background-color: #1A2C1F; border: 2px solid #1A2C1F; border-radius: 0.5rem; padding: 0.75rem 1rem; margin-top: 0.25rem; color: #E5E7EB; } .input-style:focus { outline: none; box-shadow: 0 0 0 2px #13ec5b; border-color: transparent; }`}</style>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default SignUp;
