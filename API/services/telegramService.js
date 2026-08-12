// Telegram alerts — tópico por CPF no fórum do grupo (bot já validado em scripts/testTelegram.js)
// Chamado por: index.cjs (hooks compras/PIX/cron), repositories/notificationsRepo.js,
// repositories/usersRepo.js (deposit), src/controllers/invoiceController.js
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ENABLED = Boolean(TOKEN && CHAT_ID);
const PAGAMENTOS_TOPIC_NAME = '💰 Pagamentos';

let db = null; // injetado no boot (databricksService)
const topicCache = new Map(); // cpf -> topic_id

// Cache de settings por categoria (60s TTL). Invalida on-PATCH via invalidateSettingCache().
const settingsCache = new Map(); // category -> { setting, cachedAt }
const SETTINGS_TTL_MS = 60 * 1000;

// Mapeamento categoria -> destinos.
// 'cpf' = tópico do CPF; 'pagamentos' = tópico persistente "💰 Pagamentos"; 'general' = General do grupo.
// Categorias só-Group (system_*) omitem 'cpf' e 'pagamentos'.
const CATEGORY_DESTINATIONS = {
    purchase: ['cpf', 'pagamentos', 'general'],
    payment: ['cpf', 'pagamentos', 'general'],
    invoice_close: ['cpf', 'general'],
    invoice_pdf: ['cpf', 'general'],
    payment_receipt: ['cpf', 'general'],
    boleto_request: ['cpf', 'general'],
    qrcode_request: ['cpf', 'general'],
    welcome: ['cpf', 'general'],
    system_start: ['general'],
    system_done: ['general'],
    system_error: ['general'],
    deposit: ['cpf', 'general'],
    notification: ['cpf', 'general'],
    daily_anomaly: ['general']
};

// Fila serial: evita rate limit do Telegram (~30 msg/s) e mantém ordem.
// Em test (NODE_ENV=test), sem delay pra não travar suite.
let queue = Promise.resolve();
function enqueue(fn) {
    const gap = process.env.NODE_ENV === 'test' ? 0 : 60;
    queue = queue.then(fn).then(() => gap > 0 ? new Promise(r => setTimeout(r, gap)) : null).catch(err => {
        console.error('[telegram]', err.message);
    });
    return queue;
}

async function tg(method, body) {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) throw new Error(`${method}: ${json.description}`);
    return json.result;
}

function init(databricksService) {
    db = databricksService;
}

