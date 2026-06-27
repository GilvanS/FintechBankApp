import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, AuthUser } from '../../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ''), password }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const authUser: AuthUser = {
          cpf: data.user.cpf,
          fullName: data.user.fullName,
          email: data.user.email,
          avatarUrl: data.user.avatarUrl,
          role: data.user.role ?? 'user',
          balance: data.user.balance ?? 0,
        };
        login(authUser);
        navigate('/dashboard', { replace: true });
      } else {
        setError(data.message || 'CPF ou senha inválidos');
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="modal-card w-full max-w-sm p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black font-display tracking-tight">VOLT</h1>
          <p className="text-on-surface-variant text-sm mt-1">Banco Digital</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider">CPF</label>
            <input
              type="text"
              value={cpf}
              onChange={e => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              required
              className="w-full px-4 py-3"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm font-bold">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 rounded-xl text-sm"
          >
            {loading ? 'ENTRANDO...' : 'ENTRAR'}
          </button>
        </form>

        <div className="text-center space-y-2 text-sm">
          <Link to="/reset-password" className="block text-on-surface-variant hover:underline">
            Esqueci minha senha
          </Link>
          <Link to="/signup" className="block font-black">
            Criar conta →
          </Link>
        </div>
      </div>
    </div>
  );
}
