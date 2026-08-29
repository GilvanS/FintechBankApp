import { describe, it, expect, vi } from 'vitest';
import { adminUpdateCreditLimit, adminApproveLimitRequest, adminDenyLimitRequest } from '../services/api';

describe('Integração/Payloads Admin - Limites de Crédito (Massa 44444444444)', () => {
  it('adminUpdateCreditLimit deve enviar payload com totalLimit e availableLimit corretos', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, message: 'Limite do cartao de credito atualizado' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const result = await adminUpdateCreditLimit('444.444.444-44', 15000);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/admin/users/44444444444/credit-limit',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ totalLimit: 15000, availableLimit: 15000 })
      })
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Limite do cartao de credito atualizado');

    fetchSpy.mockRestore();
  });

  it('adminApproveLimitRequest deve sanitizar o CPF antes de enviar a rota de aprovação', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, message: 'Solicitação aprovada' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const result = await adminApproveLimitRequest('444.444.444-44');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/admin/requests/limit/44444444444/approve',
      expect.objectContaining({
        method: 'POST'
      })
    );

    expect(result.success).toBe(true);

    fetchSpy.mockRestore();
  });
});
