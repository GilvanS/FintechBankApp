const { runDiscrepanciasAudit } = require('../../services/discrepanciasAudit');
const createAdminScriptsController = require('../../src/controllers/adminScriptsController');

const esc = (v) => `'${String(v).replace(/'/g, "''")}'`;

/**
 * Banco falso: responde por trecho de SQL e guarda todo UPDATE executado.
 * `dados` define o retorno de cada consulta do serviço.
 */
function makeDb(dados = {}) {
    const updates = [];
    const selects = [];
    const executeQuery = jest.fn(async (sql) => {
        const s = sql.replace(/\s+/g, ' ').trim();
        if (s.startsWith('UPDATE')) { updates.push(s); return []; }
        selects.push(s);
        if (s.includes('SELECT DISTINCT t.cpf')) return dados.comPagamento || [];
        if (s.includes("type = 'INVOICE_PAYMENT'")) return (dados.pagamentos || {})[s.match(/cpf = '(\d+)'/)[1]] || [];
        if (s.includes('COALESCE(valor_pago, 0) > 0')) return (dados.faturasPagas || {})[s.match(/cpf = '(\d+)'/)[1]] || [];
        if (s.includes("status = 'FECHADA' AND data_pagamento IS NULL ORDER BY due_date DESC LIMIT 1")) return dados.fechadaEmAberto || [];
        if (s.includes('AS gross')) return dados.excessivos || [];
        if (s.includes('balance < 0')) return dados.saldoNegativo || [];
        if (s.includes('credit_card_available_limit < 0')) return dados.limiteNegativo || [];
        if (s.includes('AS divida')) return dados.alertas || [];
        return [];
    });
    return { db: { executeQuery, fq: (t) => `fintech.${t}` }, updates, selects };
}

const cenarioCompleto = () => ({
    comPagamento: [{ cpf: '11111111111', full_name: 'Ana' }, { cpf: '22222222222', full_name: 'Bia' }],
    pagamentos: {
        '11111111111': [{ amount: -100 }],
        '22222222222': [{ amount: -100 }],
    },
    faturasPagas: {
        // Ana: faturas registram 120 para 100 pagos → excesso 20 (20%) → corrige.
        '11111111111': [{ id: 'inv-a', valor_total: 500, valor_pago: 120, data_pagamento: null }],
        // Bia: 300 para 100 pagos → 200% → pulado (análise manual).
        '22222222222': [{ id: 'inv-b', valor_total: 500, valor_pago: 300, data_pagamento: null }],
    },
    excessivos: [{ cpf: '33333333333', full_name: 'Caio', id: 'inv-c', valor_pago: 1050, gross: 1000 }],
    saldoNegativo: [{ cpf: '44444444444', full_name: 'Duda', balance: -35.5 }],
    limiteNegativo: [{ cpf: '55555555555', full_name: 'Edu' }, { cpf: '66666666666', full_name: 'Fé' }],
    alertas: [{ cpf: '77777777777', full_name: 'Gil', balance: 0, divida: 800 }],
});

const recalcFake = () => jest.fn(async (cpf) => (cpf === '55555555555'
    ? { cpf, fullName: 'Edu', limiteAnterior: -300, limiteNovo: 120, alterado: true, estourado: false, currentInvoiceTotal: 880 }
    : { cpf, fullName: 'Fé', limiteAnterior: -50, limiteNovo: -50, alterado: false, estourado: true, currentInvoiceTotal: 1050 }));

