/**
 * Proteções de quem lê/regera billing_charges depois que o pagamento passou a quitar
 * ENCARGOS PRIMEIRO (regra de 2026-09-23, Task 2 — fix round 1):
 *  - syncInvoiceDiasAtraso usa o PRINCIPAL pago (igual ao motor), senão o encargo pago
 *    contava como principal e dias_atraso alternava entre 0 e o real;
 *  - Anomalia 8 (dailyAudit) e chargesProactiveFix não regeram do zero débito com
 *    encargo já pago — âncora no último pagamento TOTAL, não em due_date;
 *  - UTI (uti_massa.cjs) não recria encargo já pago: desconta por tipo.
 *
 * Banco simulado: o fake "aplica" o filtro que o SQL declara (se a proteção não estiver
 * no SQL, devolve a linha como o Postgres devolveria) — o teste falha no código antigo.
 */
const mockDb = { fq: t => `"${t}"`, generateUUID: () => 'uuid-1', executeQuery: jest.fn() };
jest.mock('../../services/database/DatabaseFactory', () => ({ createDatabaseService: () => mockDb }));
jest.mock('../../repositories/notificationsRepo', () => ({ addNotification: jest.fn().mockResolvedValue() }));

const billingValidation = require('../../services/billingValidation');
const { runDailyAudit } = require('../../services/dailyAudit');
const { runChargesProactiveFix } = require('../../services/chargesProactiveFix');
const uti = require('../../scripts/uti_massa.cjs');

