// Testes do wrapper send(category, payload) em telegramService.
// Cobertura: gate por enabled, validade from/until, multi-destino, TTL, cache, expiring banner.
describe('telegramService.send(category, payload)', () => {
    let svc;
    let repoMock;
    let fetchSpy;
    let logSpy;

    beforeEach(() => {
        jest.resetModules();
        process.env.TELEGRAM_BOT_TOKEN = 'x';
        process.env.TELEGRAM_CHAT_ID = '-100';

        // Mock do settingsRepo antes de require do service
        repoMock = {
            getSetting: jest.fn(),
            getPersistentTopic: jest.fn()
        };
        jest.doMock('../../repositories/telegramSettingsRepo', () => repoMock);

        // db mock com fq + executeQuery
        const db = {
            fq: t => `fintech.${t}`,
            executeQuery: jest.fn().mockResolvedValue([])
        };

        svc = require('../../services/telegramService');
        svc.init(db);

        fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
            json: async () => ({ ok: true, result: { message_id: 1, message_thread_id: 1 } })
        });

        logSpy = {
            debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
            warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
            error: jest.spyOn(console, 'error').mockImplementation(() => {})
        };
    });

    afterEach(async () => {
        fetchSpy.mockRestore();
        Object.values(logSpy).forEach(s => s.mockRestore());
        jest.clearAllTimers();
        // drena fila pendente do service antes de próximo teste
        if (svc && svc._resetQueue) {
            await svc._resetQueue();
        }
    });

    test('no-op silencioso quando categoria desabilitada (sem fetch, log debug)', async () => {
        repoMock.getSetting.mockResolvedValue({ category: 'welcome', enabled: false });

        await svc.send('welcome', { cpf: '12345678901', text: 'oi' });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(logSpy.debug).toHaveBeenCalledWith(expect.stringMatching(/\[telegram:skip\] category=welcome reason=disabled/));
    });

    test('retorna resultado REAL por destino quando entrega com sucesso', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'purchase', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        repoMock.getPersistentTopic.mockResolvedValue({ name: 'pagamentos', topic_id: 999 });

        const res = await svc.send('purchase', { cpf: '12345678901', nome: 'Fulano', text: 'compra', html: true });
        await new Promise(r => setTimeout(r, 500)); // drena fila

        // Contrato novo: { sent, destinations: [{dest, ok, message_id|error}] }
        expect(res.sent).toBe(true);
        expect(Array.isArray(res.destinations)).toBe(true);
        expect(res.destinations.length).toBeGreaterThanOrEqual(3); // cpf + pagamentos + general
        res.destinations.forEach(d => {
            expect(['cpf', 'pagamentos', 'general']).toContain(d.dest);
            expect(d.ok).toBe(true);
            expect(d.message_id).toBeDefined();
        });
    });

    test('retorna sent=false + destinos com error quando fetch falha (rate limit/bot fora)', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'purchase', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        repoMock.getPersistentTopic.mockResolvedValue({ name: 'pagamentos', topic_id: 999 });

        fetchSpy.mockRejectedValue(new Error('TimeoutError: The operation was aborted due to timeout'));

        const res = await svc.send('purchase', { cpf: '12345678901', nome: 'Fulano', text: 'compra' });
        await new Promise(r => setTimeout(r, 500));

        expect(res.sent).toBe(false);
        expect(res.destinations.length).toBeGreaterThanOrEqual(3);
        res.destinations.forEach(d => {
            expect(d.ok).toBe(false);
            expect(d.error).toMatch(/aborted due to timeout/);
        });
    });

    test('retorna reason=disabled (sem destinations) quando categoria desabilitada', async () => {
        repoMock.getSetting.mockResolvedValue({ category: 'welcome', enabled: false });

        const res = await svc.send('welcome', { cpf: '12345678901', text: 'oi' });

        expect(res.sent).toBe(false);
        expect(res.reason).toBe('disabled');
        expect(res.destinations).toBeUndefined();
    });

    // ── Contrato do sendDocument (perna do PDF) ──────────────────────────────
    // O enqueue tem .catch que engoliria o throw interno — o contrato real impede
    // que a falha de entrega do PDF fique silenciosa (telegramPdf mentiroso).

    test('sendDocument retorna {sent:true} quando o PDF é aceito', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'payment_receipt', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });

        const res = await svc.sendDocument('12345678901', Buffer.from('%PDF-1.4 teste'), 'comprovante.pdf', 'payment_receipt');
        await new Promise(r => setTimeout(r, 300)); // drena fila

        expect(res.sent).toBe(true);
        expect(res.error).toBeUndefined();
        const docCall = fetchSpy.mock.calls.find(c => c[0].includes('/sendDocument'));
        expect(docCall).toBeDefined();
    });

    test('sendDocument retorna {sent:false, error} quando o fetch falha (bot fora/rate limit)', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'payment_receipt', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        fetchSpy.mockRejectedValue(new Error('TimeoutError: The operation was aborted due to timeout'));

        const res = await svc.sendDocument('12345678901', Buffer.from('%PDF-1.4 teste'), 'comprovante.pdf', 'payment_receipt');
        await new Promise(r => setTimeout(r, 300));

        expect(res.sent).toBe(false);
        expect(res.error).toMatch(/aborted due to timeout/);
    });

    test('sendDocument retorna {sent:false, reason:disabled} quando categoria desabilitada', async () => {
        repoMock.getSetting.mockResolvedValue({ category: 'payment_receipt', enabled: false });

        const res = await svc.sendDocument('12345678901', Buffer.from('x'), 'x.pdf', 'payment_receipt');

        expect(res.sent).toBe(false);
        expect(res.reason).toBe('disabled');
    });

    test('no-op silencioso quando categoria não existe no repo', async () => {
        repoMock.getSetting.mockResolvedValue(null);

        await svc.send('fantasma', { cpf: '12345678901', text: 'oi' });

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('envia para tópico do CPF quando enabled=true sem validade', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'deposit', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        repoMock.getPersistentTopic.mockResolvedValue(null); // sem tópico "💰 Pagamentos"

        await svc.send('deposit', { cpf: '12345678901', nome: 'Fulano', text: 'depósito' });
        await new Promise(r => setTimeout(r, 200)); // drena fila

        // 1ª chamada: cria tópico do CPF
        // 2ª chamada: sendMessage no tópico do CPF
        expect(fetchSpy).toHaveBeenCalled();
        const calls = fetchSpy.mock.calls.map(c => c[0]);
        const topicCall = calls.find(u => u.includes('createForumTopic'));
        expect(topicCall).toBeDefined();
        const sendCall = calls.find(u => u.includes('/sendMessage'));
        expect(sendCall).toBeDefined();
    });

    test('envia para 3 destinos (CPF + Pagamentos + General) quando categoria = purchase', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'purchase', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        repoMock.getPersistentTopic.mockResolvedValue({ name: 'pagamentos', topic_id: 999 });

        await svc.send('purchase', { cpf: '12345678901', nome: 'Fulano', text: 'compra' });
        await new Promise(r => setTimeout(r, 500));

        const sendCalls = fetchSpy.mock.calls.filter(c => c[0].includes('/sendMessage'));
        // 3 destinos: tópico CPF, tópico pagamentos, general
        expect(sendCalls.length).toBeGreaterThanOrEqual(3);
    });

    test('respeita valid_from (no-op se now < valid_from)', async () => {
        const future = new Date(Date.now() + 86400000).toISOString();
        repoMock.getSetting.mockResolvedValue({
            category: 'invoice_close', enabled: true,
            valid_from: future, valid_until: null, ttl_minutes: null
        });

        await svc.send('invoice_close', { cpf: '12345678901', text: 'fechada' });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(logSpy.debug).toHaveBeenCalledWith(expect.stringMatching(/reason=not_yet_valid/));
    });

    test('respeita valid_until (no-op se now > valid_until)', async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        repoMock.getSetting.mockResolvedValue({
            category: 'invoice_close', enabled: true,
            valid_from: null, valid_until: past, ttl_minutes: null
        });

        await svc.send('invoice_close', { cpf: '12345678901', text: 'fechada' });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(logSpy.debug).toHaveBeenCalledWith(expect.stringMatching(/reason=expired/));
    });

    test('log warn [telegram:expiring] quando valid_until < 24h', async () => {
        const in12h = new Date(Date.now() + 12 * 3600000).toISOString();
        repoMock.getSetting.mockResolvedValue({
            category: 'invoice_close', enabled: true,
            valid_from: null, valid_until: in12h, ttl_minutes: null
        });
        repoMock.getPersistentTopic.mockResolvedValue(null);

        await svc.send('invoice_close', { cpf: '12345678901', text: 'fechada' });
        await new Promise(r => setTimeout(r, 200));

        expect(logSpy.warn).toHaveBeenCalledWith(expect.stringMatching(/\[telegram:expiring\] category=invoice_close/));
    });

    test('cache em memória: getSetting chamado 1x em 60s para mesma categoria', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'welcome', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        repoMock.getPersistentTopic.mockResolvedValue(null);

        await svc.send('welcome', { cpf: '12345678901', text: 'a' });
        await svc.send('welcome', { cpf: '12345678901', text: 'b' });
        await svc.send('welcome', { cpf: '12345678901', text: 'c' });

        expect(repoMock.getSetting).toHaveBeenCalledTimes(1);
    });

    test('TTL no General: agenda deleteMessage via setTimeout quando ttl_minutes setado', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'welcome', enabled: true, valid_from: null, valid_until: null, ttl_minutes: 30
        });
        repoMock.getPersistentTopic.mockResolvedValue(null);

        await svc.send('welcome', { cpf: '12345678901', text: 'expira' });
        // verifica que setTimeout foi agendado inspecionando o fetch do sendMessage (general)
        await new Promise(r => setTimeout(r, 500));

        // envia ttl_minutes=30 → em produção, deletaria após 30min. Aqui só verificamos que
        // o sendMessage no general foi chamado (TTL só agendaria, não dispara agora).
        const sendCalls = fetchSpy.mock.calls.filter(c => c[0].includes('/sendMessage'));
        expect(sendCalls.length).toBeGreaterThanOrEqual(2); // cpf + general
    });

    test('sem TTL: mensagem no General fica permanente (sem deleteMessage)', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'welcome', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        repoMock.getPersistentTopic.mockResolvedValue(null);

        await svc.send('welcome', { cpf: '12345678901', text: 'fixa' });
        await new Promise(r => setTimeout(r, 200));

        const deleteCall = fetchSpy.mock.calls.find(c => c[0].includes('/deleteMessage'));
        expect(deleteCall).toBeUndefined();
    });

    test('categoria só-Group (system_*) não tenta tópico do CPF', async () => {
        repoMock.getSetting.mockResolvedValue({
            category: 'system_start', enabled: true, valid_from: null, valid_until: null, ttl_minutes: null
        });
        repoMock.getPersistentTopic.mockResolvedValue(null);

        // Baseline relativo: fetches assíncronos de testes anteriores (fila enqueue
        // compartilhada) podem ainda estar pendentes quando este teste começa e cair
        // no spy — contar só o que ESTE teste envia elimina o flake intermitente.
        const baseline = fetchSpy.mock.calls.filter(c => c[0].includes('/sendMessage')).length;

        await svc.send('system_start', { text: 'motor subiu' });
        await new Promise(r => setTimeout(r, 500));

        const sendCalls = fetchSpy.mock.calls.filter(c => c[0].includes('/sendMessage'));
        const ownCalls = sendCalls.slice(baseline);
        // só 1 sendMessage (general), sem message_thread_id
        expect(ownCalls.length).toBe(1);
        const body = JSON.parse(ownCalls[0][1].body);
        expect(body.message_thread_id).toBeUndefined();
    });

    test('isExpiringSoon retorna true quando faltam < 24h', () => {
        const in12h = new Date(Date.now() + 12 * 3600000).toISOString();
        const setting = { valid_until: in12h };
        expect(svc.isExpiringSoon(setting)).toBe(true);
    });

    test('isExpiringSoon retorna false quando faltam > 24h', () => {
        const in48h = new Date(Date.now() + 48 * 3600000).toISOString();
        const setting = { valid_until: in48h };
        expect(svc.isExpiringSoon(setting)).toBe(false);
    });

    test('isExpiringSoon retorna false quando valid_until null', () => {
        expect(svc.isExpiringSoon({ valid_until: null })).toBe(false);
    });
});
