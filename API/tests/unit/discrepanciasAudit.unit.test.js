const { runDiscrepanciasAudit, listarExcedentesFaturaFechada } = require('../../services/discrepanciasAudit');
const createAdminScriptsController = require('../../src/controllers/adminScriptsController');

const esc = (v) => `'${String(v).replace(/'/g, "''")}'`;

/**
 * Banco falso: responde por trecho de SQL e guarda toda escrita (UPDATE/INSERT).
 * `dados` define o retorno de cada consulta do serviço.
 */
function makeDb(dados = {}) {
    const writes = [];
    const selects = [];
    const executeQuery = jest.fn(async (sql) => {
        const s = sql.replace(/\s+/g, ' ').trim();
        // DDL idempotente de garantirColunasQuitacao (payment_id): não é consulta nem escrita de dado.
        if (s.startsWith('ALTER TABLE')) return [];
        if (s.startsWith('UPDATE') || s.startsWith('INSERT')) { writes.push(s); return []; }
        selects.push(s);
        if (s.includes('AS devolvido')) return dados.faturasFechadas || [];
        if (s.includes('invoice_id IS NULL')) return [dados.semFatura || { transacoes: 0, massas: 0, valor: 0 }];
        if (s.includes('AS gross')) return dados.excessivos || [];
        if (s.includes('balance < 0')) return dados.saldoNegativo || [];
        if (s.includes('credit_card_available_limit < 0')) return dados.limiteNegativo || [];
        if (s.includes('AS divida')) return dados.alertas || [];
        return [];
    });
    return { db: { executeQuery, fq: (t) => `fintech.${t}` }, writes, selects };
}

// Linha da query de faturas FECHADAS com pagamento vinculado.
const fechada = (id, cpf, { vt, sa = 0, enc = 0, pago, devolvido = 0, balance = 0, nome = `Massa ${cpf}` }) =>
    ({ id, cpf, full_name: nome, balance, valor_total: vt, saldo_anterior: sa, encargos: enc, pago, devolvido });

const cenarioCompleto = () => ({
    faturasFechadas: [
        // Ana: devido 500 + 100 de saldo anterior = 600, pagou 700 → devolve 100 ao saldo (50 → 150).
        fechada('inv-a', '11111111111', { vt: 500, sa: 100, pago: 700, balance: 50, nome: 'Ana' }),
        // Bia: pagou exatamente o devido (compras + saldo herdado) → ok.
        fechada('inv-b', '22222222222', { vt: 364.97, sa: 3870.86, pago: 4235.83, nome: 'Bia' }),
        // Carla: excedente de 100 já devolvido numa rodada anterior → resolvido.
        fechada('inv-c', '88888888888', { vt: 600, pago: 700, devolvido: 100, nome: 'Carla' }),
    ],
    semFatura: { transacoes: 3, massas: 2, valor: 450.5 },
    excessivos: [{ cpf: '33333333333', full_name: 'Caio', id: 'inv-aberta', valor_pago: 1050, gross: 1000 }],
    saldoNegativo: [{ cpf: '44444444444', full_name: 'Duda', balance: -35.5 }],
    limiteNegativo: [{ cpf: '55555555555', full_name: 'Edu' }, { cpf: '66666666666', full_name: 'Fé' }],
    alertas: [{ cpf: '77777777777', full_name: 'Gil', balance: 0, divida: 800 }],
});

const recalcFake = () => jest.fn(async (cpf) => (cpf === '55555555555'
    ? { cpf, fullName: 'Edu', limiteAnterior: -300, limiteNovo: 120, alterado: true, estourado: false, currentInvoiceTotal: 880 }
    : { cpf, fullName: 'Fé', limiteAnterior: -50, limiteNovo: -50, alterado: false, estourado: true, currentInvoiceTotal: 1050 }));

describe('listarExcedentesFaturaFechada', () => {
    test('devido inclui saldo_anterior e encargos; excedente desconta o já devolvido', async () => {
        const { db } = makeDb({
            faturasFechadas: [
                fechada('x', '1', { vt: 364.97, sa: 3870.86, pago: 4235.83 }),
                fechada('y', '2', { vt: 3870.86, enc: 199.46, pago: 4257.95 }),
                fechada('z', '3', { vt: 500, pago: 700, devolvido: 150 }),
            ],
        });

        const r = await listarExcedentesFaturaFechada(db, { esc });

        expect(r.map((f) => [f.invoiceId, f.devido, f.excedente])).toEqual([
            ['x', 4235.83, 0],
            ['y', 4070.32, 187.63], // caso real 71040451128
            ['z', 500, 50],
        ]);
    });
});

