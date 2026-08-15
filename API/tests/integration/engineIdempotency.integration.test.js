require('dotenv').config();
// Modo teste: index.cjs NÃO dispara bootstrap/cron/listen automaticamente
// (guard IS_TEST) — o beforeAll chama `await bootstrap()` explicitamente.
process.env.NODE_ENV = 'test';
process.env.PORT = '3993';
const DatabaseFactory = require('../../services/database/DatabaseFactory');

describe('Teste de Integração — Idempotência do Motor Diário de Encargos', () => {
    let db;
    let runBillingValidation;
    const testCpf = '99999999993'; // CPF de teste temporário

    beforeAll(async () => {
        const indexMod = require('../../index.cjs');
        runBillingValidation = indexMod.runBillingValidation;
        // Em modo teste o bootstrap NÃO roda automaticamente: chamamos explicitamente
        // para conectar o banco e rodar o seed (necessário para o motor).
        await indexMod.bootstrap();
        const { getDb } = require('../../repositories/context');
        db = getDb();
        if (!db) throw new Error('Banco não inicializado após bootstrap do módulo.');

        // Limpar qualquer lixo de teste anterior
        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.users WHERE cpf = '${testCpf}'`);

        // Criar usuário de teste no banco (inadimplente, com fatura fechada vencida)
        await db.executeQuery(`
            INSERT INTO fintech.users (id, cpf, full_name, email, password_hash, balance, credit_card_available_limit, credit_card_total_limit, account_status, days_overdue)
            VALUES ('test-idem-user', '${testCpf}', 'Idempotency Test User', 'idem@integration.com', 'pwd123', 10000.00, 1129.14, 5000.00, 'inadimplente', 18)
        `);
        await db.executeQuery(`
            INSERT INTO fintech.invoices (id, cpf, status, valor_total, valor_pago, due_date)
            VALUES ('test-idem-inv', '${testCpf}', 'FECHADA', 3870.86, 0.00, '2026-07-15 00:00:00')
        `);
    });

    afterAll(async () => {
        // Limpar dados de teste. NÃO chamar db.end(): o getDb() retorna o pool/DB
        // COMPARTILHADO do bootstrap — fechar aqui mataria a conexão para as outras
        // suítes de integração que rodam no mesmo worker do jest.
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.users WHERE cpf = '${testCpf}'`);
    });

    test('Rodar o motor 2x no mesmo dia NÃO deve duplicar incrementos diários', async () => {
        // Escopo por CPF (só o do teste): o motor REAL percorre todos os usuários do
        // banco, e as suítes de integração compartilham o mesmo Postgres em workers
        // paralelos — sem o filtro, o motor re-marcava account_status e inseria charges
        // no CPF 99999999991 (invoicePaymentCompleto) em corrida com o teste de pagamento.
        const opts = { onlyCpf: testCpf };

        // 1ª execução: deve inserir o incremento do dia atual (1x por tipo)
        const r1 = await runBillingValidation(opts);
        expect(r1.success).toBe(true);

        // 2ª execução: com a idempotência por (cpf, ref, tipo, days_overdue),
        // NÃO pode inserir nada novo para o mesmo dia.
        const r2 = await runBillingValidation(opts);
        expect(r2.success).toBe(true);

        // Inspecionar as charges criadas para o CPF de teste
        const charges = await db.executeQuery(`
            SELECT charge_type, days_overdue, COUNT(*)::int AS qtd, ROUND(SUM(amount)::numeric, 2) AS total
            FROM fintech.billing_charges
            WHERE cpf = '${testCpf}' AND status = 'pending'
            GROUP BY charge_type, days_overdue
            ORDER BY charge_type, days_overdue
        `);
        const rows = Array.isArray(charges) ? charges : (charges.rows || []);

        // Deve existir pelo menos multa + 3 incrementos diários (um por tipo)
        expect(rows.length).toBeGreaterThanOrEqual(4);

        // INVARIANTE CENTRAL: nenhuma combinação (tipo, dia) pode ter qtd > 1
        for (const r of rows) {
            expect(parseInt(r.qtd, 10)).toBe(1);
        }

        // Multa é única por débito
        const multa = rows.find(r => r.charge_type === 'multa');
        expect(parseFloat(multa.total)).toBeCloseTo(77.42, 2);

        // Incrementos diários = 1 dia sobre o residual 3.870,86
        const jurosMora = rows.find(r => r.charge_type === 'juros_mora');
        const jurosRem = rows.find(r => r.charge_type === 'juros_remuneratorios');
        const iof = rows.find(r => r.charge_type === 'iof');
        expect(parseFloat(jurosMora.total)).toBeCloseTo(1.29, 2);
        expect(parseFloat(jurosRem.total)).toBeCloseTo(19.86, 2);
        // IOF da primeira cobrança = adicional (0,38% de 3870,86 = 14,71) + diário acumulado
        // (0,0082% × dias). Para uma fatura vencida há ~28 dias: 14,71 + 0,32×28 ≈ 23,67.
        expect(parseFloat(iof.total)).toBeGreaterThan(14.71);

        // E a 2ª execução não criou novas linhas (as do dia já existiam)
        const dupCount = await db.executeQuery(`
            SELECT COUNT(*)::int AS qtd FROM (
                SELECT cpf, invoice_reference, charge_type, days_overdue
                FROM fintech.billing_charges
                WHERE cpf = '${testCpf}' AND status = 'pending'
                GROUP BY cpf, invoice_reference, charge_type, days_overdue
                HAVING COUNT(*) > 1
            ) d
        `);
        const dupRows = Array.isArray(dupCount) ? dupCount : (dupCount.rows || []);
        expect(parseInt(dupRows[0]?.qtd || 0, 10)).toBe(0);
    });
});
