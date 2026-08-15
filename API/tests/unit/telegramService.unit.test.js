// Testes do telegramService: no-op sem env, formatação de CPF, cache de tópico
describe('telegramService', () => {
    beforeEach(() => {
        jest.resetModules();
        delete process.env.TELEGRAM_BOT_TOKEN;
        delete process.env.TELEGRAM_CHAT_ID;
    });

    test('no-op silencioso sem env (não lança, não chama fetch)', () => {
        const fetchSpy = jest.spyOn(global, 'fetch');
        const svc = require('../../services/telegramService');
        expect(svc._enabled).toBe(false);
        expect(() => svc.alertUser('12345678901', 'teste')).not.toThrow();
        expect(() => svc.alertGroup('teste')).not.toThrow();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    test('formatCpf formata 11 dígitos', () => {
        const svc = require('../../services/telegramService');
        expect(svc.formatCpf('99999999999')).toBe('999.999.999-99');
        expect(svc.formatCpf('12345678901')).toBe('123.456.789-01');
    });

    test('habilitado com env presente', () => {
        process.env.TELEGRAM_BOT_TOKEN = 'x';
        process.env.TELEGRAM_CHAT_ID = '-100';
        const svc = require('../../services/telegramService');
        expect(svc._enabled).toBe(true);
    });

    test('alertUser sem init(db) não lança mesmo habilitado', () => {
        process.env.TELEGRAM_BOT_TOKEN = 'x';
        process.env.TELEGRAM_CHAT_ID = '-100';
        const fetchSpy = jest.spyOn(global, 'fetch');
        const svc = require('../../services/telegramService');
        expect(() => svc.alertUser('12345678901', 'teste')).not.toThrow();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    test('ensureTopic é no-op sem env e sem db', () => {
        const fetchSpy = jest.spyOn(global, 'fetch');
        const svc = require('../../services/telegramService');
        expect(() => svc.ensureTopic('12345678901', 'Fulano')).not.toThrow();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    test('listTopics/getStatus sem init(db) retornam vazio sem lançar', async () => {
        const svc = require('../../services/telegramService');
        await expect(svc.listTopics()).resolves.toEqual([]);
        await expect(svc.getStatus()).resolves.toEqual({
            enabled: false, chatId: null, botConfigured: false, topicCount: 0
        });
    });

    test('deleteTopic sem db retorna { deleted: false }', async () => {
        const svc = require('../../services/telegramService');
        await expect(svc.deleteTopic('12345678901')).resolves.toEqual({ deleted: false });
    });

    test('sendTable envia tabela e formata adequadamente', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'x';
        process.env.TELEGRAM_CHAT_ID = '-100';
        const db = {
            fq: t => `fintech.${t}`,
            executeQuery: jest.fn().mockResolvedValue([{ topic_id: 42 }])
        };
        const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
            json: async () => ({ ok: true, result: { message_id: 2 } })
        });

        const svc = require('../../services/telegramService');
        svc.init(db);
        svc.sendTable('12345678901', 'Fatura', ['COD', 'VAL'], [['A', '10.00']]);
        await new Promise(r => setTimeout(r, 200)); // drena a fila serial

        expect(fetchSpy).toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    test('ciclo de vida com db mockado: cria tópico, lista e apaga', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'x';
        process.env.TELEGRAM_CHAT_ID = '-100';
        const rowsByQuery = { topic: [] };
        const db = {
            fq: t => `fintech.${t}`,
            executeQuery: jest.fn(async (sql) => {
                if (sql.includes('SELECT topic_id')) return rowsByQuery.topic;
                if (sql.includes('INSERT INTO')) { rowsByQuery.topic = [{ topic_id: 42 }]; return []; }
                if (sql.includes('DELETE FROM')) { rowsByQuery.topic = []; return []; }
                if (sql.includes('SELECT t.cpf')) {
                    return rowsByQuery.topic.length
                        ? [{ cpf: '12345678901', topic_id: 42, created_at: '2026-08-04', full_name: 'Fulano' }]
                        : [];
                }
                return [];
            })
        };
        const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
            json: async () => ({ ok: true, result: { message_thread_id: 42, message_id: 1 } })
        });

        const svc = require('../../services/telegramService');
        svc.init(db);
        svc.ensureTopic('12345678901', 'Fulano');
        await new Promise(r => setTimeout(r, 200)); // drena a fila serial

        expect(await svc.listTopics()).toHaveLength(1);
        expect((await svc.getStatus()).topicCount).toBe(1);

        expect(await svc.deleteTopic('12345678901')).toEqual({ deleted: true });
        expect(await svc.listTopics()).toHaveLength(0);
        fetchSpy.mockRestore();
    });
});
