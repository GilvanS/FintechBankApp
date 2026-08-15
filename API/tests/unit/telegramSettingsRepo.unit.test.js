// Testes do telegramSettingsRepo: cobertura das 6 funções via mock do DB service.
// Padrão: mock de executeQuery + fq() injetado via setDb() em repositories/context.

describe('telegramSettingsRepo', () => {
    let context;
    let repo;

    // Mock service que simula executeQuery com base no SQL recebido.
    // Casos cobertos: SELECT listSettings, SELECT por category (hit + miss),
    // INSERT/UPSERT, persistent topics.
    function makeMockDb(extraRows = []) {
        const rows = {
            telegram_settings: [
                { category: 'purchase', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'payment', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'invoice_close', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'invoice_pdf', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'payment_receipt', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'boleto_request', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'qrcode_request', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'welcome', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'system_start', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'system_done', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'system_error', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'deposit', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'notification', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                { category: 'daily_anomaly', enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null },
                ...extraRows
            ],
            telegram_persistent_topics: []
        };
        return {
            fq: (name) => `fintech.${name}`,
            executeQuery: jest.fn(async (sql) => {
                if (/FROM fintech\.telegram_settings\s+WHERE category=/.test(sql)) {
                    const m = sql.match(/category='([^']+)'/);
                    const cat = m ? m[1] : null;
                    return rows.telegram_settings.filter(r => r.category === cat);
                }
                if (/FROM fintech\.telegram_persistent_topics\s+WHERE name=/.test(sql)) {
                    const m = sql.match(/name='([^']+)'/);
                    const name = m ? m[1] : null;
                    return rows.telegram_persistent_topics.filter(r => r.name === name);
                }
                if (/FROM fintech\.telegram_settings/.test(sql)) {
                    return rows.telegram_settings;
                }
                if (/FROM fintech\.telegram_persistent_topics/.test(sql)) {
                    return rows.telegram_persistent_topics;
                }
                if (/INSERT INTO fintech\.telegram_settings/i.test(sql)) {
                    const m = sql.match(/category='([^']+)'/);
                    const cat = m ? m[1] : null;
                    const existing = rows.telegram_settings.find(r => r.category === cat);
                    if (!existing) {
                        rows.telegram_settings.push({ category: cat, enabled: false, valid_from: null, valid_until: null, ttl_minutes: null, updated_at: '2026-08-01 10:00:00', updated_by: null });
                    }
                    return [];
                }
                if (/UPDATE fintech\.telegram_settings/i.test(sql)) {
                    const m = sql.match(/category='([^']+)'/);
                    const cat = m ? m[1] : null;
                    const setMatches = [...sql.matchAll(/(\w+)\s*=\s*('([^']*)'|true|false|NULL|\d+)/g)];
                    const target = rows.telegram_settings.find(r => r.category === cat);
                    if (target) {
                        for (const sm of setMatches) {
                            const col = sm[1];
                            const val = sm[2];
                            if (col === 'category' || col === 'updated_at') continue;
                            if (val === 'true') target[col] = true;
                            else if (val === 'false') target[col] = false;
                            else if (val === 'NULL') target[col] = null;
                            else if (/^\d+$/.test(val)) target[col] = parseInt(val, 10);
                            else target[col] = sm[3] != null ? sm[3] : val.replace(/^'|'$/g, '');
                        }
                        target.updated_at = '2026-08-02 12:00:00';
                    }
                    return [];
                }
                if (/INSERT INTO fintech\.telegram_persistent_topics/i.test(sql)) {
                    const valM = sql.match(/VALUES\s*\(\s*'([^']+)'\s*,\s*(\d+)\s*\)/);
                    const name = valM ? valM[1] : null;
                    const topicId = valM ? parseInt(valM[2], 10) : null;
                    const existing = rows.telegram_persistent_topics.find(r => r.name === name);
                    if (existing) existing.topic_id = topicId;
                    else rows.telegram_persistent_topics.push({ name, topic_id: topicId, created_at: '2026-08-02 12:00:00' });
                    return [];
                }
                return [];
            })
        };
    }

    beforeEach(() => {
        jest.resetModules();
        context = require('../../repositories/context');
        const mockDb = makeMockDb();
        context.setDb(mockDb);
        repo = require('../../repositories/telegramSettingsRepo');
    });

    test('listSettings retorna 14 categorias default OFF', async () => {
        const list = await repo.listSettings();
        expect(list).toHaveLength(14);
        expect(list.every(r => r.enabled === false)).toBe(true);
        expect(list.find(r => r.category === 'purchase')).toBeDefined();
    });

    test('getSetting retorna row quando categoria existe', async () => {
        const row = await repo.getSetting('purchase');
        expect(row).not.toBeNull();
        expect(row.category).toBe('purchase');
        expect(row.enabled).toBe(false);
    });

    test('getSetting retorna null quando categoria não existe', async () => {
        const row = await repo.getSetting('inexistente');
        expect(row).toBeNull();
    });

    test('upsertSetting persiste mudança de enabled e atualiza updated_by', async () => {
        await repo.upsertSetting('purchase', { enabled: true }, 'admin-cpf');
        const row = await repo.getSetting('purchase');
        expect(row.enabled).toBe(true);
        expect(row.updated_by).toBe('admin-cpf');
    });

    test('upsertSetting atualiza ttl_minutes e valid_until', async () => {
        await repo.upsertSetting('payment', { ttl_minutes: 30, valid_until: '2026-12-31 23:59:59' }, 'admin-cpf');
        const row = await repo.getSetting('payment');
        expect(row.ttl_minutes).toBe(30);
        expect(row.valid_until).toBe('2026-12-31 23:59:59');
    });

    test('setPersistentTopic faz upsert e getPersistentTopic retorna', async () => {
        await repo.setPersistentTopic('pagamentos', 999);
        const topic = await repo.getPersistentTopic('pagamentos');
        expect(topic).not.toBeNull();
        expect(topic.topic_id).toBe(999);
    });

    test('getPersistentTopic retorna null quando não existe', async () => {
        const topic = await repo.getPersistentTopic('nao-existe');
        expect(topic).toBeNull();
    });

    test('listPersistentTopics retorna vazio quando nenhum tópico criado', async () => {
        const topics = await repo.listPersistentTopics();
        expect(topics).toEqual([]);
    });

    test('listPersistentTopics retorna tópicos após setPersistentTopic', async () => {
        await repo.setPersistentTopic('pagamentos', 111);
        await repo.setPersistentTopic('outros', 222);
        const topics = await repo.listPersistentTopics();
        expect(topics).toHaveLength(2);
        expect(topics.map(t => t.name)).toEqual(expect.arrayContaining(['pagamentos', 'outros']));
    });

    test('esc protege contra SQL injection em getSetting', async () => {
        const row = await repo.getSetting("'; DROP TABLE users; --");
        expect(row).toBeNull();
    });
});