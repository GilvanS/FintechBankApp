/**
 * Ponte entre o barramento de eventos e as conexões SSE.
 *
 * O eventBus resolve a propagação entre processos (Kafka → Redis → memória) e o
 * sseService resolve a entrega ao navegador, mas nada ligava um ao outro: o stream
 * abria e ficava mudo. Este relay assina os tópicos de negócio e os repassa.
 *
 * Entrega:
 *   - o dono do evento (payload.cpf) recebe sempre;
 *   - sessões administrativas recebem tudo, para alimentar o monitor de eventos;
 *   - nenhum evento chega à sessão de outro cliente.
 */
const eventBus = require('./eventBus');
const sseService = require('./sseService');

// 'owner' → dono do CPF + admins. 'admin' → apenas sessões administrativas.
const TOPICS = {
    'purchase.completed': 'owner',
    'purchase.declined': 'owner',
    'payment.completed': 'owner',
    'invoice.updated': 'owner',
    'user.updated': 'owner',
    'mass.created': 'admin',
};

let started = false;

// Quantos eventos de cada tópico o relay já repassou. Permite distinguir
// "ninguém publicou" de "publicou mas não chegou ao navegador".
const counters = {};

/**
 * Assina os tópicos e começa a repassar para o SSE. Idempotente: chamar duas vezes
 * não duplica as inscrições (o que faria cada evento chegar repetido ao cliente).
 */
async function start() {
    if (started) return { started: false, reason: 'already-started' };
    started = true;

    for (const [topic, scope] of Object.entries(TOPICS)) {
        await eventBus.subscribe(topic, (payload) => {
            try {
                counters[topic] = (counters[topic] || 0) + 1;
                const data = {
                    ...(payload && typeof payload === 'object' ? payload : { value: payload }),
                    type: topic,
                    timestamp: payload?.timestamp || new Date().toISOString(),
                };

                if (scope === 'owner' && data.cpf) {
                    sseService.sendToClient(data.cpf, topic, data);
                }

                // O monitor administrativo acompanha todos os tópicos.
                sseService.broadcastToAdmins(topic, data);
            } catch (err) {
                // Um evento malformado não pode derrubar o relay dos demais.
                console.warn(`[EventRelay] Falha ao repassar ${topic}:`, err.message);
            }
        });
    }

    console.log(`[EventRelay] Repassando ${Object.keys(TOPICS).length} tópicos para o SSE.`);
    return { started: true, topics: Object.keys(TOPICS) };
}

/**
 * Estado do relay, para diagnóstico: um stream mudo pode ser ausência de eventos
 * ou relay que nunca subiu — isso distingue os dois casos.
 */
function getStatus() {
    return { started, topics: Object.keys(TOPICS), relayed: { ...counters } };
}

module.exports = { start, getStatus, TOPICS };
