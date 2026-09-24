/**
 * auditAlerts.js — alertas da auditoria diária no Telegram, por CRITÉRIO.
 *
 * Antes cada anomalia virava 1 mensagem no General, a cada rodada do cron (2h):
 * ~100 anomalias = ~100 mensagens. Agora:
 *   - cada tipo de anomalia cai num critério (Pagamentos, PIX, Compras,
 *     Faturas/Encargos, Limite), cada um com seu tópico persistente;
 *   - 1 mensagem consolidada por critério (quebrada no limite do Telegram);
 *   - o General recebe só 1 resumo com a contagem por critério e por tipo.
 */

// Tópicos próprios da auditoria — separados do "💰 Pagamentos" (feed de transações).
const CRITERIOS = {
    pagamentos: { topico: '🔎 Auditoria · Pagamentos', rotulo: '💰 Pagamentos' },
    pix: { topico: '🔎 Auditoria · PIX', rotulo: '⚡ PIX' },
    compras: { topico: '🔎 Auditoria · Compras', rotulo: '🛒 Compras' },
    faturas: { topico: '🔎 Auditoria · Faturas e Encargos', rotulo: '🧾 Faturas/Encargos' },
    limite: { topico: '🔎 Auditoria · Limite', rotulo: '📉 Limite' },
};

// Tipos conhecidos do services/dailyAudit.js. Tipo novo sem entrada aqui cai no
// fallback por palavra-chave (criterioDaAnomalia).
const CRITERIO_POR_TIPO = {
    PAGAMENTO_PARCIAL_SEM_ENCARGOS: 'pagamentos',
    PAGAMENTO_SEM_COMPROVANTE: 'pagamentos',
    PAGAMENTO_EXCEDENTE_FATURA_FECHADA: 'pagamentos',
    SALDO_CREDOR_ESTACIONADO: 'pagamentos',
    TRANSACAO_ORFA: 'compras',
    LIMITE_DIVERGENTE: 'limite',
    LIMITE_EXCEDIDO: 'limite',
    INADIMPLENTE_SEM_ENCARGOS: 'faturas',
    FATURA_DUPLICADA: 'faturas',
    FATURA_VENCIMENTO_DIVERGENTE_CORRIGIDO: 'faturas',
    ENCARGOS_ORFAOS_REGERADOS: 'faturas',
    FATURA_ABERTA_MES_DIVERGENTE_CORRIGIDO: 'faturas',
    BLACKLIST_DESSINCRONIZADA: 'faturas',
    // Anomalia 8d. SALDO_* cairia em 'pagamentos' pelo fallback: explícito aqui. O nome
    // antigo (só "herdou a mais") segue mapeado para relatórios/reenvios já gravados.
    SALDO_ANTERIOR_DIVERGENTE: 'faturas',
    SALDO_ANTERIOR_JA_QUITADO: 'faturas',
    ENCARGO_APOS_QUITACAO_TOTAL: 'faturas',
    RESIDUAL_PARCIAL_SEM_ENCARGO: 'faturas',
};

const LIMITE_MSG = 3800;        // Telegram corta em 4096 — folga para o cabeçalho
const MAX_MSGS_POR_CRITERIO = 3; // o resto vira "… e mais N" (lista completa no painel)
const MAX_DETALHE = 220;

function criterioDaAnomalia(tipo = '') {
    if (CRITERIO_POR_TIPO[tipo]) return CRITERIO_POR_TIPO[tipo];
    if (/PIX/.test(tipo)) return 'pix';
    if (/PAGAMENTO|SALDO/.test(tipo)) return 'pagamentos';
    if (/LIMITE/.test(tipo)) return 'limite';
    if (/COMPRA|TRANSACAO|PARCELA/.test(tipo)) return 'compras';
    return 'faturas';
}

