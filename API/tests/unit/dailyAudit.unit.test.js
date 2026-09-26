const { runDailyAudit } = require('../../services/dailyAudit');

describe('dailyAudit service unit tests', () => {
    let mockDb;
    let mockAuditLog;
    let telegramService;

    beforeEach(() => {
        mockDb = {
            fq: jest.fn(t => `"${t}"`),
            generateUUID: jest.fn(() => 'test-uuid'),
            executeQuery: jest.fn()
        };
        mockAuditLog = jest.fn();

        // Mock do telegramService para capturar mensagens sem enviar ao Telegram real
        telegramService = require('../../services/telegramService');
        telegramService.alertGroup = jest.fn();
    });

    test('deve identificar anomalia 1: pagamento parcial após vencimento sem novos encargos', async () => {
        // Mock das faturas vencidas não pagas
        mockDb.executeQuery.mockImplementation(async (query) => {
            if (query.includes('array_agg') || (query.includes('COUNT(*)') && query.includes('HAVING'))) {
                return []; // FATURA_DUPLICADA query — sem duplicatas
            }
            // A Anomalia 8 junta o residual da cascata (sqlResidualFechadas, também com
            // COALESCE): não é a query da Anomalia 1 e não pode receber esta fatura.
            if (query.includes('FROM "invoices"') && query.includes('COALESCE') && !query.includes('AS residual')) {
                return [{
                    id: 'inv-1',
                    cpf: '12345678901',
                    full_name: 'Usuario Teste',
                    due_date: new Date('2026-07-01'),
                    valor_total: 1000.00,
                    valor_pago: 200.00,
                    credit_card_due_day: 1
                }];
            }
            if (query.includes('FROM "billing_charges"')) {
                return []; // Nenhum encargo gerado
            }
            return [];
        });

        const result = await runDailyAudit(mockDb, mockAuditLog);
        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
        expect(result.errors[0].type).toBe('PAGAMENTO_PARCIAL_SEM_ENCARGOS');
        expect(mockAuditLog).toHaveBeenCalled();
        expect(telegramService.alertGroup).toHaveBeenCalledWith(expect.stringContaining('PAGAMENTO_PARCIAL_SEM_ENCARGOS'), 'daily_anomaly');
    });

    test('deve identificar anomalia 2: saldo credor estacionado > 30 dias', async () => {
        mockDb.executeQuery.mockImplementation(async (query) => {
            if (query.includes('FROM "users"') && query.includes('available_limit >')) {
                return [{
                    cpf: '12345678901',
                    full_name: 'Usuario Teste',
                    credit_card_available_limit: 6000.00,
                    credit_card_total_limit: 5000.00,
                    updated_at: new Date('2026-06-01')
                }];
            }
            return [];
        });

        const result = await runDailyAudit(mockDb, mockAuditLog);
        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
        expect(result.errors[0].type).toBe('SALDO_CREDOR_ESTACIONADO');
    });

    test('deve identificar anomalia 3: limite de crédito excedido em aberto', async () => {
        mockDb.executeQuery.mockImplementation(async (query) => {
            if (query.includes('FROM "users"') && query.includes('available_limit < 0')) {
                return [{
                    cpf: '12345678901',
                    full_name: 'Usuario Teste',
                    credit_card_available_limit: -50.00
                }];
            }
            return [];
        });

        const result = await runDailyAudit(mockDb, mockAuditLog);
        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
        expect(result.errors[0].type).toBe('LIMITE_EXCEDIDO');
    });

    test('deve identificar anomalia 4: encargos zerados com saldo devedor positivo', async () => {
        mockDb.executeQuery.mockImplementation(async (query) => {
            // Query de chargesProactiveFix.js (Anomalia 8b, chamada por runDailyAudit)
            // também referencia "billing_charges" — precisa casar ANTES do match
            // genérico abaixo (que é específico da Anomalia 4), senão o retorno
            // {total:0} é interpretado como invoice candidata (cpf undefined).
            if (query.includes('LATERAL')) {
                return []; // Nenhuma invoice com encargo divergente — Anomalia 8b não dispara aqui.
            }
            if (query.includes('FROM "users"') && query.includes('account_status = \'inadimplente\'')) {
                return [{
                    cpf: '12345678901',
                    full_name: 'Usuario Teste',
                    days_overdue: 15
                }];
            }
            // Só a soma de encargos da Anomalia 4: a Anomalia 8 também cita billing_charges
            // (NOT EXISTS de encargo já quitado por pagamento) e não pode receber este mock.
            if (query.includes('FROM "billing_charges"') && query.includes('SUM(amount)')) {
                return [{ total: 0 }]; // Nenhuma cobrança ativa de multa/juros
            }
            return [];
        });

        const result = await runDailyAudit(mockDb, mockAuditLog);
        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
        expect(result.errors[0].type).toBe('INADIMPLENTE_SEM_ENCARGOS');
    });

    test('deve identificar anomalia 5: transações de cartão órfãs', async () => {
        mockDb.executeQuery.mockImplementation(async (query) => {
            if (query.includes('FROM "transactions"') && query.includes('INVOICE_INSTALLMENT')) {
                return [{
                    cpf: '12345678901',
                    id: 'tx-orfa',
                    description: 'Loja Teste (1/5)',
                    amount: -50.00,
                    date: new Date(),
                    full_name: 'Usuario Teste'
                }];
            }
            return [];
        });

        const result = await runDailyAudit(mockDb, mockAuditLog);
        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
        expect(result.errors[0].type).toBe('TRANSACAO_ORFA');
    });

    test('deve identificar anomalia 10: ciclo de fatura perdido reconstruído vincula antecipação pendente', async () => {
        // Reproduz o mesmo cálculo de datas do próprio bloco Anomalia 10 (setMonth),
        // pra não depender de suposições sobre duração de mês/dia em que o teste roda.
        const now = new Date();
        const dueDateAberta = new Date(now); // due_date rastreado (drift) do ciclo aberto atual
        const cicloPerdidoDue = new Date(dueDateAberta);
        cicloPerdidoDue.setMonth(cicloPerdidoDue.getMonth() - 1); // 1º ciclo perdido, calculado igual ao código
        const createdAt = new Date(cicloPerdidoDue);
        createdAt.setDate(createdAt.getDate() - 10); // created_at logo antes do ciclo perdido: só 1 ciclo a reconstruir

        mockDb.executeQuery.mockImplementation(async (query) => {
            if (query.includes('LIMIT 80')) {
                // usersParaCiclosPerdidos (Anomalia 10)
                return [{
                    cpf: '12345678901',
                    full_name: 'Usuario Teste',
                    credit_card_due_day: 10,
                    credit_card_invoice_due_date: dueDateAberta.toISOString(),
                    created_at: createdAt.toISOString()
                }];
            }
            if (query.includes('EXTRACT(YEAR FROM due_date)')) {
                return []; // nenhuma fatura FECHADA já cobre esse ciclo — precisa reconstruir
            }
            if (query.includes("type IN ('SHOP_CREDIT'")) {
                return [{ amount: '150.00' }]; // compras existentes no ciclo perdido
            }
            return [];
        });

        const result = await runDailyAudit(mockDb, mockAuditLog);

        expect(result.success).toBe(true);
        expect(result.errors.some(e => e.type === 'CICLO_PERDIDO_FECHADO')).toBe(true);

        // A antecipação (§25: INVOICE_PAYMENT com invoice_id NULL e applied_to_charges
        // preenchido) precisa ser vinculada ao ciclo reconstruído, senão fica órfã pra
        // sempre e recria o double-charge que todo o plano existe pra eliminar.
        const linkCall = mockDb.executeQuery.mock.calls.find(([q]) =>
            q.includes('UPDATE') &&
            q.includes('transactions') &&
            q.includes("type = 'INVOICE_PAYMENT'") &&
            q.includes('invoice_id IS NULL') &&
            q.includes('applied_to_charges IS NOT NULL') &&
            q.includes('test-uuid') &&
            q.includes('12345678901')
        );
        expect(linkCall).toBeDefined();

        // Nunca deve tocar órfãos legados (applied_to_charges IS NULL) — regra global do plano.
        expect(linkCall[0]).not.toMatch(/applied_to_charges IS NULL/);
    });
});
