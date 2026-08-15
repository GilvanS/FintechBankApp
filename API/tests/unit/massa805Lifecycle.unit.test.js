require('dotenv').config();
// Modo teste: index.cjs NÃO dispara bootstrap/cron/listen automaticamente (guard
// IS_TEST). Este teste consulta o banco real (massa 805) e usa enrichUserCreditCardData,
// então inicializa a conexão explicitamente no beforeAll.
process.env.NODE_ENV = 'test';
const { executeQuery, fq } = require('../../repositories/dbAdapter.js');
const indexMod = require('../../index.cjs');
const { enrichUserCreditCardData } = indexMod;

describe('Massa 805.357.576-54 Lifecycle Test', () => {
  beforeAll(async () => {
    await indexMod.bootstrap();
  });

  test('Deve validar encadeamento', async () => {
    const cpf = '80535757654';
    const res = await executeQuery(
      'SELECT id, status, due_date, valor_total, valor_pago, saldo_anterior, valor_multa, valor_juros_mora, valor_juros_remuneratorios, valor_iof FROM ' + fq('invoices') + ' WHERE cpf = \'' + cpf + '\' ORDER BY due_date ASC'
    );
    const rows = Array.isArray(res) ? res : (res.rows || []);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const julInvoice = rows[0];
    const agoInvoice = rows[1];
    expect(julInvoice.status).toBe('FECHADA');
    expect(parseFloat(julInvoice.saldo_anterior)).toBe(0);
    expect(parseFloat(julInvoice.valor_total)).toBeCloseTo(3870.86, 2);
    expect(parseFloat(agoInvoice.saldo_anterior)).toBeCloseTo(3870.86, 2);
    // Regra de negócio do ciclo (confirmada com o usuário): o Fat 1 é o INÍCIO do
    // atraso — as colunas de encargos congelados ficam ZERO nele, porque os dias de
    // atraso e os encargos são reportados na fatura seguinte (Fat 2), que acumula
    // até o fechamento. O Fat 2 carrega o 414,08 (abaixo).
    expect(parseFloat(julInvoice.valor_multa || 0)).toBeCloseTo(0, 2);
    expect(parseFloat(julInvoice.valor_juros_mora || 0)).toBeCloseTo(0, 2);
    expect(parseFloat(julInvoice.valor_juros_remuneratorios || 0)).toBeCloseTo(0, 2);
    expect(parseFloat(julInvoice.valor_iof || 0)).toBeCloseTo(0, 2);
    // Encargos congelados no fechamento: o Fat 2 herda as charges do período de
    // atraso do Fat 1 (ref 2026-07) nas colunas da fatura (backfill + motor).
    // Antes da correção o Fat 2 nascia com esses valores ZERO e a análise mensal
    // via os encargos sumidos do período correto.
    expect(parseFloat(agoInvoice.valor_multa || 0)).toBeCloseTo(77.42, 2);
    expect(parseFloat(agoInvoice.valor_juros_mora || 0)).toBeCloseTo(19.33, 2);
    expect(parseFloat(agoInvoice.valor_juros_remuneratorios || 0)).toBeCloseTo(297.86, 2);
    expect(parseFloat(agoInvoice.valor_iof || 0)).toBeCloseTo(19.47, 2);
    const dummyUser = { creditCard: {} };
    await enrichUserCreditCardData(dummyUser, cpf);
    expect(dummyUser.creditCard.closedInvoicesList[0].valorTotal).toBeCloseTo(3870.86, 2);
    // Fat 1 congelado zerado no enrich também (mesma regra: início do atraso).
    expect(dummyUser.creditCard.closedInvoicesList[0].encargosFrozen.total).toBeCloseTo(0, 2);
    // closedInvoicesList[1] = Fat 2: compras (364,97) + saldo anterior (3.870,86).
    const fat2 = dummyUser.creditCard.closedInvoicesList[1];
    expect(fat2.valorTotal).toBeCloseTo(4235.83, 2);
    // Encargos congelados expostos para análise mensal (414,08 = 77,42+19,33+297,86+19,47).
    expect(fat2.encargosFrozen.total).toBeCloseTo(414.08, 2);
    expect(fat2.encargosFrozen.multa).toBeCloseTo(77.42, 2);
    expect(fat2.encargosFrozen.jurosMora).toBeCloseTo(19.33, 2);
    expect(fat2.encargosFrozen.jurosRemuneratorios).toBeCloseTo(297.86, 2);
    expect(fat2.encargosFrozen.iof).toBeCloseTo(19.47, 2);
    // Total informativo p/ análise mensal: compras + saldo herdado + encargos congelados.
    expect(fat2.valorTotalComEncargos).toBeCloseTo(4649.91, 2);
    expect(dummyUser.creditCard._closedInvoiceValorTotal).toBeCloseTo(4235.83, 2);

    // Coleta preservada: o freeze nas colunas é DISPLAY-ONLY. As charges da ref
    // 2026-07 continuam 'pending' porque a rota de pagamento (invoiceController.pay)
    // cobra `principal + SUM(billing_charges pending)` e nunca marca paid — marcar
    // aqui removeria R$ 414,08 da coleta (perda de dívida).
    const chargesRes = await executeQuery(
      'SELECT COUNT(*)::int AS qtd FROM ' + fq('billing_charges') +
      ' WHERE cpf = \'' + cpf + '\' AND invoice_reference = \'2026-07\' AND status = \'pending\''
    );
    const chargesRows = Array.isArray(chargesRes) ? chargesRes : (chargesRes.rows || []);
    // >= 4 (nao exato): com a ref ESTAVEL (mes da fatura mais antiga nao paga), o
    // motor passa a gravar os incrementos diarios sob a MESMA ref 2026-07 — o count
    // cresce a cada execucao do cron e nao pode ser assertado como valor fixo.
    expect(parseInt(chargesRows[0]?.qtd || 0, 10)).toBeGreaterThanOrEqual(4);
    // Multa (2% do valor_total original) é cobrança ÚNICA por débito: após a
    // correção do motor (ref estável + checagem global por CPF, sem filtro de
    // invoice_reference), não pode existir multa duplicada em outras refs. O
    // histórico da massa tinha 77,42 (ref 2026-08) e 7,30 (ref 2026-09) —
    // duplicada/errada — removidas na limpeza. Sobrou exatamente a de 2026-07.
    const multaRes = await executeQuery(
      'SELECT COALESCE(SUM(amount), 0)::numeric(15,2) AS total, COUNT(*)::int AS qtd FROM ' + fq('billing_charges') +
      ' WHERE cpf = \'' + cpf + '\' AND charge_type = \'multa\' AND status = \'pending\''
    );
    const multaRows = Array.isArray(multaRes) ? multaRes : (multaRes.rows || []);
    expect(parseFloat(multaRows[0]?.total || 0)).toBeCloseTo(77.42, 2);
    expect(parseInt(multaRows[0]?.qtd || 0, 10)).toBe(1);
    // E os encargos congelados continuam sendo herdados pela fatura aberta
    // (closedInvoiceCharges = SUM de todas as pending, incluindo o 414,08).
    expect(dummyUser.creditCard.closedInvoiceCharges.totalEncargos).toBeGreaterThanOrEqual(414.08);
  });
});