/**
 * utiAlerts.js — avisos no Telegram quando a UTI de Recuperação CURA massas.
 *
 *   - tópico da massa (CPF): "✅ Massa curada pela UTI" com o que foi feito;
 *   - tópico persistente "🏥 UTI de Recuperação": 1 resumo por execução
 *     (curadas, falhas, sem cura) — nunca 1 mensagem por massa no General.
 *
 * Categoria 'uti_cura' (liga/desliga no painel › Telegram). Só roda quando a cura
 * é APLICADA (nunca na simulação) e não trava a resposta do painel.
 */
const CATEGORIA = 'uti_cura';
const TOPICO_RESUMO = '🏥 UTI de Recuperação';
const LIMITE_MSG = 3800;

const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtCpf = (cpf) => String(cpf || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const agora = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// Massa que saiu da UTI nesta execução.
const saiuDaUti = (m) => m.status === 'curada' || m.status === 'ja_saudavel';

function mensagemDaMassa(m, aplicadoPor) {
    const linhas = m.status === 'ja_saudavel'
        ? ['• Conferida: nenhuma anomalia atual — liberada da UTI.']
        : m.anomalias.map((a) => `• <b>${escHtml(a.type)}</b> — ${escHtml(a.plano ? a.plano.acao : a.detail)}`);
    return [
        '✅ <b>Massa curada pela UTI de Recuperação</b>',
        '',
        ...linhas,
        '',
        `<b>Data:</b> ${agora()}`,
        aplicadoPor ? `<b>Aplicado por:</b> <code>${fmtCpf(aplicadoPor)}</code>` : null,
    ].filter((l) => l !== null).join('\n');
}

function mensagemResumo(relatorio, aplicadoPor) {
    const massas = relatorio.relatorio || [];
    const curadas = massas.filter(saiuDaUti);
    const falhas = massas.filter((m) => m.status === 'falhou');
    const semCura = massas.filter((m) => !saiuDaUti(m) && m.status !== 'falhou');
    const comprovantes = massas.reduce((n, m) => n + m.anomalias
        .filter((a) => a.type === 'PAGAMENTO_SEM_COMPROVANTE' && a.plano)
        .reduce((k, a) => k + ((a.plano.enviados || []).length), 0), 0);

    const cab = [
        `🏥 <b>UTI de Recuperação — ${massas.length} massa(s) processada(s)</b>`,
        `✅ Saíram da UTI: <b>${curadas.length}</b>`,
        comprovantes ? `🧾 Comprovantes reenviados: <b>${comprovantes}</b>` : null,
        `❌ Falhas: <b>${falhas.length}</b>`,
        `⏸️ Sem cura automática: <b>${semCura.length}</b>`,
        `🕒 ${agora()}${aplicadoPor ? ` · por <code>${fmtCpf(aplicadoPor)}</code>` : ''}`,
    ].filter(Boolean);

    const blocos = [];
    if (falhas.length) {
        blocos.push('\n<b>Falhas</b>', ...falhas.map((m) => {
            const erro = m.anomalias.map((a) => a.plano && a.plano.erro).filter(Boolean).join('; ');
            return `• ${escHtml(m.nome || 'sem nome')} (<code>${fmtCpf(m.cpf)}</code>) — ${escHtml(erro || 'falhou')}`;
        }));
    }
    if (curadas.length) {
        blocos.push('\n<b>Curadas</b>', ...curadas.map((m) => `• ${escHtml(m.nome || 'sem nome')} (<code>${fmtCpf(m.cpf)}</code>)`));
    }

    let texto = cab.join('\n');
    for (const linha of blocos) {
        if (texto.length + linha.length + 1 > LIMITE_MSG) {
            texto += '\n… lista completa no painel Admin › UTI › Histórico.';
            break;
        }
        texto += `\n${linha}`;
    }
    return texto;
}

// A categoria nasce LIGADA (o admin pediu esse aviso); se já existir, respeita o toggle.
async function garantirCategoria(db, esc) {
    await db.executeQuery(`
        INSERT INTO ${db.fq('telegram_settings')} (category, enabled)
        VALUES (${esc(CATEGORIA)}, true)
        ON CONFLICT (category) DO NOTHING
    `);
}

/**
 * Fire-and-forget: nunca lança (a cura já foi gravada; aviso é secundário).
 * @param {object} telegramService
 * @param {object} relatorio  retorno de runUti com confirm=true
 * @param {object} opts { db, esc, aplicadoPor }
 */
async function notificarCuras(telegramService, relatorio, { db, esc, aplicadoPor = null } = {}) {
    try {
        if (!relatorio || relatorio.modo !== 'confirm' || !(relatorio.relatorio || []).length) return;
        await garantirCategoria(db, esc);
        if (typeof telegramService.invalidateSettingCache === 'function') telegramService.invalidateSettingCache(CATEGORIA);

        for (const m of relatorio.relatorio.filter(saiuDaUti)) {
            await telegramService.alertUser(m.cpf, mensagemDaMassa(m, aplicadoPor), m.nome, CATEGORIA);
        }
        await telegramService.alertTopic(TOPICO_RESUMO, mensagemResumo(relatorio, aplicadoPor), CATEGORIA);
    } catch (err) {
        console.warn('[utiAlerts] aviso no Telegram falhou:', err.message);
    }
}

module.exports = { CATEGORIA, TOPICO_RESUMO, mensagemDaMassa, mensagemResumo, notificarCuras };