describe('runDiscrepanciasAudit', () => {
    test('SIMULACAO não executa nenhum UPDATE e recalcula limite com persist:false', async () => {
        const { db, updates } = makeDb(cenarioCompleto());
        const recalc = recalcFake();

        const r = await runDiscrepanciasAudit({ db, esc, dryRun: true, recalcularLimiteDisponivel: recalc });

        expect(updates).toEqual([]);
        expect(recalc).toHaveBeenCalledWith('55555555555', { persist: false });
        expect(r.modo).toBe('SIMULACAO');
        expect(r.cpfFiltro).toBe('TODAS');
        expect(r.correcoes.map((c) => `${c.tipo}:${c.cpf}`).sort()).toEqual([
            'DUPLA_COBRANCA:11111111111',
            'LIMITE_NEGATIVO:55555555555',
            'PAGAMENTO_EXCESSIVO:33333333333',
            'SALDO_NEGATIVO:44444444444',
        ]);
        expect(r.correcoes.find((c) => c.tipo === 'DUPLA_COBRANCA')).toMatchObject({ antes: 120, depois: 100 });
        expect(r.correcoes.find((c) => c.tipo === 'PAGAMENTO_EXCESSIVO')).toMatchObject({ antes: 1050, depois: 1000 });
        expect(r.pulados).toEqual([expect.objectContaining({ cpf: '22222222222', tipo: 'DUPLA_COBRANCA' })]);
        // Limite negativo que já bate com a fórmula (estourado de verdade) vira alerta, não correção.
        expect(r.alertas.map((a) => a.tipo).sort()).toEqual(['LIMITE_ESTOURADO', 'SALDO_ZERADO_COM_DIVIDA']);
        expect(r).toMatchObject({ totalCorrecoes: 4, totalPulados: 1, totalAlertas: 2, totalErros: 0 });
    });

    test('APLICADO grava as mesmas correções mostradas na simulação', async () => {
        const { db, updates } = makeDb(cenarioCompleto());
        const recalc = recalcFake();

        const r = await runDiscrepanciasAudit({ db, esc, dryRun: false, recalcularLimiteDisponivel: recalc });

        expect(r.modo).toBe('APLICADO');
        expect(recalc).toHaveBeenCalledWith('55555555555', { persist: true });
        expect(updates).toEqual(expect.arrayContaining([
            expect.stringMatching(/UPDATE fintech\.invoices SET valor_pago = 100\.00,.* WHERE id = 'inv-a'/),
            expect.stringMatching(/UPDATE fintech\.invoices SET valor_pago = 1000\.00,.* WHERE id = 'inv-c'/),
            expect.stringMatching(/UPDATE fintech\.users SET balance = balance \+ 50\.00,.* WHERE cpf = '33333333333'/),
            expect.stringMatching(/UPDATE fintech\.users SET balance = 0, .* WHERE cpf = '44444444444'/),
        ]));
        // Pulado (>50%) nunca é gravado.
        expect(updates.some((u) => u.includes("'inv-b'"))).toBe(false);
        expect(updates).toHaveLength(4);
    });

    test('com CPF, TODAS as consultas (inclusive as de correção) ficam restritas a ele', async () => {
        const { db, selects } = makeDb({});
        await runDiscrepanciasAudit({ db, esc, cpf: '12345678900', dryRun: true, recalcularLimiteDisponivel: jest.fn() });

        expect(selects.length).toBeGreaterThan(0);
        for (const s of selects) expect(s).toContain("= '12345678900'");
    });

    test('pagamentos acima do valor_pago somam na fatura FECHADA em aberto mais recente', async () => {
        const { db, updates } = makeDb({
            comPagamento: [{ cpf: '11111111111', full_name: 'Ana' }],
            pagamentos: { '11111111111': [{ amount: -300 }] },
            faturasPagas: { '11111111111': [{ id: 'inv-velha', valor_total: 500, valor_pago: 100, data_pagamento: '2026-08-01' }] },
            fechadaEmAberto: [{ id: 'inv-aberta', valor_pago: 50 }],
        });

        const r = await runDiscrepanciasAudit({ db, esc, dryRun: false, recalcularLimiteDisponivel: jest.fn() });

        expect(r.correcoes).toEqual([expect.objectContaining({ alvo: 'Fatura inv-aberta', antes: 50, depois: 250 })]);
        expect(updates).toEqual([expect.stringMatching(/valor_pago = 250\.00,.* WHERE id = 'inv-aberta'/)]);
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
        const { db, updates } = makeDb(cenarioCompleto());
        const auditLog = jest.fn();
        const controller = createAdminScriptsController({
            dbService: db, repoContext: { esc }, cardEngine: {}, auditLog,
            recalcularLimiteDisponivel: recalcFake(), listUsers: async () => [],
        });

        const simRes = makeRes();
        await controller.auditFix({ body: { cpf: '', dryRun: true } }, simRes);
        expect(simRes.body.success).toBe(true);
        expect(simRes.body.data.modo).toBe('SIMULACAO');
        expect(updates).toHaveLength(0);
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