const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtCpf = (cpf) => String(cpf || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

function agrupar(anomalias) {
    const grupos = {};
    for (const a of anomalias) (grupos[criterioDaAnomalia(a.type)] ||= []).push(a);
    return grupos;
}

/**
 * Tipos de MENOR volume primeiro (ordem estável dentro de cada tipo). O corte em
 * MAX_MSGS_POR_CRITERIO cai sobre o fim da lista: sem isto, um tipo de alto volume
 * (ex.: SALDO_ANTERIOR_DIVERGENTE) ocupava as 3 mensagens de 'faturas' e escondia os
 * raros (RESIDUAL_PARCIAL_SEM_ENCARGO, BLACKLIST_DESSINCRONIZADA…).
 */
function priorizarPorVolume(anomalias) {
    const porTipo = new Map();
    for (const a of anomalias) (porTipo.get(a.type) || porTipo.set(a.type, []).get(a.type)).push(a);
    return [...porTipo.values()].sort((x, y) => x.length - y.length).flat();
}

/** Mensagens (HTML) de UM critério: uma linha por anomalia, em blocos ≤ LIMITE_MSG. */
function mensagensDoCriterio(criterio, anomaliasRecebidas) {
    const { rotulo } = CRITERIOS[criterio];
    const anomalias = priorizarPorVolume(anomaliasRecebidas);
    const linhas = anomalias.map((a) => {
        const det = String(a.details || '');
        const detCurto = det.length > MAX_DETALHE ? `${det.slice(0, MAX_DETALHE)}…` : det;
        return `• <b>${escHtml(a.type)}</b> — ${escHtml(a.name || 'sem nome')} (<code>${fmtCpf(a.cpf)}</code>)\n  ${escHtml(detCurto)}`;
    });

    const msgs = [];
    let atual = [];
    let tamanho = 0;
    let usadas = 0;
    for (const linha of linhas) {
        if (tamanho + linha.length > LIMITE_MSG && atual.length > 0) {
            msgs.push(atual);
            atual = [];
            tamanho = 0;
            if (msgs.length === MAX_MSGS_POR_CRITERIO) break;
        }
        atual.push(linha);
        tamanho += linha.length + 2;
        usadas++;
    }
    if (atual.length > 0 && msgs.length < MAX_MSGS_POR_CRITERIO) msgs.push(atual);
    else usadas -= atual.length;

    const total = anomalias.length;
    // O que ficou de fora, por tipo (sempre os de maior volume — ver priorizarPorVolume).
    const cortadas = {};
    for (const a of anomalias.slice(usadas)) cortadas[a.type] = (cortadas[a.type] || 0) + 1;
    const porTipoCortado = Object.entries(cortadas).map(([t, n]) => `${escHtml(t)}: ${n}`).join(', ');
    return msgs.map((bloco, i) => {
        const parte = msgs.length > 1 ? ` (${i + 1}/${msgs.length})` : '';
        const resto = i === msgs.length - 1 && usadas < total
            ? `\n\n… e mais ${total - usadas} (${porTipoCortado}) — lista completa no painel Admin › Auditoria.`
            : '';
        return `🔎 <b>Auditoria — ${rotulo}: ${total} anomalia(s)</b>${parte}\n\n${bloco.join('\n\n')}${resto}`;
    });
}

/** Resumo único do General: contagem por critério e por tipo. */
function resumoGeral(anomalias) {
    const grupos = agrupar(anomalias);
    const porCriterio = Object.keys(CRITERIOS)
        .filter((c) => grupos[c])
        .map((c) => `${CRITERIOS[c].rotulo}: <b>${grupos[c].length}</b>`);
    const porTipo = {};
    for (const a of anomalias) porTipo[a.type] = (porTipo[a.type] || 0) + 1;
    const tipos = Object.entries(porTipo)
        .sort((x, y) => y[1] - x[1])
        .map(([t, n]) => `• ${escHtml(t)}: ${n}`);
    return `🔎 <b>Auditoria de anomalias — ${anomalias.length} encontrada(s)</b>\n\n${porCriterio.join('\n')}\n\n${tipos.join('\n')}\n\nDetalhes nos tópicos "🔎 Auditoria · …".`;
}

/**
 * Envia os alertas de uma rodada. Fire-and-forget (o telegramService enfileira e
 * nunca lança). Respeita o toggle 'daily_anomaly' do painel.
 */
function enviarAlertasAuditoria(telegramService, anomalias) {
    if (!anomalias || anomalias.length === 0) return;
    const grupos = agrupar(anomalias);
    for (const [criterio, lista] of Object.entries(grupos)) {
        for (const texto of mensagensDoCriterio(criterio, lista)) {
            telegramService.alertTopic(CRITERIOS[criterio].topico, texto, 'daily_anomaly');
        }
    }
    telegramService.alertGroup(resumoGeral(anomalias), 'daily_anomaly');
}

module.exports = { CRITERIOS, criterioDaAnomalia, mensagensDoCriterio, resumoGeral, enviarAlertasAuditoria };
