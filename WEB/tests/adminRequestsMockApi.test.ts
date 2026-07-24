import { describe, it, expect } from 'vitest';
import * as mockApi from '../services/mockApi';

/**
 * Contrato do painel "Solicitações" (RequestsManagement.tsx).
 *
 * Em modo demo o Vite troca '../../services/api' por 'mockApi.ts'. Se qualquer
 * uma das funções admin importadas pelo componente não for exportada aqui, o
 * import vira `undefined`, `Promise.all` em fetchRequests rejeita e o painel
 * exibe "Erro ao carregar solicitações" (o bug que deixava o dashboard em 0/1).
 *
 * Estes testes travam esse contrato.
 */
const REQUIRED_ADMIN_EXPORTS = [
  'adminGetPasswordRequests',
  'adminApprovePasswordRequest',
  'adminDenyPasswordRequest',
  'adminGetLimitRequests',
  'adminApproveLimitRequest',
  'adminDenyLimitRequest',
  'adminGetOverdueMasses',
] as const;

describe('mockApi — contrato do painel Solicitações', () => {
  it('exporta todas as funções admin usadas por RequestsManagement', () => {
    for (const fn of REQUIRED_ADMIN_EXPORTS) {
      expect(typeof (mockApi as any)[fn], `mockApi.${fn} deve ser uma função`).toBe('function');
    }
  });

  it('adminGetOverdueMasses retorna o shape esperado (success/stats/overdueMasses)', async () => {
    const result = await (mockApi as any).adminGetOverdueMasses();
    expect(result).toBeTruthy();
    expect(result.success).toBe(true);
    expect(result.stats).toBeTruthy();
    expect(typeof result.stats.totalUsers).toBe('number');
    expect(typeof result.stats.overdueCount).toBe('number');
    expect(Array.isArray(result.overdueMasses)).toBe(true);
    expect(result.overdueMasses.length).toBe(result.stats.overdueCount);
  });

  it('cada massa em atraso tem os campos que o painel renderiza', async () => {
    const { overdueMasses } = await (mockApi as any).adminGetOverdueMasses();
    for (const m of overdueMasses) {
      expect(typeof m.cpf).toBe('string');
      expect(typeof m.fullName).toBe('string');
      expect(typeof m.daysOverdue).toBe('number');
      expect(typeof m.totalQuitacao).toBe('number');
      expect(m.encargos).toBeTruthy();
      expect(typeof m.encargos.totalEncargos).toBe('number');
    }
  });
});
