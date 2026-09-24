#!/usr/bin/env node
/**
 * vincular_pagamentos_legados.cjs — vincula (transactions.invoice_id) os INVOICE_PAYMENT
 * antigos que ficaram sem fatura, classificando cada um como TOTAL ou PARCIAL.
 *
 * Por quê: a quitação da tela (enrichUserCreditCardData) e o saldo anterior do
 * fechamento (services/saldoAnterior.js) só contam pagamentos VINCULADOS. Os 941
 * pagamentos gerados antes do vínculo (massas antigas) eram ignorados: a massa
 * aparecia devedora e as fechadas seguintes não herdavam o que era devido.
 *
 * Regra (usuário, 2026-09-23 — memória regra-encargos-pagamento-parcial):
 *   - TOTAL: o pagamento cobre tudo o que faltava da fatura mais antiga em aberto na
 *     data → encargos PARAM ali; a aberta herda só os encargos já acumulados.
 *   - PARCIAL (mínimo / abaixo do mínimo / parcial): o residual continua devendo e os
 *     encargos seguem contando do vencimento até a quitação total.
 * Vincular é o que faz a quitação em cascata e o motor de encargos aplicarem essa
 * regra. Fatura FECHADA não é tocada (só transactions.invoice_id).
 *
 * "Em aberto na data": fatura cujo fechamento (vencimento − 10 dias) já tinha
 * passado — o created_at das massas antigas é a data de geração, não do fechamento.
 * Pagamento sem nenhuma fatura em aberto na data (pagou a mais) fica sem vínculo.
 *
 * Uso:
 *   node scripts/vincular_pagamentos_legados.cjs            # simula (nada é gravado)
 *   node scripts/vincular_pagamentos_legados.cjs --apply    # grava (transação única)
 * Desfazer: UPDATE transactions SET invoice_id = NULL WHERE id IN
 *   (SELECT ref_id FROM uti_curas WHERE tipo = 'PAGAMENTO_LEGADO_VINCULADO')
 */
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { esc } = require('../repositories/context');
const { garantirTabela } = require('../services/utiCuraLog');

const APPLY = process.argv.includes('--apply');
const DIA = 86400000;
const JANELA_FECHAMENTO_DIAS = 10;

function planejar(legados, faturas, vinculados) {
    const faturasPorCpf = new Map();
    for (const f of faturas) (faturasPorCpf.get(f.cpf) || faturasPorCpf.set(f.cpf, []).get(f.cpf)).push({ ...f, vt: parseFloat(f.valor_total), pago: 0 });
    const pagsPorCpf = new Map();
    for (const p of [...legados.map((x) => ({ ...x, legado: true })), ...vinculados.map((x) => ({ ...x, legado: false }))]) {
        (pagsPorCpf.get(p.cpf) || pagsPorCpf.set(p.cpf, []).get(p.cpf)).push(p);
    }

    const plano = [];
    for (const [cpf, pags] of pagsPorCpf) {
        pags.sort((a, b) => new Date(a.date) - new Date(b.date));
        const fs = faturasPorCpf.get(cpf) || [];
        for (const p of pags) {
            const t = new Date(p.date).getTime();
            let resto = Math.abs(parseFloat(p.amount));
            const abertas = fs.filter((f) => new Date(f.due_date).getTime() - JANELA_FECHAMENTO_DIAS * DIA <= t && f.vt - f.pago > 0.005);
            if (p.legado && abertas.length) {
                const alvo = abertas[0];
                const faltava = Math.round((alvo.vt - alvo.pago) * 100) / 100;
                plano.push({
                    txId: p.id, cpf, data: p.date, valor: resto, invoiceId: alvo.id,
                    classificacao: resto >= faltava - 0.02 ? 'TOTAL' : 'PARCIAL', faltava,
                });
            }
            // Cascata (mais antiga primeiro) — mesma regra do planDistribution.
            for (const f of abertas) {
                if (resto <= 0.005) break;
                const usado = Math.min(resto, f.vt - f.pago);
                f.pago += usado;
                resto -= usado;
            }
        }
    }
    return plano;
}

async function main() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    try {
        const legados = await db.executeQuery(`
            SELECT id, cpf, date, amount FROM fintech.transactions
            WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NULL AND (status IS NULL OR status <> 'cancelled')`);
        const vinculados = await db.executeQuery(`
            SELECT id, cpf, date, amount FROM fintech.transactions
            WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL`);
        const faturas = await db.executeQuery(`
            SELECT id, cpf, due_date, valor_total FROM fintech.invoices WHERE status = 'FECHADA' ORDER BY cpf, due_date`);

        const plano = planejar(legados, faturas, vinculados);
        const total = plano.filter((p) => p.classificacao === 'TOTAL').length;
        const parcial = plano.length - total;
        console.log(`Pagamentos legados sem vínculo: ${legados.length}`);
        console.log(`A vincular: ${plano.length} (TOTAL ${total} · PARCIAL ${parcial}) em ${new Set(plano.map((p) => p.cpf)).size} massa(s)`);
        console.log(`Sem fatura em aberto na data (ficam sem vínculo): ${legados.length - plano.length}`);

        if (!APPLY) {
            console.log('\nSimulação — nada foi gravado. Rode com --apply para gravar.');
            return;
        }
        if (!plano.length) return;

        await garantirTabela(db);
        const valores = plano.map((p) => `(${esc(p.txId)}, ${esc(p.invoiceId)})`).join(',\n');
        const historico = plano.map((p) => `(${esc(p.cpf)}, 'PAGAMENTO_LEGADO_VINCULADO', ${esc(
            `Pagamento antigo de R$ ${p.valor.toFixed(2)} vinculado à fatura ${p.invoiceId} como ${p.classificacao}`
            + (p.classificacao === 'TOTAL' ? ' (encargos param).' : ` (faltavam R$ ${p.faltava.toFixed(2)}; residual segue com encargos).`),
        )}, ${esc(p.txId)}, ${esc(JSON.stringify({ invoiceId: p.invoiceId, classificacao: p.classificacao, valor: p.valor, faltava: p.faltava }))}::jsonb, 'script:vincular_pagamentos_legados')`).join(',\n');

        await db.executeQuery(`
            BEGIN;
            UPDATE fintech.transactions t SET invoice_id = v.inv
            FROM (VALUES ${valores}) AS v(tx, inv)
            WHERE t.id = v.tx AND t.invoice_id IS NULL;
            INSERT INTO fintech.uti_curas (cpf, tipo, acao, ref_id, detalhes, aplicado_por) VALUES ${historico};
            COMMIT;
        `);
        const [conf] = await db.executeQuery(`SELECT COUNT(*)::int AS n FROM fintech.transactions WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NULL AND (status IS NULL OR status <> 'cancelled')`);
        console.log(`\nGravado. Pagamentos legados ainda sem vínculo: ${conf.n}`);
    } finally {
        await db.disconnect().catch(() => {});
    }
}

if (require.main === module) {
    main().then(() => process.exit(0)).catch((err) => {
        console.error('Erro:', err.message);
        process.exit(1);
    });
}

module.exports = { planejar };
