import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ResetPassword() {
  const [cpf, setCpf] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, '') }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('sent');
        setMessage(data.message || 'Solicitação enviada ao administrador.');
      } else {
        setStatus('error');
        setMessage(data.message || 'CPF não encontrado.');
      }
    } catch {
      setStatus('error');
      setMessage('Erro de conexão. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="modal-card w-full max-w-sm p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black font-display">Recuperar Senha</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Informe seu CPF para solicitar uma nova senha
          </p>
        </div>

        {status === 'sent' ? (
          <div className="space-y-4 text-center">
            <p className="font-bold text-sm">{message}</p>
            <Link to="/login" className="btn-primary block py-3 rounded-xl text-sm text-center">
              VOLTAR AO LOGIN
            </Link>
          </div>
        ) : (
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

            {status === 'error' && (
              <p className="text-red-500 text-sm font-bold">{message}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn-primary w-full py-3 rounded-xl text-sm"
            >
              {status === 'loading' ? 'ENVIANDO...' : 'SOLICITAR NOVA SENHA'}
            </button>
          </form>
        )}

        <p className="text-center text-sm">
          <Link to="/login" className="text-on-surface-variant hover:underline">← Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
}
