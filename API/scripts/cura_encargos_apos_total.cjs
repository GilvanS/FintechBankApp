#!/usr/bin/env node
/**
 * cura_encargos_apos_total.cjs — remove encargos PENDING cobrados SEM dívida depois de
 * um pagamento TOTAL (Task 4, fix 1). Duas origens, a mesma cobrança indevida:
 *   - "continuou contando" depois do TOTAL (Anomalia 8e, ENCARGO_APOS_QUITACAO_TOTAL);
 *   - débito ANTERIOR ao TOTAL recriado com created_at novo (a Anomalia 8b/botão
 *     fix-charges-proactive regerava multa/IOF em FECHADA já quitada — ex.: CPF
 *     42194343806, 21/09 23:54, multa 77,42 + IOF 14,71).
 * Critério (fonte única): auditoriaEncargos.listarEncargosSemDebitoAposTotal — criado
 * depois de um TOTAL ao vivo e sem principal vencido em aberto naquele instante.
 *
 * Padrão: SIMULA (só mostra CPFs, faturas, encargos e valor). --confirm apaga, por id,
 * só as charges que continuam 'pending'. Nunca toca a FECHADA (imutável) nem charge
 * 'paid' — encargo PAGO sem dívida vira devolução ao saldo, decisão manual (listado).
 *
 * Uso (dentro de API/):
 *   node scripts/cura_encargos_apos_total.cjs                 # simulação, base toda
 *   node scripts/cura_encargos_apos_total.cjs --cpf=12345678901
 *   node scripts/cura_encargos_apos_total.cjs --confirm       # aplica
 *   node scripts/cura_encargos_apos_total.cjs --json          # saída em JSON
 */
const path = require('path');
// Só como CLI: o teste importa planejar/aplicar sem carregar .env.
if (require.main === module) require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { round2 } = require('../utils/invoiceMath');
const { esc } = require('../repositories/context');
const { listarEncargosSemDebitoAposTotal } = require('../services/auditoriaEncargos');

const soma = (rows) => round2(rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0));

/** Plano da cura (só leitura). */
async function planejarCura(db, { cpf = null } = {}) {
    const porCpf = await listarEncargosSemDebitoAposTotal(db, { cpf, esc });
    const remover = [];
    const pagosSemDivida = [];
    for (const { cpf: c, fullName, encargos } of porCpf) {
        for (const e of encargos) (e.status === 'pending' ? remover : pagosSemDivida).push({ ...e, cpf: c, fullName });
    }
    const faturasDe = (rows) => new Set(rows.map((r) => `${r.cpf}|${r.invoiceId || '?'}`)).size;
    const grupo = (rows) => ({ cpfs: new Set(rows.map((r) => r.cpf)).size, faturas: faturasDe(rows), encargos: rows.length, valor: soma(rows) });
    return {
        remover,
        pagosSemDivida,
        resumo: {
            remover: grupo(remover),
            continuouContando: grupo(remover.filter((r) => r.acusa)),
            recriadoAnterior: grupo(remover.filter((r) => !r.acusa)),
            pagosSemDivida: grupo(pagosSemDivida),
        },
    };
}

/** Apaga, por id, as charges do plano que AINDA estão pending (nunca as pagas). */
async function aplicarCura(db, plano) {
    const ids = plano.remover.map((r) => r.id);
    if (!ids.length) return { apagadas: 0 };
    let apagadas = 0;
    for (let i = 0; i < ids.length; i += 200) {
        const lote = ids.slice(i, i + 200);
        const rows = await db.executeQuery(`
            DELETE FROM ${db.fq('billing_charges')}
            WHERE status = 'pending' AND id IN (${lote.map((id) => esc(id)).join(', ')})
            RETURNING id
        `);
        apagadas += (rows || []).length;
    }
    return { apagadas };
}

async function main() {
    const DatabaseFactory = require('../services/database/DatabaseFactory');
    const cpfArg = (process.argv.find((a) => a.startsWith('--cpf=')) || '').slice(6).replace(/\D/g, '');
    const confirm = process.argv.includes('--confirm');
    const json = process.argv.includes('--json');
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    try {
        const plano = await planejarCura(db, { cpf: cpfArg.length === 11 ? cpfArg : null });
        const saida = { modo: confirm ? 'APLICADO' : 'SIMULACAO', ...plano.resumo };
        if (confirm) saida.aplicado = await aplicarCura(db, plano);
        if (json) {
            console.log(JSON.stringify({ ...saida, remover: plano.remover.map(({ id, cpf, invoiceId, charge_type, amount, acusa }) => ({ id, cpf, invoiceId, charge_type, amount, acusa })) }, null, 2));
        } else {
            console.log(`${saida.modo} — encargos pending sem dívida depois do TOTAL:`, saida.remover);
            console.log('  continuou contando (8e):', saida.continuouContando);
            console.log('  débito anterior recriado:', saida.recriadoAnterior);
            console.log('  PAGOS sem dívida (devolução manual, não tocados):', saida.pagosSemDivida);
            if (saida.aplicado) console.log('  apagadas:', saida.aplicado.apagadas);
        }
    } finally {
        await db.disconnect();
    }
}

if (require.main === module) {
    main().catch((err) => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { planejarCura, aplicarCura };
