/**
 * Teste Unitário — Sincronização de dias_atraso nas invoices
 *
 * O index.cjs não exporta módulos (roda bootstrap/cron ao ser importado).
 * Seguindo o padrão de tests/billingEngine.test.js, a lógica do UPDATE é
 * reproduzida aqui como função standalone.
 *
 * Lógica testada (extraída de runBillingValidation + syncInvoiceDiasAtraso):
 *   UPDATE invoices
 *   SET dias_atraso = GREATEST(0, (CURRENT_DATE - due_date::date))
 *   WHERE status = 'FECHADA'
 *     AND data_pagamento IS NULL
 *     AND due_date < CURRENT_DATE -- no SQL usa CURRENT_TIMESTAMP
 *     AND COALESCE(dias_atraso, -1) != GREATEST(0, (CURRENT_DATE - due_date::date))
 *
 * Para evitar flakiness com datas reais, as funções aceitam um parâmetro
 * opcional `refDate` que fixa a "data atual" da consulta.
 */

// ─── Helper: simula o cálculo SQL GREATEST(0, (CURRENT_DATE - due_date::date)) ──
// Em SQL PostgreSQL: CURRENT_DATE - due_date::date retorna um inteiro (dias).
// Em JS: diferença em milissegundos entre refDate (00:00) e dueDate (00:00).
function calcularDiasCorretos(dueDate, refDate) {
  const hoje = refDate ? new Date(refDate) : new Date();
  hoje.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffMs = hoje.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

// ─── Helper: simula o UPDATE condicional em memória ──
// Retorna { atualizadas, invoices } após aplicar a lógica de sincronização.
// Aceita refDate opcional para testes determinísticos.
function syncDiasAtraso(invoices, refDate) {
  const hoje = refDate ? new Date(refDate) : new Date();
  let atualizadas = 0;
  const result = invoices.map((inv) => {
    const diasCorretos = calcularDiasCorretos(inv.dueDate, refDate);

    // Condições do WHERE: FECHADA + não paga + vencida + desatualizada
    // Nota: em SQL, due_date < CURRENT_TIMESTAMP, então invoices com due_date = hoje
    // (meia-noite) ainda são elegíveis se CURRENT_TIMESTAMP já passou da meia-noite.
    const elegivel =
      inv.status === 'FECHADA' &&
      !inv.dataPagamento &&
      new Date(inv.dueDate) <= hoje &&
      (inv.diasAtual ?? -1) !== diasCorretos;

    if (elegivel) {
      atualizadas++;
      return { ...inv, diasAtual: diasCorretos, updatedAt: hoje };
    }
    return inv;
  });

  return { atualizadas, invoices: result };
}

// ─── Factory de invoice mock ──
const HOJE = '2026-07-27T12:00:00.000Z';

function makeInvoice(overrides = {}) {
  return {
    id: 'inv-001',
    cpf: '12345678901',
    status: 'FECHADA',
    dueDate: '2026-07-10',
    dataPagamento: null,
    diasAtual: 5,
    ...overrides,
  };
}

// ─── Suite de Testes ──────────────────────────────────────────────────────────

describe('Sincronização de dias_atraso nas invoices', () => {
  // Todas as chamadas usam refDate='2026-07-27' para consistência

  // ── Caso 1: Invoice desatualizada é corrigida ──
  describe('Caso 1: Invoice desatualizada é corrigida', () => {
    it('atualiza dias_atraso de 5 para 17 quando due_date é 2026-07-10 e refDate é 2026-07-27', () => {
      const ref = '2026-07-27';
      const inv = makeInvoice({ dueDate: '2026-07-10', diasAtual: 5 });
      expect(calcularDiasCorretos(inv.dueDate, ref)).toBe(17);

      const { atualizadas, invoices } = syncDiasAtraso([inv], ref);
      expect(atualizadas).toBe(1);
      expect(invoices[0].diasAtual).toBe(17);
    });

    it('suporta due_date no início do mês (ex: due_date=2026-07-01, dias=26)', () => {
      const ref = '2026-07-27';
      const inv = makeInvoice({ dueDate: '2026-07-01', diasAtual: 0 });
      expect(calcularDiasCorretos(inv.dueDate, ref)).toBe(26);

      const { atualizadas, invoices } = syncDiasAtraso([inv], ref);
      expect(atualizadas).toBe(1);
      expect(invoices[0].diasAtual).toBe(26);
    });

    it('retorna 0 dias para due_date igual a refDate (sem atraso)', () => {
      const ref = '2026-07-27';
      const inv = makeInvoice({ dueDate: '2026-07-27', diasAtual: 99 });
      expect(calcularDiasCorretos(inv.dueDate, ref)).toBe(0);

      const { atualizadas, invoices } = syncDiasAtraso([inv], ref);
      expect(atualizadas).toBe(1);  // 99 → 0, então é atualizada
      expect(invoices[0].diasAtual).toBe(0);
    });
  });

  // ── Caso 2: Invoice já correta NÃO é alterada ──
  describe('Caso 2: Invoice já correta NÃO é alterada', () => {
    it('não atualiza quando dias_atraso já está correto', () => {
      const ref = '2026-07-27';
      const inv = makeInvoice({ dueDate: '2026-07-10', diasAtual: 17 });
      const { atualizadas, invoices } = syncDiasAtraso([inv], ref);
      expect(atualizadas).toBe(0);
      expect(invoices[0].diasAtual).toBe(17);
    });

    it('não atualiza quando dias_atraso = 0 e due_date = hoje (já correto)', () => {
      const ref = '2026-07-27';
      const inv = makeInvoice({ dueDate: '2026-07-27', diasAtual: 0 });
      const { atualizadas } = syncDiasAtraso([inv], ref);
      expect(atualizadas).toBe(0);
    });
  });

  // ── Caso 3: Filtros WHERE corretos ──
  describe('Caso 3: Filtros WHERE — invoices excluídas da sincronização', () => {
    const ref = '2026-07-27';

    it('NÃO atualiza invoice com status ABERTA (não FECHADA)', () => {
      const inv = makeInvoice({ status: 'ABERTA', diasAtual: 5 });
      const { atualizadas } = syncDiasAtraso([inv], ref);
      expect(atualizadas).toBe(0);
    });

    it('NÃO atualiza invoice já paga (dataPagamento preenchido)', () => {
      const inv = makeInvoice({
        diasAtual: 5,
        dataPagamento: '2026-07-20',
      });
      const { atualizadas } = syncDiasAtraso([inv], ref);
      expect(atualizadas).toBe(0);
    });

    it('NÃO atualiza invoice com due_date no futuro', () => {
      const inv = makeInvoice({ dueDate: '2026-08-15', diasAtual: 0 });
      const { atualizadas } = syncDiasAtraso([inv], ref);
      expect(atualizadas).toBe(0);
    });

    it('NÃO atualiza invoice com due_date = hoje quando o valor já está correto (= 0)', () => {
      // due_date hoje é < CURRENT_TIMESTAMP, então a invoice É elegível.
      // Mas como diasAtual=0 e valor correto=0, a condição COALESCE impede o UPDATE.
      const inv = makeInvoice({ dueDate: '2026-07-27', diasAtual: 0 });
      const { atualizadas } = syncDiasAtraso([inv], ref);
      expect(atualizadas).toBe(0);
    });
  });

  // ── Caso 4: Múltiplas invoices — só as desatualizadas são corrigidas ──
  describe('Caso 4: Múltiplas invoices — correção seletiva', () => {
    const ref = '2026-07-27';

    it('corrige apenas as invoices desatualizadas em um lote misto', () => {
      const invoices = [
        makeInvoice({ id: 'inv-001', dueDate: '2026-07-10', diasAtual: 5 }),  // desatualizada → corrigida
        makeInvoice({ id: 'inv-002', dueDate: '2026-07-10', diasAtual: 17 }), // já correta → não mexe
        makeInvoice({ id: 'inv-003', status: 'ABERTA', dueDate: '2026-07-10', diasAtual: 5 }), // não FECHADA → não mexe
        makeInvoice({ id: 'inv-004', dueDate: '2026-07-10', diasAtual: 0 }),  // desatualizada (0≠17)
        makeInvoice({ id: 'inv-005', dueDate: '2026-08-01', diasAtual: 0 }),  // futuro → não mexe
        makeInvoice({ id: 'inv-006', dueDate: '2026-07-10', dataPagamento: '2026-07-15', diasAtual: 17 }), // paga → não mexe
      ];

      const { atualizadas, invoices: result } = syncDiasAtraso(invoices, ref);

      expect(atualizadas).toBe(2); // inv-001 (5→17) e inv-004 (0→17)
      expect(result.find((i) => i.id === 'inv-001').diasAtual).toBe(17);
      expect(result.find((i) => i.id === 'inv-004').diasAtual).toBe(17);

      // Demais inalteradas
      expect(result.find((i) => i.id === 'inv-002').diasAtual).toBe(17);
      expect(result.find((i) => i.id === 'inv-003').diasAtual).toBe(5);
      expect(result.find((i) => i.id === 'inv-005').diasAtual).toBe(0);
      expect(result.find((i) => i.id === 'inv-006').diasAtual).toBe(17);
    });
  });

  // ── Caso 5: Cálculo de GREATEST(0, ...) — proteção contra datas futuras ──
  describe('Caso 5: GREATEST(0, ...) — proteção contra datas futuras', () => {
    const ref = '2026-07-27';

    it('nunca retorna dias negativos', () => {
      expect(calcularDiasCorretos('2026-08-15', ref)).toBe(0);
      expect(calcularDiasCorretos('2026-12-31', ref)).toBe(0);
      expect(calcularDiasCorretos('2026-07-28', ref)).toBe(0); // amanhã
    });

    it('retorna 0 para due_date igual a refDate', () => {
      expect(calcularDiasCorretos('2026-07-27', ref)).toBe(0);
    });
  });

  // ── Caso 6: COALESCE(dias_atraso, -1) — proteção contra NULL ──
  describe('Caso 6: COALESCE — proteção contra NULL', () => {
    const ref = '2026-07-27';

    it('trata dias_atraso NULL como -1 (forçando atualização)', () => {
      const inv = makeInvoice({ dueDate: '2026-07-10', diasAtual: undefined });
      const { atualizadas, invoices } = syncDiasAtraso([inv], ref);
      expect(atualizadas).toBe(1);
      expect(invoices[0].diasAtual).toBe(17);
    });
  });

  // ── Caso 7: syncInvoiceDiasAtraso — contagem de retorno ──
  describe('Caso 7: Verificação pós-sync — total e corretas', () => {
    const ref = '2026-07-27';

    it('relata corretamente total e corretas após sincronização', () => {
      const invoices = [
        makeInvoice({ id: 'inv-001', dueDate: '2026-07-10', diasAtual: 5 }),  // vai corrigir
        makeInvoice({ id: 'inv-002', dueDate: '2026-07-10', diasAtual: 17 }), // já correto
        makeInvoice({ id: 'inv-003', dueDate: '2026-07-10', diasAtual: 0 }),  // vai corrigir
      ];

      const result = syncDiasAtraso(invoices, ref);
      const total = result.invoices.length;
      const corretas = result.invoices.filter(
        (inv) => calcularDiasCorretos(inv.dueDate, ref) === inv.diasAtual
      ).length;

      expect(result.atualizadas).toBe(2);  // inv-001 e inv-003
      expect(total).toBe(3);
      expect(corretas).toBe(3); // todas corretas após sync
    });
  });
});
