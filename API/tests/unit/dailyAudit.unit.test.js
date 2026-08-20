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
            if (query.includes('FROM "invoices"')) {
                return [{
                    cpf: '12345678901',
                    full_name: 'Usuario Teste',
                    due_date: new Date('2026-07-01'),
                    valor_total: 1000.00,
                    valor_pago: 200.00
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
            if (query.includes('FROM "users"') && query.includes('account_status = \'inadimplente\'')) {
                return [{
                    cpf: '12345678901',
                    full_name: 'Usuario Teste',
                    days_overdue: 15
                }];
            }
            if (query.includes('FROM "billing_charges"')) {
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
});