describe('runDiscrepanciasAudit', () => {
    test('SIMULACAO não escreve nada e recalcula limite com persist:false', async () => {
        const { db, writes } = makeDb(cenarioCompleto());
        const recalc = recalcFake();

        const r = await runDiscrepanciasAudit({ db, esc, dryRun: true, recalcularLimiteDisponivel: recalc });

        expect(writes).toEqual([]);
        expect(recalc).toHaveBeenCalledWith('55555555555', { persist: false });
        expect(r.modo).toBe('SIMULACAO');
        expect(r.cpfFiltro).toBe('TODAS');
        expect(r.verificadas).toBe(3);
        expect(r.correcoes.map((c) => `${c.tipo}:${c.cpf}`).sort()).toEqual([
            'DUPLA_COBRANCA:11111111111',
            'LIMITE_NEGATIVO:55555555555',
            'PAGAMENTO_EXCESSIVO:33333333333',
            'SALDO_NEGATIVO:44444444444',
        ]);
        // Pago a mais na fechada: corrige o SALDO, nunca a fatura.
        expect(r.correcoes.find((c) => c.tipo === 'DUPLA_COBRANCA')).toMatchObject({
            alvo: 'Saldo da conta', campo: 'balance', invoiceId: 'inv-a', antes: 50, depois: 150,
        });
        expect(r.correcoes.find((c) => c.tipo === 'DUPLA_COBRANCA').motivo).toMatch(/Massa já cortada/);
        expect(r.resolvidasAntes).toBe(1);
        expect(r.pagamentosSemFatura).toEqual({ transacoes: 3, massas: 2, valor: 450.5 });
        // Limite negativo que já bate com a fórmula (estourado de verdade) vira alerta, não correção.
        expect(r.alertas.map((a) => a.tipo).sort()).toEqual(['LIMITE_ESTOURADO', 'SALDO_ZERADO_COM_DIVIDA']);
        expect(r).toMatchObject({ totalCorrecoes: 4, totalPulados: 0, totalAlertas: 2, totalErros: 0 });
    });

    test('APLICADO devolve o excedente ao saldo com lançamento REFUND marcado e nunca toca a fatura FECHADA', async () => {
        const { db, writes } = makeDb(cenarioCompleto());
        const recalc = recalcFake();

        const r = await runDiscrepanciasAudit({ db, esc, dryRun: false, recalcularLimiteDisponivel: recalc });

        expect(r.modo).toBe('APLICADO');
        expect(recalc).toHaveBeenCalledWith('55555555555', { persist: true });
        expect(writes).toEqual(expect.arrayContaining([
            expect.stringMatching(/UPDATE fintech\.users SET balance = balance \+ 100\.00,.* WHERE cpf = '11111111111'/),
            expect.stringMatching(/INSERT INTO fintech\.transactions .*'11111111111', 'REFUND', 100\.00, '.*\[excedente-fatura:inv-a\]'/),
            expect.stringMatching(/UPDATE fintech\.invoices SET valor_pago = 1000\.00,.* WHERE id = 'inv-aberta'/),
            expect.stringMatching(/UPDATE fintech\.users SET balance = balance \+ 50\.00,.* WHERE cpf = '33333333333'/),
            expect.stringMatching(/UPDATE fintech\.users SET balance = 0,.* WHERE cpf = '44444444444'/),
        ]));
        expect(writes).toHaveLength(5);
        for (const id of ['inv-a', 'inv-b', 'inv-c']) {
            expect(writes.some((w) => w.startsWith('UPDATE fintech.invoices') && w.includes(`'${id}'`))).toBe(false);
        }
    });

    test('mesma massa com 2 faturas fechadas encadeia o saldo (antes → depois)', async () => {
        const { db } = makeDb({
            faturasFechadas: [
                fechada('f1', '11111111111', { vt: 100, pago: 130, balance: 10 }),
                fechada('f2', '11111111111', { vt: 200, pago: 220, balance: 10 }),
            ],
        });

        const r = await runDiscrepanciasAudit({ db, esc, dryRun: true, recalcularLimiteDisponivel: jest.fn() });

        expect(r.correcoes.map((c) => [c.invoiceId, c.antes, c.depois])).toEqual([['f1', 10, 40], ['f2', 40, 60]]);
    });

    test('status por fatura usa o vocabulário lido pelo audit_scheduler (ok/discrepancy/resolvido)', async () => {
        const { db } = makeDb(cenarioCompleto());

        const r = await runDiscrepanciasAudit({ db, esc, dryRun: true, recalcularLimiteDisponivel: recalcFake() });

        expect(Object.fromEntries(r.duplaCobranca.map((d) => [d.invoiceId, d.status]))).toEqual({
            'inv-a': 'discrepancy', 'inv-b': 'ok', 'inv-c': 'resolvido',
        });
    });

    test('com CPF, TODAS as consultas (inclusive as de correção) ficam restritas a ele', async () => {
        const { db, selects } = makeDb({});
        await runDiscrepanciasAudit({ db, esc, cpf: '12345678900', dryRun: true, recalcularLimiteDisponivel: jest.fn() });

        expect(selects.length).toBeGreaterThan(0);
        for (const s of selects) expect(s).toContain("= '12345678900'");
    });

    test('duplaCobranca:false e auditoria2:false pulam as etapas (CLI --skip-double-count / --skip-negative)', async () => {
        const semAud1 = makeDb(cenarioCompleto());
        const r1 = await runDiscrepanciasAudit({ db: semAud1.db, esc, dryRun: true, recalcularLimiteDisponivel: recalcFake(), duplaCobranca: false });
        expect(semAud1.selects.some((s) => s.includes('AS devolvido'))).toBe(false);
        expect(r1.verificadas).toBe(0);
        expect(r1.correcoes.some((c) => c.tipo === 'DUPLA_COBRANCA')).toBe(false);

        const semAud2 = makeDb(cenarioCompleto());
        const recalc = recalcFake();
        const r2 = await runDiscrepanciasAudit({ db: semAud2.db, esc, dryRun: true, recalcularLimiteDisponivel: recalc, auditoria2: false });
        expect(recalc).not.toHaveBeenCalled();
        expect(r2.correcoes.map((c) => c.tipo)).toEqual(['DUPLA_COBRANCA']);
        expect(r2.alertas).toEqual([]);
    });

    test('pagamento excessivo (Auditoria 2) ignora fatura FECHADA', async () => {
        const { db, selects } = makeDb({});
        await runDiscrepanciasAudit({ db, esc, dryRun: true, recalcularLimiteDisponivel: jest.fn() });

        expect(selects.find((s) => s.includes('AS gross'))).toContain("i.status <> 'FECHADA'");
    });

    test('erro numa massa não derruba as outras', async () => {
        const { db } = makeDb({ limiteNegativo: [{ cpf: '55555555555' }, { cpf: '66666666666' }] });
        const recalc = jest.fn(async (cpf) => {
            if (cpf === '55555555555') throw new Error('boom');
            return { cpf, limiteAnterior: -10, limiteNovo: 90, alterado: true, estourado: false };
        });

        const r = await runDiscrepanciasAudit({ db, esc, dryRun: true, recalcularLimiteDisponivel: recalc });

        expect(r.erros).toEqual([{ cpf: '55555555555', etapa: 'LIMITE_NEGATIVO', erro: 'boom' }]);
        expect(r.correcoes.map((c) => c.cpf)).toEqual(['66666666666']);
    });
});

