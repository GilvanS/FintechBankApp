require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.PORT = '3994';

// Bug (2026-09-25, audit-csv-consistency): conta SEM fatura fechada real
// (fc.due_date_ancora IS NULL) somava no CSV toda transação da conta desde sempre,
// sem corte de ciclo. O real (enrichUserCreditCardData, API/index.cjs) usa a janela
// (_prevCloseMs, maxDueTime] mesmo sem fechada — uma compra de um ciclo já rolado
// e nunca fechado era corretamente ignorada pelo real mas contada pelo CSV
// (CPFs reais afetados: 11879646706, 17058588562, 29910306743, entre outros).
const { buildQuery } = require('../../utils/tblDeMassasExport.cjs');

const DIA = 86400000;
const iso = (ms) => new Date(ms).toISOString();

describe('CSV compras_ciclo replica a janela de ciclo do enrich quando não há fechada', () => {
    let db;
    let indexMod;
    const CPF = { SEM_FECHADA: '99999999971' };

    async function limpar(cpf) {
        for (const t of ['transactions', 'billing_charges', 'invoices', 'installment_plans', 'users']) {
            await db.executeQuery(`DELETE FROM fintech.${t} WHERE cpf = '${cpf}'`);
        }
    }
    async function criarUsuario(cpf, { dueInDays, status = 'adimplente', diasAtraso = 0 }) {
        const due = new Date(Date.now() + dueInDays * DIA);
        await db.executeQuery(`
            INSERT INTO fintech.users (id, cpf, full_name, email, password_hash, balance,
                credit_card_available_limit, credit_card_total_limit, account_status, days_overdue,
                credit_card_due_day, credit_card_invoice_due_date, role)
            VALUES ('test-caj-${cpf}', '${cpf}', 'Ciclo Aberto ${cpf}', 'caj${cpf}@integration.com', 'pwd123', 10000.00,
                4500.00, 5000.00, '${status}', ${diasAtraso}, ${due.getDate()}, '${iso(due.getTime())}', 'customer')
        `);
    }
    async function compra(cpf, valor, diasAtras, sufixo = '') {
        await db.executeQuery(`
            INSERT INTO fintech.transactions (id, cpf, type, amount, description, date)
            VALUES ('tx-caj-${cpf}-${diasAtras}${sufixo}', '${cpf}', 'SHOP_CREDIT', -${valor.toFixed(2)}, 'Compra teste', '${iso(Date.now() - diasAtras * DIA)}')
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
        for (const cpf of Object.values(CPF)) await limpar(cpf);
    }, 60000);

    afterAll(async () => {
        for (const cpf of Object.values(CPF)) await limpar(cpf);
    });

    it('conta nova sem fechada: compra de ciclo já rolado é ignorada por CSV e enrich igualmente', async () => {
        // Vencimento em 20 dias → janela do ciclo atual é aprox. (hoje-15d, hoje+20d].
        await criarUsuario(CPF.SEM_FECHADA, { dueInDays: 20 });
        await compra(CPF.SEM_FECHADA, 300, 2);   // dentro do ciclo atual
        await compra(CPF.SEM_FECHADA, 500, 40, '-antiga'); // ciclo anterior já expirado

        const cc = await enrich(CPF.SEM_FECHADA);
        expect(cc.currentInvoiceTotal).toBeCloseTo(300, 2); // real ignora a compra de 40 dias atrás

        const [row] = await db.executeQuery(buildQuery({ cpf: CPF.SEM_FECHADA }));
        expect(row.status_fatura_fechada).toBe('ABERTA'); // confirma due_date_ancora IS NULL (sem fechada)
        expect(parseFloat(row.fatura_aberta)).toBeCloseTo(cc.currentInvoiceTotal, 2);
        expect(parseFloat(row.fatura_aberta)).toBeCloseTo(300, 2); // antes do fix: 800 (somava as duas)
    }, 30000);
});
