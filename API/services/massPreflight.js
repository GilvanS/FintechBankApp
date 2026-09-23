/**
 * Pre-flight audit da massa recém-criada pelo Gerador de Massa (POST /api/admin/users/mass).
 *
 * Regra de reprovação (pedido explícito do usuário): a geração só FALHA quando a massa
 * nasce estruturalmente quebrada pro banco — o invariante canônico de
 * usersRepo.validarInvarianteMassa (faturas FECHADA não pagas == ciclos inadimplentes)
 * não bate. Qualquer outra anomalia vira aviso (🏥), não bloqueia.
 *
 * TRANSACAO_ORFA é AVISO, não reprovação: a regra canônica (dailyAudit.js Anomalia 5)
 * exige installment_plans.purchase_tx_id por transação, então TODA parcela 2..N de uma
 * massa inadimplente cai nela — reprovar por isso reprovaria 100% das inadimplentes.
 * Também não roda cura automática aqui: runOrphanInstallmentFix recriaria o plano a
 * partir do valor da tx 1/N (que o seedMassBilling grava com o principal cheio), gerando
 * plano com total errado.
 *
 * Massa reprovada vai pro fintech.tbl_cemiterio_teste (mesma tabela do
 * scripts/populate_cemiterio_teste.cjs) — o registro do usuário NÃO é apagado.
 */
const { checkOrphanInstallments } = require('./dailyAudit');
const { esc } = require('../repositories/context');

async function enviarParaCemiterioTeste(db, cpf, fullName, tipos, detalhes) {
    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${db.fq('tbl_cemiterio_teste')} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cpf VARCHAR(11) NOT NULL,
            nome_completo TEXT,
            tipos_anomalia TEXT[] NOT NULL,
            detalhes JSONB NOT NULL,
            data_entrada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(30) NOT NULL DEFAULT 'precisa_massa_nova'
        )
    `);
    const jaExiste = await db.executeQuery(`SELECT id FROM ${db.fq('tbl_cemiterio_teste')} WHERE cpf = ${esc(cpf)}`);
    if (jaExiste.length > 0) return;
    await db.executeQuery(`
        INSERT INTO ${db.fq('tbl_cemiterio_teste')} (cpf, nome_completo, tipos_anomalia, detalhes)
        VALUES (${esc(cpf)}, ${esc(fullName || '')}, ARRAY[${tipos.map(t => esc(t)).join(',')}]::text[], ${esc(JSON.stringify(detalhes))}::jsonb)
    `);
}

/**
 * @param {object} db - dbService já conectado
 * @param {{cpf: string, fullName: string, massaValidation: {ok: boolean, motivo: string|null}|null}} massa
 * @param {{onStep?: function}} opts - onStep(id, status, detail), status: running|done|uti|error
 * @returns {Promise<{ok: boolean, motivo: string|null, orphans: number}>}
 */
async function runMassPreflight(db, massa, { onStep } = {}) {
    const step = (id, status, detail) => {
        if (typeof onStep !== 'function') return;
        try { onStep(id, status, detail); } catch { /* best-effort */ }
    };
    const { cpf, fullName, massaValidation, limite, limiteErro } = massa;
    const brl = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    step('auditoria', 'running');

    let orphans = [];
    let orphanCheckError = null;
    try {
        orphans = await checkOrphanInstallments(db, cpf);
    } catch (err) {
        orphanCheckError = err.message;
        console.warn(`⚠️ [preflight] checkOrphanInstallments falhou para ${cpf}:`, err.message);
    }

    if (massaValidation && massaValidation.ok === false) {
        const motivo = massaValidation.motivo || 'invariante da massa não bate';
        step('auditoria', 'error', motivo);
        try {
            await enviarParaCemiterioTeste(db, cpf, fullName, ['INVARIANTE_MASSA'], [{ type: 'INVARIANTE_MASSA', details: motivo }]);
        } catch (err) {
            console.warn(`⚠️ [preflight] não foi possível enviar ${cpf} ao cemitério:`, err.message);
        }
        step('validacao', 'error', 'Massa reprovada — enviada ao cemitério de teste');
        return { ok: false, motivo, orphans: orphans.length };
    }

    // Checagem que falhou NÃO pode aparecer como "Nenhuma anomalia" — vira aviso explícito.
    if (orphans.length > 0 || !massaValidation || orphanCheckError || limiteErro) {
        const avisos = [];
        if (orphans.length > 0) avisos.push(`${orphans.length} parcela(s) sem vínculo de plano (TRANSACAO_ORFA)`);
        if (orphanCheckError) avisos.push(`checagem de órfãs falhou: ${orphanCheckError}`);
        if (!massaValidation) avisos.push('invariante não pôde ser verificado');
        if (limiteErro) avisos.push(`limite disponível não recalculado: ${limiteErro}`);
        step('auditoria', 'uti', `${avisos.join(' • ')} — não bloqueia`);
    } else {
        step('auditoria', 'done', 'Nenhuma anomalia');
    }
    step('validacao', 'done', limite
        ? `Massa pronta • limite disponível R$ ${brl(limite.limiteNovo)} de R$ ${brl(limite.totalLimit)}`
        : 'Massa pronta para uso');
    return { ok: true, motivo: null, orphans: orphans.length };
}

module.exports = { runMassPreflight };
