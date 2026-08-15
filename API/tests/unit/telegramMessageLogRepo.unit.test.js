// Testes do telegramMessageLogRepo: add/listByCpf/listRecent/ensureTable via
// mock do DB service (mesmo padrão do telegramSettingsRepo.unit.test.js).

describe('telegramMessageLogRepo', () => {
    let context;
    let repo;

    function makeMockDb() {
        const calls = [];
        return {
            calls,
            fq: (name) => `fintech.${name}`,
            executeQuery: jest.fn(async (sql) => {
                calls.push(sql);
                if (/CREATE INDEX IF NOT EXISTS/.test(sql)) return [];
                if (/CREATE TABLE IF NOT EXISTS/.test(sql)) return [];
                if (/^INSERT INTO/.test(sql)) return [];
                if (/SELECT id, cpf, topic_id/.test(sql)) {
                    const whereCpf = /cpf = '(\d+)'/.exec(sql);
                    const rows = [
                        { id: 2, cpf: '12345678901', topic_id: 7, category: 'purchase', destination: 'cpf', message_type: 'text', message_id: 101, ok: true, error: null, created_at: '2026-08-15 10:00:00' },
                        { id: 1, cpf: '12345678901', topic_id: 7, category: 'purchase', destination: 'general', message_type: 'text', message_id: 102, ok: true, error: null, created_at: '2026-08-15 09:59:00' }
                    ];
                    if (whereCpf) return rows.filter(r => r.cpf === whereCpf[1]);
                    return rows;
                }
                return [];
            })
        };
    }

    beforeEach(() => {
        jest.resetModules();
        context = require('../../repositories/context');
        repo = require('../../repositories/telegramMessageLogRepo');
    });

    test('ensureTable cria a tabela e o índice', async () => {
        const mockDb = makeMockDb();
        context.setDb(mockDb);

        await repo.ensureTable();

        const creates = mockDb.calls.filter(s => /CREATE TABLE IF NOT EXISTS/.test(s));
        expect(creates.length).toBeGreaterThanOrEqual(1);
        expect(creates[0]).toMatch(/telegram_message_log/);
        const indexes = mockDb.calls.filter(s => /CREATE INDEX IF NOT EXISTS/.test(s));
        expect(indexes.length).toBeGreaterThanOrEqual(1);
    });

    test('add insere linha com os campos do destino', async () => {
        const mockDb = makeMockDb();
        context.setDb(mockDb);

        await repo.add({
            cpf: '12345678901',
            topicId: 7,
            category: 'purchase',
            destination: 'cpf',
            messageType: 'text',
            messageId: 101,
            ok: true
        });

        const insert = mockDb.calls.find(s => /INSERT INTO fintech\.telegram_message_log/.test(s));
        expect(insert).toBeDefined();
        expect(insert).toContain("'12345678901'");
        expect(insert).toContain("'purchase'");
        expect(insert).toContain("'cpf'");
        expect(insert).toContain("'text'");
        expect(insert).toContain('101');
        expect(insert).toContain('true');
    });

    test('add grava erro sem message_id quando falha', async () => {
        const mockDb = makeMockDb();
        context.setDb(mockDb);

        await repo.add({
            cpf: '12345678901',
            topicId: null,
            category: 'purchase',
            destination: 'general',
            messageType: 'text',
            messageId: null,
            ok: false,
            error: 'TimeoutError: bot fora'
        });

        const insert = mockDb.calls.find(s => /INSERT INTO fintech\.telegram_message_log/.test(s));
        expect(insert).toMatch(/false/);
        expect(insert).toMatch(/TimeoutError: bot fora/);
        expect(insert).toMatch(/NULL/); // message_id null
    });

    test('listByCpf retorna apenas as linhas do CPF, mais recentes primeiro', async () => {
        const mockDb = makeMockDb();
        context.setDb(mockDb);

        const rows = await repo.listByCpf('12345678901');

        expect(rows.length).toBe(2);
        expect(rows[0].id).toBe(2);
        expect(rows.every(r => r.cpf === '12345678901')).toBe(true);
        // ensureTable rodou antes do SELECT
        expect(mockDb.calls[0]).toMatch(/CREATE TABLE IF NOT EXISTS/);
    });

    test('listRecent aplica filtro por categoria e limit', async () => {
        const mockDb = makeMockDb();
        context.setDb(mockDb);

        const rows = await repo.listRecent({ category: 'purchase', limit: 5 });

        expect(Array.isArray(rows)).toBe(true);
        expect(rows.length).toBeGreaterThanOrEqual(1);
        const select = mockDb.calls.find(s => /SELECT id, cpf, topic_id/.test(s));
        expect(select).toMatch(/category = 'purchase'/);
        expect(select).toMatch(/LIMIT 5/);
    });

    test('sem CPF/categoria: listRecent varre tudo sem WHERE', async () => {
        const mockDb = makeMockDb();
        context.setDb(mockDb);

        await repo.listRecent({});

        const select = mockDb.calls.find(s => /SELECT id, cpf, topic_id/.test(s));
        expect(select).not.toMatch(/WHERE/);
    });
});
