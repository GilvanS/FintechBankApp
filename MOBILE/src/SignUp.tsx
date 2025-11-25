
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
    
    const unformattedCpf = cpf.replace(/\D/g, '');
    if (unformattedCpf.length !== 11) {
        setError('CPF deve ter 11 numeros.');
        return;
    }

    setLoading(true);
    setError(''); // Limpar erro anterior
    
    try {
        console.log('🔵 [SignUp Component] Iniciando cadastro...');
      const result = await signUp({ fullName, cpf: unformattedCpf, email, password, showStoriesPopup: true });
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
      <div className="font-display bg-background-dark text-text-dark antialiased">
          <div className="flex flex-col min-h-screen">
              <header className="w-full p-4 safe-top">
                <div className="w-full max-w-sm mx-auto flex justify-start mt-2">
                  <button onClick={onNavigateToLogin} className="text-subtle-dark hover:text-primary">
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                  </button>
                </div>
              </header>
              <main className="flex-grow flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm mx-auto">
                  <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-text-dark">Crie sua Conta</h1>
                    <p className="text-subtle-dark mt-2">É rápido e fácil.</p>
                  </div>
                  <form onSubmit={handleSignUp}>
                      <div className="space-y-4">
                          <div>
                            <label htmlFor="fullName" className="text-sm font-medium text-subtle-dark mb-1 block">Nome Completo</label>
                            <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"/>
                          </div>
                          <div>
                            <label htmlFor="cpf" className="text-sm font-medium text-subtle-dark mb-1 block">CPF</label>
                            <input id="cpf" type="text" value={formatCPF(cpf)} onChange={(e) => setCpf(e.target.value)} required inputMode="numeric" placeholder="999.999.999-99" className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"/>
                          </div>
                          <div>
                            <label htmlFor="email" className="text-sm font-medium text-subtle-dark mb-1 block">Email</label>
                            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@email.com" className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"/>
                          </div>
                          <div>
                            <label htmlFor="password" className="text-sm font-medium text-subtle-dark mb-1 block">Senha</label>
                            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"/>
                          </div>
                          <div>
                            <label htmlFor="confirmPassword" className="text-sm font-medium text-subtle-dark mb-1 block">Confirmar Senha</label>
                            <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"/>
                          </div>
                      </div>
                      {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
                      <div className="mt-8">
                          <button type="submit" disabled={loading} className="w-full px-8 py-4 font-semibold text-white transition-transform duration-300 transform rounded-lg shadow-lg bg-primary hover:scale-105 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/50 disabled:bg-primary/70 disabled:scale-100">
                            {loading ? 'Cadastrando...' : 'Cadastrar'}
                          </button>
                      </div>
                      <p className="text-center text-sm text-subtle-dark mt-6">
                          Já tem uma conta? <button type="button" onClick={onNavigateToLogin} className="font-semibold text-primary hover:underline">Faça Login</button>
                      </p>
                  </form>
                </div>
              </main>
          </div>
      </div>
    </>
  );
};

export default SignUp;