function formatCpf(cpf) {
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

// Um CPF = UM tópico, para sempre. O tópico só é recriado quando o Telegram
// responde 'message thread not found' no envio (tratado em sendMessage/sendDocument),
// nunca por checagem preventiva.
//
// NÃO reintroduzir validação de liveness aqui: a Bot API não expõe endpoint para
// consultar um tópico (o antigo ensureTopicAlive chamava `getForumTopic`, que
// responde 404 para QUALQUER thread — inclusive as vivas). O resultado era purgar
// o registro a cada envio e criar um tópico novo por mensagem, poluindo o grupo.
async function getOrCreateTopic(cpf, nome) {
    if (topicCache.has(cpf)) return topicCache.get(cpf);

    const rows = await db.executeQuery(`SELECT topic_id FROM ${db.fq('telegram_user_topics')} WHERE cpf = '${cpf}'`);
    if (rows.length > 0) {
        topicCache.set(cpf, rows[0].topic_id);
        return rows[0].topic_id;
    }
    const title = nome ? `${formatCpf(cpf)} — ${nome}` : formatCpf(cpf);
    const topic = await tg('createForumTopic', { chat_id: CHAT_ID, name: title.slice(0, 128) });
    const topicId = topic.message_thread_id;
    await db.executeQuery(`
        INSERT INTO ${db.fq('telegram_user_topics')} (cpf, topic_id) VALUES ('${cpf}', ${topicId})
        ON CONFLICT (cpf) DO UPDATE SET topic_id = ${topicId}
    `);
    topicCache.set(cpf, topicId);
    return topicId;
}

// Alerta no tópico do CPF. Fire-and-forget: nunca lança, nunca bloqueia fluxo bancário.
// Aceita `category` opcional: se informada e toggle OFF, no-op silencioso.
async function alertUser(cpf, text, nome, category) {
    if (!ENABLED || !db) return;
    if (category && !(await isCategoryActive(category))) {
        console.debug(`[telegram:skip] category=${category} reason=disabled (alertUser cpf=${cpf})`);
        return;
    }
    enqueue(async () => {
        const topicId = await getOrCreateTopic(cpf, nome);
        // Sem parse_mode as tags <b>/<code>/<blockquote> chegam como texto cru.
        await tg('sendMessage', { chat_id: CHAT_ID, message_thread_id: topicId, text, parse_mode: 'HTML' });
    });
}

// Alerta no General (motor/job/cron). Fire-and-forget.
// Aceita `category` opcional: se informada e toggle OFF, no-op silencioso.
async function alertGroup(text, category) {
    if (!ENABLED) return;
    if (category && !(await isCategoryActive(category))) {
        console.debug(`[telegram:skip] category=${category} reason=disabled (alertGroup)`);
        return;
    }
    enqueue(() => tg('sendMessage', { chat_id: CHAT_ID, text, parse_mode: 'HTML' }));
}

// Cria o tópico no cadastro da massa (gerador admin ou signup web), com boas-vindas.
// Fire-and-forget: cadastro nunca falha por causa do Telegram.
// Respeita toggle da categoria 'welcome' (painel admin): se OFF, não manda a mensagem de boas-vindas
// mas continua criando/sincronizando o tópico (mass creator / signup dependem da row pra tópicos CPF).
function ensureTopic(cpf, nome) {
    if (!ENABLED || !db) return;
    enqueue(async () => {
        let before = [];
        try {
            before = await db.executeQuery(`SELECT topic_id FROM ${db.fq('telegram_user_topics')} WHERE cpf = '${cpf}'`);
        } catch (err) {
            try { await ensureTable(); } catch { /* sem DB, sem tópico */ return; }
            before = [];
        }
        let topicId;
        try {
            topicId = await getOrCreateTopic(cpf, nome);
        } catch (err) {
            console.warn('[telegram] ensureTopic:', err.message);
            return;
        }
        if (before.length > 0) return; // já existia: não repete boas-vindas
        // Gate pela categoria 'welcome' — se admin desligou, não manda a mensagem.
        // O tópico é mantido (CPF/gerador precisam da row) mas sem o texto de boas-vindas.
        if (!(await isCategoryActive('welcome'))) {
            console.debug(`[telegram:skip] category=welcome reason=disabled (ensureTopic cpf=${cpf})`);
            return;
        }
        try {
            await tg('sendMessage', {
                chat_id: CHAT_ID,
                message_thread_id: topicId,
                text: `👋 Conta criada\nCPF: ${formatCpf(cpf)}${nome ? `\nNome: ${nome}` : ''}\nAlertas desta conta chegam neste tópico.`
            });
        } catch (err) {
            console.warn('[telegram] sendMessage welcome:', err.message);
        }
    });
}

// Apaga o tópico junto com a massa. Idempotente: tópico já removido no Telegram não é erro.
async function deleteTopic(cpf) {
    if (!db) return { deleted: false };
    const rows = await db.executeQuery(`SELECT topic_id FROM ${db.fq('telegram_user_topics')} WHERE cpf = '${cpf}'`);
    topicCache.delete(cpf);
    if (rows.length === 0) return { deleted: false };
    if (ENABLED) {
        try {
            await tg('deleteForumTopic', { chat_id: CHAT_ID, message_thread_id: rows[0].topic_id });
        } catch (err) {
            console.warn('[telegram] deleteForumTopic:', err.message);
        }
    }
    await db.executeQuery(`DELETE FROM ${db.fq('telegram_user_topics')} WHERE cpf = '${cpf}'`);
    return { deleted: true };
}

// Cria a tabela sob demanda: a API pode ter subido antes da migração do boot.
async function ensureTable() {
    if (!db) return;
    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${db.fq('telegram_user_topics')} (
            cpf VARCHAR(11) PRIMARY KEY,
            topic_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function listTopics() {
    if (!db) return [];
    try {
        return await db.executeQuery(`
            SELECT t.cpf, t.topic_id, t.created_at, u.full_name
            FROM ${db.fq('telegram_user_topics')} t
            LEFT JOIN ${db.fq('users')} u ON u.cpf = t.cpf
            ORDER BY t.created_at DESC
        `);
    } catch (err) {
        // Tabela ausente não pode derrubar o painel: cria e devolve vazio.
        console.warn('[telegram] listTopics:', err.message);
        try { await ensureTable(); } catch { /* segue vazio */ }
        return [];
    }
}

async function getStatus() {
    const topics = await listTopics();
    return { enabled: ENABLED, chatId: CHAT_ID || null, botConfigured: Boolean(TOKEN), topicCount: topics.length };
}

async function sendTable(cpf, title, headers, rows, category) {
    if (!ENABLED || !db) return;
    if (category && !(await isCategoryActive(category))) {
        console.debug(`[telegram:skip] category=${category} reason=disabled (sendTable cpf=${cpf})`);
        return;
    }
    enqueue(async () => {
        const topicId = await getOrCreateTopic(cpf);

        // Calcular largura máxima de cada coluna para alinhar
        const colWidths = headers.map((h, i) => {
            let max = h.length;
            for (const r of rows) {
                if (r[i] && r[i].length > max) max = r[i].length;
            }
            return max;
        });

        // Montar cabeçalho
        let text = `📋 <b>${title}</b>\n\n<pre>`;
        text += headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + '\n';
        text += colWidths.map(w => '-'.repeat(w)).join('-+-') + '\n';

        // Montar linhas
        for (const r of rows) {
            text += r.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join(' | ') + '\n';
        }
        text += '</pre>';

        await tg('sendMessage', {
            chat_id: CHAT_ID,
            message_thread_id: topicId,
            text,
            parse_mode: 'HTML'
        });
    });
}

async function sendDocument(cpf, buffer, filename, category) {
    if (!ENABLED || !db) return { sent: false, reason: 'service_disabled' };
    if (category && !(await isCategoryActive(category))) {
        console.debug(`[telegram:skip] category=${category} reason=disabled (sendDocument cpf=${cpf})`);
        return { sent: false, reason: 'disabled' };
    }
    const res = { sent: false };
    enqueue(async () => {
        let topicId;
        try {
            topicId = await getOrCreateTopic(cpf);
        } catch (e) {
            console.warn('[telegram] sendDocument getOrCreateTopic:', e.message);
            res.error = e.message;
            return;
        }

        const formData = new FormData();
        formData.append('chat_id', CHAT_ID);
        formData.append('message_thread_id', String(topicId));

        const blob = new Blob([buffer], { type: 'application/pdf' });
        formData.append('document', blob, filename);

        try {
            const fetchRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, {
                method: 'POST',
                body: formData
            });
            const json = await fetchRes.json();
            if (!json.ok) {
                // Tópico órfão (existe no banco mas foi apagado no Telegram) — purga e reenvia 1x.
                if (json.description && /message thread not found/i.test(json.description)) {
                    console.warn(`[telegram] sendDocument: tópico #${topicId} órfão — recriando para ${cpf}`);
                    topicCache.delete(cpf);
                    await db.executeQuery(`DELETE FROM ${db.fq('telegram_user_topics')} WHERE cpf = '${cpf}'`).catch(() => {});
                    try {
                        const newId = await getOrCreateTopic(cpf);
                        const fd2 = new FormData();
                        fd2.append('chat_id', CHAT_ID);
                        fd2.append('message_thread_id', String(newId));
                        fd2.append('document', new Blob([buffer], { type: 'application/pdf' }), filename);
                        const r2 = await fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, { method: 'POST', body: fd2 });
                        const j2 = await r2.json();
                        if (!j2.ok) throw new Error(`sendDocument retry: ${j2.description}`);
                        res.sent = true;
                    } catch (retryErr) {
                        console.warn('[telegram] sendDocument retry:', retryErr.message);
                        res.error = retryErr.message;
                    }
                    return;
                }
                throw new Error(`sendDocument: ${json.description}`);
            }
            res.sent = true;
        } catch (err) {
            console.warn('[telegram] sendDocument:', err.message);
            res.error = err.message;
        }
    });
    return res;
}

// ===== WRAPPER send(category, payload) — toggle-gated multi-destination =====

let settingsRepoModule = null;
function getSettingsRepo() {
    if (!settingsRepoModule) {
        // require lazy: evita ciclo quando admin controller carrega este service
        settingsRepoModule = require('../repositories/telegramSettingsRepo');
    }
    return settingsRepoModule;
}

async function getCachedSetting(category) {
    const now = Date.now();
    const cached = settingsCache.get(category);
    if (cached && now - cached.cachedAt < SETTINGS_TTL_MS) {
        return cached.setting;
    }
    const repo = getSettingsRepo();
    const setting = await repo.getSetting(category);
    settingsCache.set(category, { setting, cachedAt: now });
    return setting;
}

function invalidateSettingCache(category) {
    if (category) settingsCache.delete(category);
    else settingsCache.clear();
}

function isExpiringSoon(setting) {
    if (!setting || !setting.valid_until) return false;
    const ms = new Date(setting.valid_until).getTime() - Date.now();
    return ms > 0 && ms < 24 * 3600 * 1000;
}

function isWithinValidity(setting) {
    const now = Date.now();
    if (setting.valid_from && new Date(setting.valid_from).getTime() > now) return 'not_yet_valid';
    if (setting.valid_until && new Date(setting.valid_until).getTime() < now) return 'expired';
    return 'ok';
}

async function send(category, payload) {
    if (!ENABLED || !db) return { sent: false, reason: 'service_disabled' };
    if (!category || !CATEGORY_DESTINATIONS[category]) {
        return { sent: false, reason: 'unknown_category' };
    }

    const setting = await getCachedSetting(category);
    if (!setting) {
        console.debug(`[telegram:skip] category=${category} reason=not_found`);
        return { sent: false, reason: 'not_found' };
    }
    if (!setting.enabled) {
        console.debug(`[telegram:skip] category=${category} reason=disabled`);
        return { sent: false, reason: 'disabled' };
    }

    const validity = isWithinValidity(setting);
    if (validity !== 'ok') {
        console.debug(`[telegram:skip] category=${category} reason=${validity}`);
        return { sent: false, reason: validity };
    }

    if (isExpiringSoon(setting)) {
        const hoursLeft = Math.round((new Date(setting.valid_until).getTime() - Date.now()) / 3600000);
        console.warn(`[telegram:expiring] category=${category} hours_left=${hoursLeft}`);
    }

    const destinations = CATEGORY_DESTINATIONS[category];
    const ttlMinutes = setting.ttl_minutes;
    const results = [];
    const hasDestinations = destinations.length > 0;
    const res = { sent: hasDestinations, destinations: results };

    if (destinations.includes('cpf') && payload && payload.cpf) {
        enqueue(async () => {
            try {
                let topicId = await getOrCreateTopic(payload.cpf, payload.nome);
                let msgRes;
                try {
                    msgRes = await tg('sendMessage', {
                        chat_id: CHAT_ID,
                        message_thread_id: topicId,
                        text: payload.text || ''
                    });
                } catch (sendErr) {
                    // Tópico órfão: purga e reenvia 1x.
                    if (/message thread not found/i.test(sendErr.message || '')) {
                        console.warn(`[telegram] send cpf ${category}: tópico #${topicId} órfão — recriando`);
                        topicCache.delete(payload.cpf);
                        await db.executeQuery(`DELETE FROM ${db.fq('telegram_user_topics')} WHERE cpf = '${payload.cpf}'`).catch(() => {});
                        topicId = await getOrCreateTopic(payload.cpf, payload.nome);
                        msgRes = await tg('sendMessage', {
                            chat_id: CHAT_ID,
                            message_thread_id: topicId,
                            text: payload.text || ''
                        });
                    } else {
                        throw sendErr;
                    }
                }
                results.push({ dest: 'cpf', ok: true, message_id: msgRes.message_id, topic_id: topicId });
            } catch (err) {
                console.warn(`[telegram] send cpf ${category}:`, err.message);
                results.push({ dest: 'cpf', ok: false, error: err.message });
                res.sent = false;
            }
        });
    }

    if (destinations.includes('pagamentos')) {
        enqueue(async () => {
            try {
                const repo = getSettingsRepo();
                let topicRow = await repo.getPersistentTopic(PAGAMENTOS_TOPIC_NAME);
                let topicId = topicRow ? topicRow.topic_id : null;
                if (!topicId) {
                    const created = await tg('createForumTopic', { chat_id: CHAT_ID, name: PAGAMENTOS_TOPIC_NAME.slice(0, 128) });
                    topicId = created.message_thread_id;
                    await repo.setPersistentTopic(PAGAMENTOS_TOPIC_NAME, topicId);
                }
                const msgRes = await tg('sendMessage', {
                    chat_id: CHAT_ID,
                    message_thread_id: topicId,
                    text: payload && payload.text ? payload.text : ''
                });
                results.push({ dest: 'pagamentos', ok: true, message_id: msgRes.message_id, topic_id: topicId });
            } catch (err) {
                console.warn(`[telegram] send pagamentos ${category}:`, err.message);
                results.push({ dest: 'pagamentos', ok: false, error: err.message });
                res.sent = false;
            }
        });
    }

    if (destinations.includes('general')) {
        const ttlMinutes = setting.ttl_minutes;
        enqueue(async () => {
            try {
                const msgRes = await tg('sendMessage', {
                    chat_id: CHAT_ID,
                    text: payload && payload.text ? payload.text : ''
                });
                const generalMsgId = msgRes.message_id;
                results.push({ dest: 'general', ok: true, message_id: generalMsgId });

                if (ttlMinutes && ttlMinutes > 0) {
                    const timer = setTimeout(() => {
                        enqueue(() => tg('deleteMessage', { chat_id: CHAT_ID, message_id: generalMsgId }))
                            .catch(err => console.warn(`[telegram] deleteMessage ttl:`, err.message));
                    }, ttlMinutes * 60 * 1000);
                    if (timer.unref) timer.unref(); // não segura o processo vivo só pelo TTL
                }
            } catch (err) {
                console.warn(`[telegram] send general ${category}:`, err.message);
                results.push({ dest: 'general', ok: false, error: err.message });
                res.sent = false;
            }
        });
    }

    return res;
}

// Helper síncrono para controllers que só precisam saber se devem prosseguir.
// Retorna false se service desabilitado, categoria desconhecida, disabled ou fora de validade.
async function isCategoryActive(category) {
    if (!ENABLED || !db) return false;
    if (!CATEGORY_DESTINATIONS[category]) return false;
    const setting = await getCachedSetting(category);
    if (!setting || !setting.enabled) return false;
    return isWithinValidity(setting) === 'ok';
}

module.exports = {
    init, alertUser, alertGroup, ensureTopic, deleteTopic, listTopics, getStatus,
    formatCpf, sendTable, sendDocument, send, isExpiringSoon, invalidateSettingCache,
    isCategoryActive, _enabled: ENABLED, _resetQueue: () => { queue = Promise.resolve(); }
};
