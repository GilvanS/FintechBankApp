// Componente Login (handleLogin com try/catch para evitar travar em 'Entrando...')
import React, { useState } from 'react';
import { User } from '../types';
import { login, requestNewPassword } from '../services/mockApi';

interface LoginProps {
  onLogin: (user: Omit<User, 'password'>) => void;
  onNavigateToSignUp: () => void;
}

const Logo: React.FC = () => (
    <div className="flex items-center justify-center mb-8">
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21a9 9 0 100-18 9 9 0 000 18z"></path>
        </svg>
        <span className="ml-3 text-3xl font-bold text-gray-800 dark:text-white">Fintech</span>
    </div>
);

const Login: React.FC<LoginProps> = ({ onLogin, onNavigateToSignUp }) => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validação do frontend
    if (cpf.length !== 11) {
      setError('O CPF deve conter exatamente 11 dígitos numéricos.');
      return;
    }
    if (password.length < 6 || password.length > 12) {
      setError('A senha deve ter entre 6 e 12 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(cpf, password);
      setIsLoading(false);

      if (result.success && result.user) {
        onLogin(result.user);
      } else {
        setError(result.message || 'Falha ao entrar. Tente novamente.');
        if (result.message && result.message.includes('bloqueada')) {
          setIsBlocked(true);
        }
      }
    } catch (err) {
      setIsLoading(false);
      setError('Falha de conexao com o servidor. Tente novamente em instantes.');
    }
  };

  const handlePasswordReset = async () => {
      setIsLoading(true);
      setError('');
      setResetMessage('');
      const result = await requestNewPassword(cpf);
      setIsLoading(false);
      setResetMessage(result.message);
      if(!result.success){
        setError(result.message);
      }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-lg dark:bg-gray-800">
        <Logo />
        {isBlocked ? (
            <div className="text-center">
                <h2 className="text-2xl font-bold text-red-500">Conta Bloqueada</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Sua conta foi bloqueada por motivos de segurança. Para desbloqueá-la, por favor, solicite uma nova senha.</p>
                <input
                    id="cpf-blocked"
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))}
                    placeholder="Confirme seu CPF aqui"
                    required
                    maxLength={11}
                    className="w-full px-3 py-2 mt-4 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
                {resetMessage && <p className={`mt-4 text-sm font-medium ${resetMessage.includes('enviada') ? 'text-green-500' : 'text-red-500'}`}>{resetMessage}</p>}
                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                <button
                    onClick={handlePasswordReset}
                    disabled={isLoading || !cpf}
                    className="w-full mt-6 px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transition-colors"
                >
                    {isLoading ? 'Solicitando...' : 'Solicitar Nova Senha'}
                </button>
                 <button onClick={() => setIsBlocked(false)} className="mt-4 text-sm text-blue-500 hover:underline">Voltar para o Login</button>
            </div>
        ) : (
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="cpf" className="text-sm font-medium text-gray-700 dark:text-gray-300">CPF</label>
            <input
              id="cpf"
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))}
              placeholder="Apenas números"
              required
              maxLength={11}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          </div>
          <div>
            <label htmlFor="password"  className="text-sm font-medium text-gray-700 dark:text-gray-300">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              maxLength={12}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transition-colors"
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
           <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            Não tem uma conta?{' '}
            <button type="button" onClick={onNavigateToSignUp} className="font-medium text-blue-500 hover:underline">
              Cadastre-se
            </button>
          </p>
        </form>
        )}
      </div>
    </div>
  );
};

export default Login;