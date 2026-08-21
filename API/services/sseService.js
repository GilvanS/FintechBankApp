/**
 * SSE (Server-Sent Events) Service
 * 
 * Gerencia conexões de clientes e transmite eventos em tempo real.
 * Cada cliente se conecta via GET /api/events/stream e recebe eventos
 * como pushes do servidor.
 * 
 * Eventos suportados:
 *   - purchase.completed  → Nova compra realizada
 *   - payment.completed   → Pagamento de fatura processado
 *   - invoice.updated     → Fatura atualizada (fechamento, encargos)
 *   - user.updated        → Dados do usuário alterados (limite, saldo)
 */

// Mapa de conexões ativas: cpf → Set<response>
const clients = new Map();

// Conexões abertas por sessões administrativas. O monitor de eventos acompanha a
// atividade de todas as massas, mas um cliente comum só pode receber o que é dele —
// por isso o recorte por papel fica separado do mapa por CPF.
const adminClients = new Set();

/**
 * Registra uma nova conexão SSE para um CPF.
 * @param {string} cpf - CPF do usuário conectado
 * @param {object} res - Response do Express (stream aberto)
 * @param {string} [role] - Papel do usuário; 'admin' habilita receber broadcast administrativo
 */
function addClient(cpf, res, role) {
    if (!clients.has(cpf)) {
        clients.set(cpf, new Set());
    }
    clients.get(cpf).add(res);
    if (role === 'admin') adminClients.add(res);
    console.log(`[SSE] Cliente conectado: ${cpf} (total: ${clients.get(cpf).size})`);
}

/**
 * Remove uma conexão SSE (chamar no 'close' do response).
 * @param {string} cpf
 * @param {object} res
 */
function removeClient(cpf, res) {
    const set = clients.get(cpf);
    if (set) {
        set.delete(res);
        if (set.size === 0) clients.delete(cpf);
    }
    adminClients.delete(res);
    console.log(`[SSE] Cliente desconectado: ${cpf} (restantes: ${clients.get(cpf)?.size || 0})`);
}

/**
 * Envia um evento SSE para um CPF específico.
 * @param {string} cpf - CPF do destinatário
 * @param {string} event - Nome do evento (ex: 'purchase.completed')
 * @param {object} data - Dados do evento (será JSON-ificado)
 */
function sendToClient(cpf, event, data) {
    const set = clients.get(cpf);
    if (!set || set.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) {
        try {
            res.write(payload);
        } catch (err) {
            // Conexão fechada — remover silenciosamente
            removeClient(cpf, res);
        }
    }
}

/**
 * Envia um evento para TODOS os clientes conectados (broadcast).
 * Útil para eventos administrativos ou de sistema.
 * @param {string} event
 * @param {object} data
 */
function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [cpf, set] of clients) {
        for (const res of set) {
            try {
                res.write(payload);
            } catch (err) {
                removeClient(cpf, res);
            }
        }
    }
}

/**
 * Envia um evento apenas para as sessões administrativas conectadas.
 * É o canal do monitor de eventos: o admin acompanha a atividade de todas as massas
 * sem que o evento de um cliente chegue à sessão de outro.
 * @param {string} event
 * @param {object} data
 */
function broadcastToAdmins(event, data) {
    if (adminClients.size === 0) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of adminClients) {
        try {
            res.write(payload);
        } catch (err) {
            adminClients.delete(res);
        }
    }
}

/**
 * Retorna o número total de conexões ativas.
 */
function getClientCount() {
    let total = 0;
    for (const set of clients.values()) total += set.size;
    return total;
}

/**
 * Retorna o número de conexões administrativas ativas.
 */
function getAdminClientCount() {
    return adminClients.size;
}

module.exports = {
    addClient,
    removeClient,
    sendToClient,
    broadcast,
    broadcastToAdmins,
    getClientCount,
    getAdminClientCount,
};