const CPF = '12345678901';
// Task 4 fix 1: o momento da quitação inclui o legado pago sem payment_id (created_at).
const PROTECAO = /NOT EXISTS \(\s*SELECT 1 FROM "billing_charges" bq[\s\S]*COALESCE\(bq\.paid_at, bq\.created_at\) END\)\s*> ALL \(SELECT tq\.date FROM "transactions" tq[\s\S]*'Pagamento fatura'/;

beforeEach(() => {
    mockDb.executeQuery.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('syncInvoiceDiasAtraso — principal pago, não o |amount| cheio (fix 2)', () => {
    test('parcial de 150 com 60 de encargos (principal 90 < 10% de 1.000) NÃO zera dias_atraso', async () => {
        const sqls = [];
        mockDb.executeQuery.mockImplementation(async (sql) => {
            sqls.push(sql);
            if (/pago_total_cpf/.test(sql)) {
                // O Postgres devolveria 90 com o desconto dos encargos e 150 sem ele.
                const pago = /COALESCE\(enc\.total, 0\) AS principal/.test(sql) ? '90.00' : '150.00';
                const due = new Date(Date.now() - 30 * 86400000).toISOString();
                return [{ id: 'inv-1', cpf: CPF, due_date: due, valor_total: '1000.00', valor_pago: '0', pago_vinculado: pago, tem_vinculo: 1, pago_total_cpf: pago }];
            }
            if (/COUNT\(\*\) AS total/.test(sql)) return [{ total: 1, corretas: 1 }];
            return [];
        });

        const r = await billingValidation.syncInvoiceDiasAtraso();
        expect(r.success).toBe(true);
        expect(sqls.filter(s => /SET dias_atraso = 0/.test(s))).toEqual([]);
        // A fatura segue no update de tempo real (não foi excluída como "mínimo").
        const tempoReal = sqls.find(s => /SET dias_atraso = GREATEST/.test(s));
        expect(tempoReal).not.toMatch(/NOT IN \('inv-1'\)/);
    });
});

describe('Anomalia 8 do dailyAudit — não apaga/recria encargo já pago (fix 4)', () => {
    test('due_date errado POSTERIOR ao pagamento: a proteção vale mesmo assim', async () => {
        const writes = [];
        mockDb.executeQuery.mockImplementation(async (sql) => {
            if (/^\s*(DELETE|INSERT|UPDATE)/i.test(sql)) writes.push(sql);
            if (/EXTRACT\(DAY FROM i\.due_date\) != u\.credit_card_due_day/.test(sql)) {
                // Débito com multa paga em 20/07 e fatura com due_date (errado) 01/08.
                // Com `bq.paid_at >= i.due_date` (código antigo) o Postgres devolvia a
                // fatura; com a âncora no último TOTAL, a multa paga protege.
                if (PROTECAO.test(sql)) return [];
                return [{ id: 'inv-1', cpf: CPF, due_date: '2026-08-01T03:00:00Z', status: 'FECHADA', valor_total: '1000.00', full_name: 'Massa', credit_card_due_day: 10 }];
            }
            return [];
        });

        await runDailyAudit(mockDb, jest.fn());
        expect(writes.filter(s => /billing_charges/.test(s))).toEqual([]);
        expect(writes.filter(s => /UPDATE "invoices"/.test(s))).toEqual([]);
    });

    test('a query não usa mais i.due_date como âncora da proteção', async () => {
        const sqls = [];
        mockDb.executeQuery.mockImplementation(async (sql) => { sqls.push(sql); return []; });
        await runDailyAudit(mockDb, jest.fn());
        const q = sqls.find(s => /EXTRACT\(DAY FROM i\.due_date\) != u\.credit_card_due_day/.test(s));
        expect(q).toMatch(PROTECAO);
        expect(q).not.toMatch(/paid_at >= i\.due_date/);
    });
});

describe('chargesProactiveFix — mesma proteção (fix 4)', () => {
    test('débito com encargo pago por pagamento não é regerado', async () => {
        const writes = [];
        mockDb.executeQuery.mockImplementation(async (sql) => {
            if (/^\s*(DELETE|INSERT|UPDATE)/i.test(sql)) writes.push(sql);
            if (/bc_own/.test(sql)) {
                if (PROTECAO.test(sql)) return [];
                return [{ id: 'inv-1', cpf: CPF, status: 'ABERTA', valor_total: '1000.00', dias_atraso: 12, full_name: 'Massa', charge_days_overdue: 3 }];
            }
            return [];
        });
        const r = await runChargesProactiveFix(mockDb, { cpfFilter: CPF });
        expect(r.fixed || 0).toBe(0);
        expect(writes.filter(s => /billing_charges/.test(s))).toEqual([]);
    });
});

describe('UTI — não recria encargo já pago (fix 5)', () => {
    // Débito atual: multa 20,00 e 0,99 de juros de mora já quitados por um parcial.
    const pagas = [
        { charge_type: 'multa', amount: '20.00', invoice_reference: '2026-07', days_overdue: 1, status: 'paid', payment_id: 'pay-1', paid_at: '2026-07-20 10:00:00' },
        { charge_type: 'juros_mora', amount: '0.99', invoice_reference: '2026-07', days_overdue: 3, status: 'paid', payment_id: 'pay-1', paid_at: '2026-07-20 10:00:00' },
    ];
    const invoice = { id: 'inv-1', valor_total: '1000.00', dias_atraso: 10, due_date: '2026-07-10T03:00:00Z' };

    const montar = () => {
        const inserts = [];
        mockDb.executeQuery.mockImplementation(async (sql) => {
            if (/INSERT INTO fintech\.billing_charges/.test(sql)) inserts.push(sql);
            if (/AS ultima/.test(sql)) return [{ ultima: null }];
            // Task 4 fix 1: a fechada ainda deve pela cascata (senão a UTI não regera nada).
            if (/AS residual/.test(sql)) return [{ id: 'inv-1', residual: '1000.00' }];
            if (/FROM "billing_charges"[\s\S]*status IN \('pending', 'paid'\)/.test(sql)) return pagas;
            if (/SELECT days_overdue FROM fintech\.users/.test(sql)) return [{ days_overdue: 10 }];
            return [];
        });
        const tipo = (s) => (s.match(/'(multa|juros_mora|juros_remuneratorios|iof)'/) || [])[1];
        const valorDe = (s) => Number((s.match(/'(?:multa|juros_mora|juros_remuneratorios|iof)', ([\d.]+),/) || [])[1]);
        return { inserts, tipo, valorDe };
    };

    test('BILLING_CHARGES_DESSINCRONIZADO: multa paga não volta; juros de mora só a diferença', async () => {
        const t = montar();
        const plano = await uti.corrigirBillingChargesDessincronizado(mockDb, CPF, { invoicesFechadas: [invoice], pendingCharges: [] }, true);
        expect(t.inserts.map(t.tipo)).toEqual(['juros_mora', 'juros_remuneratorios', 'iof']);
        // 1000 × 0,000333 × 10 = 3,33 − 0,99 já pago = 2,34
        expect(t.valorDe(t.inserts[0])).toBe(2.34);
        expect(plano.acao).toMatch(/descontado o já quitado por pagamento/);
    });

    test('INADIMPLENTE_SEM_ENCARGOS: mesma proteção', async () => {
        const t = montar();
        await uti.corrigirInadimplenteSemEncargos(mockDb, CPF, { invoicesFechadas: [invoice], userRow: { days_overdue: 10 } }, true);
        expect(t.inserts.map(t.tipo)).not.toContain('multa');
        expect(t.valorDe(t.inserts.find(s => t.tipo(s) === 'juros_mora'))).toBe(2.34);
    });
});
