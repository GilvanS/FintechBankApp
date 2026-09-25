/**
 * utiCuraLog.js — histórico PERMANENTE do que a UTI de Recuperação aplicou.
 *
 * Cada cura aplicada grava 1 linha em fintech.uti_curas (quem, quando, qual anomalia,
 * o que foi feito e o registro afetado). Serve para:
 *   - o painel mostrar o que já foi corrigido (em vez de o admin tentar de novo);
 *   - a detecção não reacusar o que já foi tratado (ex.: comprovante reenviado para
 *     um pagamento antigo — o log do Telegram fica com a data do reenvio, fora da
 *     janela do pagamento).
 */
const { esc: escPadrao } = require('../repositories/context');

let tabelaGarantida = null;

function garantirTabela(db) {
    if (!tabelaGarantida) {
        tabelaGarantida = db.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${db.fq('uti_curas')} (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cpf VARCHAR(11) NOT NULL,
                tipo VARCHAR(80) NOT NULL,
                acao TEXT NOT NULL,
                ref_id VARCHAR(80),
                detalhes JSONB,
                aplicado_por VARCHAR(40),
                aplicado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `).then(() => db.executeQuery(`
            CREATE INDEX IF NOT EXISTS idx_uti_curas_cpf ON ${db.fq('uti_curas')} (cpf, aplicado_em DESC)
        `)).catch((err) => { tabelaGarantida = null; throw err; });
    }
    return tabelaGarantida;
}

async function registrarCura(db, { cpf, tipo, acao, refId = null, detalhes = null, aplicadoPor = null }, esc = escPadrao) {
    await garantirTabela(db);
    await db.executeQuery(`
        INSERT INTO ${db.fq('uti_curas')} (cpf, tipo, acao, ref_id, detalhes, aplicado_por)
        VALUES (${esc(cpf)}, ${esc(tipo)}, ${esc(acao)}, ${refId ? esc(String(refId)) : 'NULL'},
                ${detalhes ? `${esc(JSON.stringify(detalhes))}::jsonb` : 'NULL'}, ${aplicadoPor ? esc(String(aplicadoPor)) : 'NULL'})
    `);
}

async function listarCuras(db, { cpf = null, limite = 200 } = {}, esc = escPadrao) {
    await garantirTabela(db);
    const lim = Math.min(Math.max(parseInt(limite, 10) || 200, 1), 1000);
    return db.executeQuery(`
        SELECT c.id, c.cpf, u.full_name, c.tipo, c.acao, c.ref_id, c.detalhes, c.aplicado_por, c.aplicado_em
        FROM ${db.fq('uti_curas')} c
        LEFT JOIN ${db.fq('users')} u ON u.cpf = c.cpf
        ${cpf ? `WHERE c.cpf = ${esc(cpf)}` : ''}
        ORDER BY c.aplicado_em DESC
        LIMIT ${lim}
    `);
}

// Reset só para testes (a tabela é garantida 1x por processo).
function _resetParaTestes() { tabelaGarantida = null; }

module.exports = { garantirTabela, registrarCura, listarCuras, _resetParaTestes };