describe('POST /admin/scripts/audit-fix', () => {
    function makeRes() {
        const res = { statusCode: 200, body: null };
        res.status = (c) => { res.statusCode = c; return res; };
        res.json = (b) => { res.body = b; return res; };
        return res;
    }

    test('dryRun=true simula e não registra auditLog; sem dryRun aplica e registra', async () => {
        const { db, writes } = makeDb(cenarioCompleto());
        const auditLog = jest.fn();
        const controller = createAdminScriptsController({
            dbService: db, repoContext: { esc }, cardEngine: {}, auditLog,
            recalcularLimiteDisponivel: recalcFake(), listUsers: async () => [],
        });

        const simRes = makeRes();
        await controller.auditFix({ body: { cpf: '', dryRun: true } }, simRes);
        expect(simRes.body.success).toBe(true);
        expect(simRes.body.data.modo).toBe('SIMULACAO');
        expect(simRes.body.data.duplaCobranca).toBeUndefined();
        expect(writes).toHaveLength(0);
        expect(auditLog).not.toHaveBeenCalled();

        const apRes = makeRes();
        await controller.auditFix({ body: {} }, apRes);
        expect(apRes.body.data.modo).toBe('APLICADO');
        expect(auditLog).toHaveBeenCalledWith(expect.anything(), 'admin_script_audit_fix', 'info', { cpf: 'ALL', corrigidas: 4 });
    });

    test('CPF com máscara é limpo antes de filtrar', async () => {
        const { db, selects } = makeDb({});
        const controller = createAdminScriptsController({
            dbService: db, repoContext: { esc }, cardEngine: {}, auditLog: jest.fn(),
            recalcularLimiteDisponivel: jest.fn(), listUsers: async () => [],
        });
        const res = makeRes();

        await controller.auditFix({ body: { cpf: '123.456.789-00', dryRun: true } }, res);

        expect(res.body.data.cpfFiltro).toBe('12345678900');
        expect(selects.every((s) => s.includes("= '12345678900'"))).toBe(true);
    });

    test('falha no banco devolve 500 com mensagem', async () => {
        const db = { fq: (t) => t, executeQuery: jest.fn(async () => { throw new Error('conexão recusada'); }) };
        const controller = createAdminScriptsController({
            dbService: db, repoContext: { esc }, cardEngine: {}, auditLog: jest.fn(),
            recalcularLimiteDisponivel: jest.fn(), listUsers: async () => [],
        });
        const res = makeRes();

        await controller.auditFix({ body: { dryRun: true } }, res);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ success: false, message: 'Erro ao corrigir discrepâncias: conexão recusada' });
    });
});
