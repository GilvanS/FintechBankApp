
import React, { useState } from 'react';
import { signUp } from '../services/mockApi';
import { formatCPF } from '../utils/formatters';

interface SignUpProps {
  onSignUpSuccess: () => void;
  onNavigateToLogin: () => void;
}


const Logo: React.FC = () => (
    <div className="flex items-center justify-center mb-10">
        <svg className="w-10 h-10 text-green-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
        <span className="ml-3 text-3xl font-bold text-white tracking-wider">Fintech</span>
    </div>
);

const SignUp: React.FC<SignUpProps> = ({ onSignUpSuccess, onNavigateToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    
    if (password.length < 6 || password.length > 12) {
      setError('A senha deve ter entre 6 e 12 caracteres.');
      return;
    }

    if(fullName.trim().split(' ').length < 2) {
      setError('Por favor, insira seu nome completo.');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await signUp({
      fullName,
      cpf: cpf.replace(/\D/g, ''),
      email,
      password,
    });
    
    setIsLoading(false);

    if (result.success) {
      alert(result.message);
      onSignUpSuccess();
    } else {
      setError(result.message);
    }
  };

  return (
     <div className="min-h-screen flex flex-col justify-center bg-black p-6">
        <header className="absolute top-6 left-6">
            <Logo />
        </header>
        <main>
            <h2 className="text-3xl font-bold text-white mb-8">Criar conta</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="text-sm font-medium text-gray-400">Nome Completo</label>
                <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>
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
                <label className="text-sm font-medium text-gray-400">E-mail</label>
                <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                minLength={6}
                maxLength={12}
                className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>
            <div>
                <label className="text-sm font-medium text-gray-400">Confirmar Senha</label>
                <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            
            <div>
                <button type="submit" disabled={isLoading} className="w-full py-3 mt-2 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-green-700">
                {isLoading ? 'Criando...' : 'Cadastrar'}
                </button>
            </div>
            </form>
            <p className="text-sm text-center text-gray-400 mt-6">
                Já tem uma conta?{' '}
                <button type="button" onClick={onNavigateToLogin} className="font-semibold text-green-400 hover:underline">
                Faça login
                </button>
            </p>
        </main>
    </div>
  );
};

export default SignUp;