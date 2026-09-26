require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.PORT = '3994';

// Bug real (2026-09-25, CPF 044.823.780-62, achado via testes CT03.2 do poc-fintech-playwright):
// enrichUserCreditCardData buscava as faturas FECHADAS com `ORDER BY due_date DESC LIMIT 5`.
// Uma massa com 6+ fechadas históricas perde a mais ANTIGA dessa leitura — mas a soma total
// paga (transactions.invoice_id, vinculado) continua sendo calculada sobre TODAS as
// transações do CPF, sem limite. Resultado: a cascata (planDistribution) redistribui o
// dinheiro só entre as 5 fechadas visíveis, "gastando" nelas o que na verdade já tinha sido
// pago na mais antiga (invisível) — a fatura que o cliente estava realmente pagando (a mais
// recente, mostrada na tela) fica com valor_pago=0 mesmo após um pagamento real, e o mínimo
// da próxima tentativa não abate. getClosedInvoiceDebt (invoiceController.js), que decide
// QUANTO cobrar, nunca teve esse limite — só o enrich (o que a tela exibe) tinha.
const DIA = 86400000;
const iso = (ms) => new Date(ms).toISOString();

describe('enrichUserCreditCardData — não pode perder faturas FECHADAS antigas (bug do LIMIT 5)', () => {
    let db;
    let indexMod;
    const CPF = '99999999990';

    async function limpar(cpf) {
        for (const t of ['transactions', 'billing_charges', 'invoices', 'installment_plans', 'users']) {
            await db.executeQuery(`DELETE FROM fintech.${t} WHERE cpf = '${cpf}'`);
        }
    }
    async function criarUsuario(cpf) {
        await db.executeQuery(`
            INSERT INTO fintech.users (id, cpf, full_name, email, password_hash, balance,
                credit_card_available_limit, credit_card_total_limit, account_status, days_overdue,
                credit_card_due_day, credit_card_invoice_due_date, role)
            VALUES ('test-limit5-${cpf}', '${cpf}', 'Limit5 ${cpf}', 'limit5${cpf}@integration.com', 'pwd123', 10000.00,
                4500.00, 5000.00, 'adimplente', 0, 15, '${iso(Date.now() + 25 * DIA)}', 'customer')
        `);
    }
    async function fechada(cpf, id, valor, venceuHaMeses) {
        // Meses artificiais só para dar due_date distintos e ordenáveis — a data exata não
        // importa para este teste, só a ORDEM (a mais antiga tem que ser devida).
        await db.executeQuery(`
            INSERT INTO fintech.invoices (id, cpf, status, valor_total, valor_pago, due_date)
            VALUES ('${id}', '${cpf}', 'FECHADA', ${valor.toFixed(2)}, 0.00, '${iso(Date.now() - venceuHaMeses * 30 * DIA)}')
        `);
    }
    async function pagamentoVinculado(cpf, id, valor, invoiceId) {
        await db.executeQuery(`
            INSERT INTO fintech.transactions (id, cpf, type, amount, description, date, invoice_id, applied_to_charges)
            VALUES ('${id}', '${cpf}', 'INVOICE_PAYMENT', -${valor.toFixed(2)}, 'Pagamento fatura', '${iso(Date.now() - 1000)}', '${invoiceId}', 0.00)
        `);
    }
    async function enrich(cpf) {
        const u = indexMod.normalizeUser(await indexMod.usersRepo.findByCpf(cpf));
        await indexMod.enrichUserCreditCardData(u, cpf);
        return u.creditCard;
    }

    beforeAll(async () => {
        indexMod = require('../../index.cjs');
        await indexMod.bootstrap();
        db = require('../../repositories/context').getDb();
        if (!db) throw new Error('Banco não inicializado após bootstrap do módulo.');
        await limpar(CPF);
    }, 60000);

    afterAll(async () => {
        await limpar(CPF);
    });

    it('massa com 6 fechadas: pagamento na MAIS ANTIGA não pode sumir da cascata das outras 5', async () => {
        await criarUsuario(CPF);
        // 6 fechadas, R$100 cada, da mais antiga (6 meses atrás) para a mais nova (1 mês atrás).
        const ids = [];
        for (let mes = 6; mes >= 1; mes--) {
            const id = `inv-limit5-${CPF}-${mes}`;
            ids.push(id);
            await fechada(CPF, id, 100, mes);
        }
        const maisAntiga = ids[0]; // mes=6, devida há mais tempo

        // Pagamento real, vinculado à fatura MAIS ANTIGA — deveria quitá-la sozinha.
        await pagamentoVinculado(CPF, `pay-limit5-${CPF}`, 100, maisAntiga);

        const cc = await enrich(CPF);

        // Com as 6 fechadas visíveis: a mais antiga (paga) some da lista de devedoras,
        // sobram exatamente as outras 5, cada uma ainda intocada (R$100 cada = R$500).
        expect(cc._closedInvoiceCount).toBe(5);
        expect(cc._closedInvoiceValorTotal).toBeCloseTo(500, 2);
        expect(cc._closedInvoiceValorPago).toBeCloseTo(0, 2);
        expect(cc.closedInvoiceResidual).toBeCloseTo(500, 2);
        // A fatura paga não pode aparecer na lista de "ainda devendo".
        expect(cc._closedInvoiceIds).not.toContain(maisAntiga);
    }, 30000);
});
