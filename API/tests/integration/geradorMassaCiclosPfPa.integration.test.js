require('dotenv').config();
// Modo teste: index.cjs NÃO dispara bootstrap/cron/listen automaticamente
// (guard IS_TEST) — o beforeAll chama `await bootstrap()` explicitamente.
process.env.NODE_ENV = 'test';
process.env.PORT = '3994';

const { seedMassBilling, validarInvarianteMassa } = require('../../repositories/usersRepo');
const { calcularParcelamentoFatura, TIPOS_ENTRADA } = require('../../services/installmentCalcEngine');

/**
 * Task 5 — Validação cruzada Gerador de Massa 4.0 × motor PF/PA.
 *
 * Confirma que a saída do gerador multi-ciclo (invoices FECHADAS com saldo_anterior
 * encadeado só em sequências inadimplentes consecutivas) alimenta corretamente o
 * motor de parcelamento de fatura (calcularParcelamentoFatura), que já foi validado
 * isoladamente contra a planilha PF/PA.
 */
describe('Integração — Gerador de Massa 4.0 (N ciclos) × motor PF/PA', () => {
    let db;
    const CPFS = {
        intercalado: '99999000011', // inadimplente, adimplente, inadimplente
        encadeado: '99999000012',   // inadimplente, inadimplente, inadimplente
        legado: '99999000013',      // 1 ciclo inadimplente (compat Gerador 3.0)
    };
    const ALL_CPFS = Object.values(CPFS);
    const inList = ALL_CPFS.map(c => `'${c}'`).join(',');

    async function cleanup() {
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf IN (${inList})`);
        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf IN (${inList})`);
        await db.executeQuery(`DELETE FROM fintech.installment_plans WHERE cpf IN (${inList})`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf IN (${inList})`);
        await db.executeQuery(`DELETE FROM fintech.users WHERE cpf IN (${inList})`);
    }

    beforeAll(async () => {
        const indexMod = require('../../index.cjs');
        await indexMod.bootstrap();
        const { getDb } = require('../../repositories/context');
        db = getDb();
        if (!db) throw new Error('Banco não inicializado após bootstrap do módulo.');

        await cleanup();
        for (const [nome, cpf] of Object.entries(CPFS)) {
            await db.executeQuery(`
                INSERT INTO fintech.users (id, cpf, full_name, email, password_hash, balance, credit_card_available_limit, credit_card_total_limit, credit_card_due_day, account_status, days_overdue)
                VALUES ('test-ciclos-${nome}', '${cpf}', 'Ciclos ${nome}', 'ciclos-${nome}@integration.com', 'pwd123', 1000.00, 5000.00, 5000.00, 10, 'adimplente', 0)
            `);
        }
    });

    afterAll(async () => {
        // NÃO chamar db.end(): o pool é compartilhado com as outras suítes do worker.
        if (db) await cleanup();
    });

    test('3 ciclos intercalados (inad, adim, inad): 2 FECHADAS não pagas, saldo_anterior = 0 nas duas (sem encadeamento real)', async () => {
        const cpf = CPFS.intercalado;
        await seedMassBilling(db, cpf, { cycles: ['inadimplente', 'adimplente', 'inadimplente'], overdueAmountBase: 1500, creditLimit: 5000, dueDay: 10 });

        const invs = await db.executeQuery(`
            SELECT due_date, valor_total, saldo_anterior, valor_iof, dias_atraso
            FROM fintech.invoices WHERE cpf='${cpf}' AND status='FECHADA' AND data_pagamento IS NULL
            ORDER BY due_date ASC
        `);
        expect(invs).toHaveLength(2);
        expect(Number(invs[0].saldo_anterior)).toBe(0);
        expect(Number(invs[1].saldo_anterior)).toBe(0); // a adimplente no meio zera o encadeamento

        const pagas = await db.executeQuery(`SELECT COUNT(*)::int AS total FROM fintech.invoices WHERE cpf='${cpf}' AND status='FECHADA' AND data_pagamento IS NOT NULL`);
        expect(Number(pagas[0].total)).toBe(1);

        // Invariante T7 relaxado pra N ciclos bate com o banco real.
        const inv = await validarInvarianteMassa(db, cpf, ['inadimplente', 'adimplente', 'inadimplente']);
        expect(inv.ok).toBe(true);

        // Cada sequência inadimplente abre 1 compra parcelada (2 sequências => 2 planos).
        const plans = await db.executeQuery(`SELECT COUNT(*)::int AS total FROM fintech.installment_plans WHERE cpf='${cpf}'`);
        expect(Number(plans[0].total)).toBe(2);

        // users.days_overdue = dias desde a fatura mais antiga da sequência ATIVA (só a última).
        const user = await db.executeQuery(`SELECT account_status, days_overdue, overdue_status FROM fintech.users WHERE cpf='${cpf}'`);
        expect(user[0].account_status).toBe('inadimplente');
        expect(Number(user[0].days_overdue)).toBe(Number(invs[1].dias_atraso));

        // Alimenta o motor PF/PA com a fatura mais recente.
        const due = new Date(invs[1].due_date);
        const proximoCorte = new Date(due); proximoCorte.setMonth(proximoCorte.getMonth() + 1);
        const result = calcularParcelamentoFatura({
            valorFatura: Number(invs[1].valor_total),
            saldoAbertoAnterior: Number(invs[1].saldo_anterior),
            taxaMensal: 0.0795,
            prazo: 6,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: due,
            vencimentoProximoCorte: proximoCorte,
            diaVencimento: 10,
        });
        expect(result.valorParcela).toBeGreaterThan(0);
        expect(result.iofAdicional).toBeGreaterThanOrEqual(0);
        expect(result.saldoFinanciado).toBeGreaterThan(Number(invs[1].valor_total));
    });

    test('3 ciclos inadimplentes consecutivos: saldo_anterior encadeia (0, p, 2p) e motor PF/PA desconta o saldo herdado do IOF adicional', async () => {
        const cpf = CPFS.encadeado;
        await seedMassBilling(db, cpf, { cycles: ['inadimplente', 'inadimplente', 'inadimplente'], overdueAmountBase: 1800, creditLimit: 5000, dueDay: 10 });

        const invs = await db.executeQuery(`
            SELECT due_date, valor_total, saldo_anterior, dias_atraso
            FROM fintech.invoices WHERE cpf='${cpf}' AND status='FECHADA' AND data_pagamento IS NULL
            ORDER BY due_date ASC
        `);
        expect(invs).toHaveLength(3);
        const p = Number(invs[0].valor_total);
        expect(Number(invs[0].saldo_anterior)).toBe(0);
        expect(Number(invs[1].saldo_anterior)).toBeCloseTo(p, 2);
        expect(Number(invs[2].saldo_anterior)).toBeCloseTo(2 * p, 2);
        // Mesma parcela em todos os ciclos: 1 única compra parcelada na sequência.
        expect(Number(invs[1].valor_total)).toBeCloseTo(p, 2);
        expect(Number(invs[2].valor_total)).toBeCloseTo(p, 2);

        const plans = await db.executeQuery(`SELECT COUNT(*)::int AS total, MIN(installments) AS parcelas FROM fintech.installment_plans WHERE cpf='${cpf}'`);
        expect(Number(plans[0].total)).toBe(1);
        expect(Number(plans[0].parcelas)).toBeGreaterThanOrEqual(10);
        expect(Number(plans[0].parcelas)).toBeLessThanOrEqual(12);

        // 4 encargos por ciclo (multa, juros_mora, juros_remuneratorios, iof).
        const charges = await db.executeQuery(`SELECT COUNT(*)::int AS total FROM fintech.billing_charges WHERE cpf='${cpf}' AND status='pending'`);
        expect(Number(charges[0].total)).toBe(12);

        // days_overdue do usuário = dias da fatura MAIS ANTIGA da sequência (decisão #5).
        const user = await db.executeQuery(`SELECT days_overdue FROM fintech.users WHERE cpf='${cpf}'`);
        expect(Number(user[0].days_overdue)).toBe(Number(invs[0].dias_atraso));
        expect(Number(user[0].days_overdue)).toBeGreaterThan(Number(invs[2].dias_atraso));

        // Motor PF/PA: saldo herdado reduz a base do IOF adicional (comparado a saldo 0).
        const due = new Date(invs[2].due_date);
        const proximoCorte = new Date(due); proximoCorte.setMonth(proximoCorte.getMonth() + 1);
        const base = {
            valorFatura: Number(invs[2].valor_total) + Number(invs[2].saldo_anterior),
            taxaMensal: 0.0795,
            prazo: 6,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: due,
            vencimentoProximoCorte: proximoCorte,
            diaVencimento: 10,
        };
        const comHeranca = calcularParcelamentoFatura({ ...base, saldoAbertoAnterior: Number(invs[2].saldo_anterior) });
        const semHeranca = calcularParcelamentoFatura({ ...base, saldoAbertoAnterior: 0 });
        expect(comHeranca.valorParcela).toBeGreaterThan(0);
        expect(comHeranca.iofAdicional).toBeGreaterThanOrEqual(0);
        expect(comHeranca.iofAdicional).toBeLessThan(semHeranca.iofAdicional);
    });

    test('compat: 1 ciclo inadimplente (payload legado) produz exatamente 1 FECHADA não paga e invariante ok', async () => {
        const cpf = CPFS.legado;
        await seedMassBilling(db, cpf, { accountStatus: 'inadimplente', daysOverdue: 15, overdueAmount: 3870.86, creditLimit: 5000, dueDay: 10 });

        const legacy = await validarInvarianteMassa(db, cpf, 'inadimplente');
        expect(legacy.ok).toBe(true);
        const asCycles = await validarInvarianteMassa(db, cpf, ['inadimplente']);
        expect(asCycles.ok).toBe(true);

        const invs = await db.executeQuery(`SELECT valor_total, saldo_anterior FROM fintech.invoices WHERE cpf='${cpf}' AND status='FECHADA' AND data_pagamento IS NULL`);
        expect(invs).toHaveLength(1);
        expect(Number(invs[0].saldo_anterior)).toBe(0);
    });
});
