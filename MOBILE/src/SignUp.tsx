import { ArrowLeft } from 'lucide-react';

import React, { useState } from 'react';
import { useToast, ToastContainer } from './components/Toast';
import { signUp } from './services/api';
import { formatCPF } from './utils/formatters';

interface SignUpProps {
  onNavigateToLogin: () => void;
  onSignUpSuccess: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onNavigateToLogin, onSignUpSuccess }) => {
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast, showSuccess, showError, hide } = useToast();


  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    
    // Remover formatação e validar CPF (igual ao WEB que está funcionando)
    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
        setError('CPF deve ter 11 dígitos.');
        return;
    }
    
    // Validar senha (igual ao WEB)
    if (password.length < 6 || password.length > 12) {
        setError('A senha deve ter entre 6 e 12 caracteres.');
        return;
    }
    
    // Validar nome completo (igual ao WEB)
    if (!fullName.trim()) {
        setError('Nome completo é obrigatório.');
        return;
    }
    
    // Validar email (igual ao WEB)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Formato de email inválido.');
        return;
    }

    setLoading(true);
    setError(''); // Limpar erro anterior
    
    try {
        console.log('🔵 [SignUp Component] Iniciando cadastro...');
      const result = await signUp({ cpf: cpfDigits, fullName, email, password });
        console.log('🔵 [SignUp Component] Resultado recebido:', result);
        
        if (result.success) {
          console.log('✅ [SignUp Component] Cadastro bem-sucedido!');
          setError(''); // Limpar qualquer erro
          showSuccess('Cadastro realizado com sucesso! Redirecionando para o login.');
          setTimeout(() => {
            console.log('🔵 [SignUp Component] Redirecionando para login...');
            onSignUpSuccess();
          }, 2000);
        } else {
          console.log('❌ [SignUp Component] Cadastro falhou:', result.message);
          const errorMessage = result.message || 'Ocorreu um erro no cadastro.';
          setError(errorMessage);
          showError(errorMessage);
        }
    } catch (err: any) {
      console.error('❌ [SignUp Component] Exceção capturada:', err);
      const errorMessage = err?.message || 'Falha ao conectar com o servidor.';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
      console.log('🔵 [SignUp Component] Loading finalizado');
    }
  };

  return (
    <>
      <ToastContainer toast={toast} onClose={hide} />
      <div 
        className="font-display bg-background-dark text-text-dark antialiased min-h-screen flex flex-col"
        data-testid="signup-screen"
        id="signup-screen"
      >
        <header 
          className="w-full p-4 safe-top"
          data-testid="signup-header"
          id="signup-header"
        >
          <button 
            onClick={onNavigateToLogin} 
            className="text-subtle-dark hover:text-primary"
            data-testid="signup-back-button"
            id="btn-signup-back"
            aria-label="Voltar para login"
          >
            <ArrowLeft size={22} className="shrink-0" />
          </button>
        </header>
        
        <main 
          className="flex-grow flex flex-col items-center justify-center p-4"
          data-testid="signup-main"
          id="signup-main"
        >
          <h1 
            className="text-3xl font-bold text-text-dark mb-2"
            data-testid="signup-title"
            id="signup-title"
          >
            Crie sua Conta
          </h1>
          <p 
            className="text-subtle-dark mb-10"
            data-testid="signup-subtitle"
            id="signup-subtitle"
          >
            É rápido e fácil.
          </p>
          
          <form 
            onSubmit={handleSignUp}
            data-testid="signup-form"
            id="signup-form"
            className="w-full max-w-sm"
          >
            <label 
              htmlFor="signup-fullname-input" 
              className="text-sm font-medium text-subtle-dark mb-1 block"
              data-testid="signup-fullname-label"
              id="signup-fullname-label"
            >
              Nome Completo
            </label>
            <input 
              id="signup-fullname-input"
              data-testid="signup-input-fullname"
              name="fullName"
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              required 
              className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              aria-label="signup-input-fullname"
              aria-required="true"
              placeholder="Digite seu nome completo"
            />
            
            <label 
              htmlFor="signup-cpf-input" 
              className="text-sm font-medium text-subtle-dark mb-1 block"
              data-testid="signup-cpf-label"
              id="signup-cpf-label"
            >
              CPF
            </label>
            <input 
              id="signup-cpf-input"
              data-testid="signup-input-cpf"
              name="cpf"
              type="text" 
              value={formatCPF(cpf)} 
              onChange={(e) => setCpf(e.target.value)} 
              required 
              inputMode="numeric" 
              placeholder="999.999.999-99" 
              maxLength={14}
              className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              aria-label="signup-input-cpf"
              aria-required="true"
              autoComplete="off"
            />
            
            <label 
              htmlFor="signup-email-input" 
              className="text-sm font-medium text-subtle-dark mb-1 block"
              data-testid="signup-email-label"
              id="signup-email-label"
            >
              Email
            </label>
            <input 
              id="signup-email-input"
              data-testid="signup-input-email"
              name="email"
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="voce@email.com" 
              className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              aria-label="signup-input-email"
              aria-required="true"
            />
            
            <label 
              htmlFor="signup-password-input" 
              className="text-sm font-medium text-subtle-dark mb-1 block"
              data-testid="signup-password-label"
              id="signup-password-label"
            >
              Senha
            </label>
            <input 
              id="signup-password-input"
              data-testid="signup-input-password"
              name="password"
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••" 
              className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              aria-label="signup-input-password"
              aria-required="true"
            />
            
            <label 
              htmlFor="signup-confirm-password-input" 
              className="text-sm font-medium text-subtle-dark mb-1 block"
              data-testid="signup-confirm-password-label"
              id="signup-confirm-password-label"
            >
              Confirmar Senha
            </label>
            <input 
              id="signup-confirm-password-input"
              data-testid="signup-input-confirm-password"
              name="confirmPassword"
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
              placeholder="••••••••" 
              className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              aria-label="signup-input-confirm-password"
              aria-required="true"
            />
            
            {error && (
              <p 
                className="text-red-500 text-sm text-center mt-4"
                data-testid="signup-error-message"
                id="signup-error-message"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </p>
            )}
            
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full px-8 py-4 font-semibold text-white transition-transform duration-300 transform rounded-lg shadow-lg bg-primary hover:scale-105 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/50 disabled:bg-primary/70 disabled:scale-100 mt-8"
              data-testid="signup-submit-button"
              id="btn-signup-submit"
              name="btn-signup-submit"
              aria-label={loading ? 'Cadastrando...' : 'Cadastrar'}
              title="Cadastrar - Botão para criar nova conta"
            >
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
            
            <p 
              className="text-center text-sm text-subtle-dark mt-6"
              data-testid="signup-login-section"
            >
              Já tem uma conta?{' '}
              <button 
                type="button" 
                onClick={onNavigateToLogin} 
                className="font-semibold text-primary hover:underline"
                data-testid="signup-login-link"
                id="link-signup-login"
                aria-label="Faça Login"
              >
                Faça Login
              </button>
            </p>
          </form>
        </main>
      </div>
    </>
  );
};

export default SignUp;
