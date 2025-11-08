
import React, { useState } from 'react';
import { useAuth } from '../App';
import { login } from '../services/mockApi';
import { formatCPF } from '../utils/formatters';
import LoginNewsBanner from './LoginNewsBanner';

interface LoginProps {
  onNavigateToSignUp: () => void;
  onNavigateToPreLogin: () => void;
}

const Logo: React.FC = () => (
    <div className="flex items-center justify-center mb-10">
        <svg className="w-10 h-10 text-green-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
        <span className="ml-3 text-3xl font-bold text-white tracking-wider">Fintech</span>
    </div>
);


const Login: React.FC<LoginProps> = ({ onNavigateToSignUp, onNavigateToPreLogin }) => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login: authLogin } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const result = await login(cpf.replace(/\D/g, ''), password);
    setIsLoading(false);
    if (result.success && result.user) {
      authLogin(result.user);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-black p-6">
        <header className="absolute top-6 left-6">
            <Logo />
        </header>
        <main className="flex-grow flex flex-col justify-center">
            <h2 className="text-3xl font-bold text-white mb-8">acesse sua conta</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="text-sm font-medium text-gray-400">CPF</label>
                <input
                    type="text"
                    value={formatCPF(cpf)}
                    onChange={(e) => setCpf(e.target.value)}
                    required
                    maxLength={14}
                    className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>
            <div>
                <label className="text-sm font-medium text-gray-400">Senha</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>
            
            {error && <p className="text-sm text-red-400">{error}</p>}

            <div>
                <button type="submit" disabled={isLoading} className="w-full py-3 mt-2 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-green-700">
                    {isLoading ? 'Entrando...' : 'Entrar'}
                </button>
            </div>
            </form>
            <div className="text-center mt-6 space-y-3">
                <button type="button" onClick={() => alert('Funcionalidade de esqueci a senha em desenvolvimento')} className="text-sm font-semibold text-green-400 hover:underline">
                    Esqueci minha senha
                </button>
                 <p className="text-sm text-gray-400">
                    Não tem uma conta?{' '}
                    <button type="button" onClick={onNavigateToSignUp} className="font-semibold text-green-400 hover:underline">
                        Cadastre-se
                    </button>
                </p>
                <p className="text-sm text-gray-400">
                    <button type="button" onClick={onNavigateToPreLogin} className="font-semibold text-green-400 hover:underline">
                        Voltar
                    </button>
                </p>
            </div>
        </main>
        <footer className="pb-4">
            <LoginNewsBanner />
        </footer>
    </div>
  );
};

export default Login;
