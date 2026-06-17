import { describe, it, expect } from 'vitest';

const BASE = process.env.TEST_API_URL || 'http://localhost:3001/api';
const cpf = '11111111111';
const email = 'test11111111111@example.com';

async function post(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

describe('API Integracao - Reset de Senha e Login', () => {
  it('Fluxo completo de signup, request reset, reset e login', async () => {
    // Signup (idempotente)
    let { res, data } = await post('/auth/signup', { fullName: 'Teste Usuario', cpf, email, password: 'senha123' });
    if (!res.ok) {
      expect(['CPF ou email ja cadastrado.', 'Falha ao criar conta.']).toContain(data.message);
    }

    // Solicitar reset — retorna devToken em NODE_ENV !== 'production'
    ({ res, data } = await post('/auth/request-password-reset', { cpf }));
    expect(res.ok).toBe(true);
    expect(data.success).toBe(true);
    const devToken = data.devToken;
    expect(devToken).toBeDefined();

    // Resetar com OTP criptografico retornado pelo servidor
    ({ res, data } = await post('/auth/reset-password', { cpf, token: devToken, newPassword: 'nova123' }));
    expect(res.ok).toBe(true);
    expect(data.success).toBe(true);

    // Login com nova senha
    ({ res, data } = await post('/auth/login', { cpf, password: 'nova123' }));
    expect(res.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.token).toBeDefined();
    expect(data.user?.cpf).toBe(cpf);
  });
});