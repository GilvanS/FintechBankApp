import React, { useState } from 'react';
import { signUp } from '../services/mockApi';
import { formatCPF } from '../utils/formatters';

interface SignUpProps {
  onSignUpSuccess: () => void;
  onNavigateToLogin: () => void;
}


const Logo: React.FC = () => (
    <div className="flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21a9 9 0 100-18 9 9 0 000 18z"></path>
        </svg>
        <span className="ml-3 text-2xl font-bold text-white">Fintech</span>
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
     <div className="min-h-screen flex flex-col bg-gray-100">
        <header className="bg-orange-500 p-6">
            <Logo />
        </header>
        <main className="flex-grow flex items-center justify-center">
            <div className="w-full max-w-md bg-white rounded-lg shadow-md -mt-16 p-8">
                 <h2 className="text-3xl font-bold text-gray-800 mb-6">Criar conta</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-700">Nome Completo</label>
                    <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">CPF</label>
                    <input
                    type="text"
                    value={formatCPF(cpf)}
                    onChange={(e) => setCpf(e.target.value)}
                    required
                    maxLength={14}
                    className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">E-mail</label>
                    <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Senha</label>
                    <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    maxLength={12}
                    className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Confirmar Senha</label>
                    <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md"
                    />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
                
                <div>
                    <button type="submit" disabled={isLoading} className="w-full py-3 mt-2 font-semibold text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:bg-orange-300">
                    {isLoading ? 'Criando...' : 'Cadastrar'}
                    </button>
                </div>
                </form>
                 <p className="text-sm text-center text-gray-600 mt-6">
                    Já tem uma conta?{' '}
                    <button type="button" onClick={onNavigateToLogin} className="font-semibold text-orange-600 hover:underline">
                    Faça login
                    </button>
                </p>
            </div>
        </main>
    </div>
  );
};

export default SignUp;