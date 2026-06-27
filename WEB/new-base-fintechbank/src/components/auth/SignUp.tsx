import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', cpf: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === 'cpf' ? formatCpf(e.target.value) : e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          cpf: form.cpf.replace(/\D/g, ''),
          email: form.email,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (data.success) {
        navigate('/login');
      } else {
        setError(data.message || 'Erro ao criar conta.');
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
          <h1 className="text-3xl font-black font-display tracking-tight">Criar Conta</h1>
          <p className="text-on-surface-variant text-sm mt-1">Junte-se ao Volt</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { field: 'fullName', label: 'Nome Completo', type: 'text', placeholder: 'Seu nome' },
            { field: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00' },
            { field: 'email', label: 'E-mail', type: 'email', placeholder: 'seu@email.com' },
            { field: 'password', label: 'Senha', type: 'password', placeholder: '••••••••' },
            { field: 'confirm', label: 'Confirmar Senha', type: 'password', placeholder: '••••••••' },
          ].map(({ field, label, type, placeholder }) => (
            <div key={field} className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider">{label}</label>
              <input
                type={type}
                value={form[field as keyof typeof form]}
                onChange={set(field)}
                placeholder={placeholder}
                required
                className="w-full px-4 py-3"
              />
            </div>
          ))}

          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 rounded-xl text-sm"
          >
            {loading ? 'CRIANDO...' : 'CRIAR CONTA'}
          </button>
        </form>

        <p className="text-center text-sm">
          <Link to="/login" className="font-black">← Já tenho conta</Link>
        </p>
      </div>
    </div>
  );
}
