import React, { useState } from 'react';
import { signUp } from '../services/api';

interface SignUpProps {
  onSignUpSuccess: () => void;
  onNavigateToLogin: () => void;
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

    setIsLoading(true);
    setError('');

    const result = await signUp({
      fullName,
      cpf,
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
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-lg dark:bg-gray-800">
        <Logo />
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white">Criar nova conta</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome Completo</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome completo"
              required
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          </div>
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
            <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              required
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
              placeholder="Entre 6 e 12 caracteres"
              minLength={6}
              maxLength={12}
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          </div>
           <div>
            <label htmlFor="confirmPassword"  className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmar Senha</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              className="w-full px-4 py-2 mt-2 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transition-colors"
            >
              {isLoading ? 'Criando conta...' : 'Cadastrar'}
            </button>
          </div>
           <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            Já tem uma conta?{' '}
            <button type="button" onClick={onNavigateToLogin} className="font-medium text-blue-500 hover:underline">
              Faça login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignUp;