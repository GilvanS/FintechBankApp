/**
 * Testes Unitários e Integrados - Motor de Recorrência (recurringEngine) & Retry Policy
 */
require('dotenv').config();
const { runEngine } = require('../../services/recurringEngine');
const recurringBillsRepo = require('../../repositories/recurringBillsRepo');
const repoContext = require('../../repositories/context');
const PostgresProvider = require('../../services/database/PostgresProvider');

describe('Motor de Assinaturas e Recorrência (recurringEngine)', () => {

    beforeAll(async () => {
        const config = {
            schema: process.env.DB_SCHEMA || 'fintech',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'pwd123',
            database: process.env.DB_NAME || 'fintechbank'
        };
        const provider = new PostgresProvider(config);
        await provider.connect();
        repoContext.setDb(provider);
    });

    test('Deve garantir a sincronização do schema no banco de dados', async () => {
        const plansRepo = require('../../repositories/plansRepo');
        await expect(plansRepo.ensureTable()).resolves.not.toThrow();
        await expect(recurringBillsRepo.ensureTable()).resolves.not.toThrow();
    });

    test('Deve processar uma cobrança com sucesso quando há limite/saldo', async () => {
        const testCpf = '04617745777';
        
        // Executar o motor para o CPF de teste
        const result = await runEngine(testCpf);
        
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(typeof result.processedCount).toBe('number');
    });

    test('Deve aplicar a Política de Retentativas (Retry Policy) em caso de falha', async () => {
        const testCpf = '99999999999'; // CPF sem limite/saldo

        // Criar uma assinatura fictícia com saldo 0
        const bill = await recurringBillsRepo.create({
            cpf: testCpf,
            name: 'Serviço de Teste Retentativa',
            amount: 999999.00, // Valor alto para forçar falha
            dueDay: 1,
            category: 'outros',
            frequency: 'MONTHLY',
            paymentMethod: 'ACCOUNT_DEBIT'
        });

        // Executar o motor 1ª vez -> deve marcar past_due e retry_count = 1
        const result1 = await runEngine(testCpf);
        expect(result1.failedCount).toBeGreaterThan(0);

        const list1 = await recurringBillsRepo.list(testCpf);
        const updatedBill1 = list1.find(b => b.id === bill.id);
        expect(updatedBill1).toBeDefined();
        expect(updatedBill1.status).toBe('past_due');
        expect(updatedBill1.retryCount).toBe(1);

        // Limpeza
        await recurringBillsRepo.remove({ cpf: testCpf, billId: bill.id });
    });
});
