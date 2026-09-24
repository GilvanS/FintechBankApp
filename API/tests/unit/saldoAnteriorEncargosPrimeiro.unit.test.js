/**
 * saldoAnterior.js com ENCARGOS PRIMEIRO (Task 3, 2026-09-24).
 *
 * O saldo anterior gravado no fechamento (invoiceEngine → calcularSaldoAnterior) e a
 * auditoria SALDO_ANTERIOR_JA_QUITADO (listarSaldoAnteriorIndevido) derivam a quitação
 * da cascata. O que entra nela é o PRINCIPAL de cada pagamento: |amount| − encargos
 * quitados por ele (billing_charges.payment_id). Com o |amount| cheio, um parcial que
 * só cobriu encargos fazia a próxima fatura herdar menos principal do que o devido.
 *
 * Banco simulado: se a SQL não descontar os encargos (sem `AS principal`), devolve o
 * |amount| cheio, como o Postgres faria com a query antiga — é assim que o código antigo
 * falha aqui.
 */
const { calcularSaldoAnterior, listarSaldoAnteriorIndevido } = require('../../services/saldoAnterior');

const r2 = n => Math.round(n * 100) / 100;
const esc = v => `'${String(v).replace(/'/g, "''")}'`;

const FECHADA_A = { id: 'inv-a', cpf: '111', due_date: '2026-08-10T12:00:00Z', created_at: '2026-08-05T12:00:00Z', valor_total: '1000.00', valor_pago: '0', saldo_anterior: '0', full_name: 'Teste' };

function banco({ fechadas, pagamentos, encargosPagos = {} }) {
    const sqls = [];
    return {
        sqls,
        fq: t => `"fintech"."${t}"`,
        async executeQuery(sql) {
            const q = String(sql);
            sqls.push(q);
            if (/^\s*ALTER TABLE/i.test(q)) return [];
            if (/FROM "fintech"\."invoices"/.test(q) && /status = 'FECHADA'/.test(q) && !/INVOICE_PAYMENT/.test(q)) return fechadas;
            const principal = /AS principal/.test(q);
            const valorDe = p => r2(Math.abs(p.amount) - (principal ? (encargosPagos[p.id] || 0) : 0));
            if (/COALESCE\(SUM\(/.test(q)) return [{ pago: r2(pagamentos.reduce((s, p) => s + valorDe(p), 0)) }];
            return pagamentos.map(p => ({ cpf: p.cpf, date: p.date, valor: valorDe(p) }));
        },
    };
}

describe('calcularSaldoAnterior — cascata pelo principal pago', () => {
    test('parcial que só cobriu encargos: a próxima fatura herda o principal INTEIRO', async () => {
        // Pagou 40,00 e a rota aplicou tudo em multa/juros/IOF (payment_id pay-1).
        const db = banco({
            fechadas: [FECHADA_A],
            pagamentos: [{ id: 'pay-1', cpf: '111', amount: -40, date: '2026-08-20T12:00:00Z' }],
            encargosPagos: { 'pay-1': 40 },
        });
        // Antes: 1.000 − 40 = 960 (os encargos pagos contavam como principal).
        expect(await calcularSaldoAnterior(db, '111', esc)).toBe(1000);
        expect(db.sqls.some(q => /enc\.payment_id = t\.id/.test(q))).toBe(true);
    });

    test('pagamento maior que o principal com encargos: herda o principal que faltou', async () => {
        const db = banco({
            fechadas: [FECHADA_A],
            pagamentos: [{ id: 'pay-1', cpf: '111', amount: -1020, date: '2026-08-20T12:00:00Z' }],
            encargosPagos: { 'pay-1': 40 },
        });
        // Antes: 0 (1.020 cobria os 1.000). Agora 1.020 − 40 = 980 de principal → herda 20.
        expect(await calcularSaldoAnterior(db, '111', esc)).toBe(20);
    });

    test('pagamento TOTAL: nada é herdado', async () => {
        const db = banco({
            fechadas: [FECHADA_A],
            pagamentos: [{ id: 'pay-1', cpf: '111', amount: -1040, date: '2026-08-20T12:00:00Z' }],
            encargosPagos: { 'pay-1': 40 },
        });
        expect(await calcularSaldoAnterior(db, '111', esc)).toBe(0);
    });

    test('pagamento antigo sem payment_id: comportamento antigo (valor cheio)', async () => {
        const db = banco({
            fechadas: [FECHADA_A],
            pagamentos: [{ id: 'pay-old', cpf: '111', amount: -400, date: '2026-08-20T12:00:00Z' }],
        });
        expect(await calcularSaldoAnterior(db, '111', esc)).toBe(600);
    });
});

describe('listarSaldoAnteriorIndevido — auditoria pelo principal pago', () => {
    // B fechou pelo motor em 05/09 herdando 1.000 de A. Antes de fechar, o cliente pagou
    // 40,00 que foram todos para encargos: o principal de A continuava inteiro.
    const FECHADA_B = { ...FECHADA_A, id: 'inv-b', due_date: '2026-09-10T12:00:00Z', created_at: '2026-09-05T12:00:00Z', valor_total: '300.00', saldo_anterior: '1000.00' };

    test('saldo herdado correto (parcial só de encargos) NÃO é acusado', async () => {
        const db = banco({
            fechadas: [FECHADA_A, FECHADA_B],
            pagamentos: [{ id: 'pay-1', cpf: '111', amount: -40, date: '2026-08-20T12:00:00Z' }],
            encargosPagos: { 'pay-1': 40 },
        });
        // Antes: devido = 1.000 − 40 = 960 → acusava R$ 40 "já pagos herdados".
        expect(await listarSaldoAnteriorIndevido(db, { esc })).toEqual([]);
    });

    test('saldo herdado de principal já pago continua sendo acusado', async () => {
        const db = banco({
            fechadas: [FECHADA_A, FECHADA_B],
            pagamentos: [{ id: 'pay-1', cpf: '111', amount: -1040, date: '2026-08-20T12:00:00Z' }],
            encargosPagos: { 'pay-1': 40 },
        });
        const [indevido] = await listarSaldoAnteriorIndevido(db, { esc });
        expect(indevido).toMatchObject({ invoiceId: 'inv-b', saldoAnteriorGravado: 1000, saldoAnteriorCorreto: 0 });
    });
});
