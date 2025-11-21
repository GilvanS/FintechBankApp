import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:3001/api/v1';

// Helper para requisições POST, reutilizado nos testes
async function post(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

describe('API Integracao - Reset de Senha e Login', () => {
  const user = {
    fullName: 'Usuario Teste API',
    email: `test-${Date.now()}@test.com`,
    cpf: '00000000000', // CPF mockado
    password: 'Senha@123',
  };

  // O teste está sendo pulado (it.skip) porque o backend ainda não foi implementado.
  // O servidor atual é apenas um placeholder sem as rotas de autenticação.
  it.skip('Fluxo completo de signup, request reset, reset e login', async () => {
    // 1. Signup
    let res = await post('/auth/signup', user);
    expect(res.res.status).toBe(201);

    // 2. Request Reset
    res = await post('/auth/request-reset', { email: user.email });
    expect(res.res.status).toBe(200);
    expect(res.data.message).toBe('Token de reset enviado.'); // Ajustar conforme a resposta real da API
    const resetToken = res.data.token; // Supondo que o token venha na resposta

    // 3. Reset Password
    const newPassword = 'NovaSenha@456';
    res = await post('/auth/reset-password', { token: resetToken, newPassword });
    expect(res.res.status).toBe(200);

    // 4. Login com a nova senha
    res = await post('/auth/login', { email: user.email, password: newPassword });
    expect(res.res.status).toBe(200);
    expect(res.data.token).toBeDefined();
  }, 30000); // Timeout aumentado para 30 segundos
});
