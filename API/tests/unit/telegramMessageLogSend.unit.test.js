// Verifica que telegramService.send()/sendDocument() gravam no log persistente
// (telegram_message_log) após resolver cada destino — sucesso com message_id,
// falha com error. Falha do log nunca bloqueia o envio.

describe('telegramService → log persistente (telegram_message_log)', () => {
    let svc;
    let repoMock;
    let fetchSpy;
    const logAdds = [];

    beforeEach(() => {
        jest.resetModules();
        process.env.TELEGRAM_BOT_TOKEN = 'x';
        process.env.TELEGRAM_CHAT_ID = '-100';

        repoMock = {
            getSetting: jest.fn(),
            getPersistentTopic: jest.fn()
        };
        jest.doMock('../../repositories/telegramSettingsRepo', () => repoMock);

        // Mock do log repo: coleta os add() sem tocar em banco.
        const logRepoMock = {
            ensureTable: jest.fn().mockResolvedValue(),
            add: jest.fn(async (entry) => { logAdds.push(entry); })
        };
        jest.doMock('../../repositories/telegramMessageLogRepo', () => logRepoMock);

        const db = {
            fq: t => `fintech.${t}`,
            executeQuery: jest.fn().mockResolvedValue([])
        };

        svc = require('../../services/telegramService');
        svc.init(db);

        fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
            json: async () => ({ ok: true, result: { message_id: 1, message_thread_id: 1 } })
        });
        jest.spyOn(console, 'debug').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(async () => {
        fetchSpy.mockRestore();
        console.debug.mockRestore();
        console.warn.mockRestore();
        logAdds.length = 0;
        jest.clearAllTimers();
        if (svc && svc._resetQueue) await svc._resetQueue();
    });

    test('send grava uma linha por destino (cpf, pagamentos, general) com message_id', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'purchase', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        repoMock.getPersistentTopic.mockResolvedValue({ name: 'pagamentos', topic_id: 999 });

        await svc.send('purchase', { cpf: '12345678901', nome: 'Fulano', text: 'compra' });
        await new Promise(r => setTimeout(r, 500));

        expect(logAdds.length).toBe(3);
        const dests = logAdds.map(e => e.destination).sort();
        expect(dests).toEqual(['cpf', 'general', 'pagamentos']);
        logAdds.forEach(e => {
            expect(e.category).toBe('purchase');
            expect(e.ok).toBe(true);
            expect(e.messageId).toBeDefined();
            expect(e.messageType).toBe('text');
        });
        const cpfEntry = logAdds.find(e => e.destination === 'cpf');
        expect(cpfEntry.cpf).toBe('12345678901');
        expect(cpfEntry.topicId).toBeDefined();
    });

    test('send grava error (ok=false) quando o fetch falha em um destino', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'purchase', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        repoMock.getPersistentTopic.mockResolvedValue({ name: 'pagamentos', topic_id: 999 });
        fetchSpy.mockRejectedValue(new Error('TimeoutError: bot fora'));

        await svc.send('purchase', { cpf: '12345678901', nome: 'Fulano', text: 'compra' });
        await new Promise(r => setTimeout(r, 500));

        expect(logAdds.length).toBe(3);
        logAdds.forEach(e => {
            expect(e.ok).toBe(false);
            expect(e.error).toMatch(/bot fora/);
        });
    });

    test('sendDocument grava linha com message_type=document e message_id', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'payment_receipt', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });

        const res = await svc.sendDocument('12345678901', Buffer.from('%PDF-1.4 teste'), 'comprovante.pdf', 'payment_receipt');
        await new Promise(r => setTimeout(r, 300));

        expect(res.sent).toBe(true);
        expect(logAdds.length).toBe(1);
        const e = logAdds[0];
        expect(e.destination).toBe('cpf');
        expect(e.messageType).toBe('document');
        expect(e.category).toBe('payment_receipt');
        expect(e.ok).toBe(true);
        expect(e.messageId).toBeDefined();
    });

    test('sendDocument grava error quando o fetch falha', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'payment_receipt', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        fetchSpy.mockRejectedValue(new Error('TimeoutError: bot fora'));

        const res = await svc.sendDocument('12345678901', Buffer.from('%PDF'), 'x.pdf', 'payment_receipt');
        await new Promise(r => setTimeout(r, 300));

        expect(res.sent).toBe(false);
        expect(logAdds.length).toBe(1);
        expect(logAdds[0].ok).toBe(false);
        expect(logAdds[0].error).toMatch(/bot fora/);
    });

    test('categoria desabilitada: send não grava log (no-op silencioso)', async () => {
        repoMock.getSetting.mockResolvedValue({ category: 'welcome', enabled: false });

        const res = await svc.send('welcome', { cpf: '12345678901', text: 'oi' });

        expect(res.sent).toBe(false);
        expect(logAdds.length).toBe(0);
    });
});
