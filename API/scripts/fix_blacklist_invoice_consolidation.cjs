/**
 * Consolida faturas FECHADAS de massa já em blacklist (is_blacklisted=true) que
 * acumulou múltiplos ciclos indevidamente (bug corrigido em invoiceEngine.js — ele não
 * checava blacklist antes de fechar ciclo novo). Regra de negócio confirmada: uma vez em
 * blacklist, só deveria existir 1 fatura com o total acumulado até o ponto de entrada —
 * "perda pro banco", só renegociação reativa.
 *
 * Mantém a fatura mais recente (due_date maior), com valor_total = soma de todas as
 * faturas não pagas da sequência e saldo_anterior = 0; DELETA as demais. Não mexe em
 * billing_charges (ficam como histórico do que já foi calculado).
 *
 * Rodar (dentro da pasta API):
 *   node scripts/fix_blacklist_invoice_consolidation.cjs
 */
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');

async function main() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();

    const candidatos = await db.executeQuery(`
        SELECT cpf, COUNT(*) AS n
        FROM fintech.invoices
        WHERE status = 'FECHADA' AND data_pagamento IS NULL
          AND cpf IN (SELECT cpf FROM fintech.users WHERE COALESCE(is_blacklisted, false) = true)
        GROUP BY cpf
        HAVING COUNT(*) > 1
    `);

    console.log(`🔎 ${candidatos.length} massa(s) blacklist com faturas empilhadas pra consolidar.`);

    // invoices_immutability (migration 006) bloqueia UPDATE em coluna monetária de fatura
    // FECHADA. Escape hatch documentado na própria migration pra manutenção legítima.
    // try/finally garante reativar mesmo se algo falhar no meio do loop.
    await db.executeQuery('ALTER TABLE fintech.invoices DISABLE TRIGGER trg_invoices_immutable_when_closed');

    let ok = 0;
    try {
        for (const c of candidatos) {
            const invs = await db.executeQuery(`
                SELECT id, due_date, valor_total
                FROM fintech.invoices
                WHERE cpf = '${c.cpf}' AND status = 'FECHADA' AND data_pagamento IS NULL
                ORDER BY due_date ASC
            `);
            const total = invs.reduce((sum, i) => sum + parseFloat(i.valor_total || 0), 0);
            const roundedTotal = Math.round(total * 100) / 100;
            const manterId = invs[invs.length - 1].id;
            const apagarIds = invs.slice(0, -1).map(i => i.id);

            await db.executeQuery(`
                UPDATE fintech.invoices
                SET valor_total = ${roundedTotal}, saldo_anterior = 0, updated_at = CURRENT_TIMESTAMP
                WHERE id = '${manterId}'
            `);
            if (apagarIds.length > 0) {
                await db.executeQuery(`
                    DELETE FROM fintech.invoices WHERE id IN (${apagarIds.map(id => `'${id}'`).join(',')})
                `);
            }
            console.log(`  ✅ ${c.cpf}: ${invs.length} faturas → 1 (id ${manterId}, total R$ ${roundedTotal.toFixed(2)})`);
            ok++;
        }
    } finally {
        await db.executeQuery('ALTER TABLE fintech.invoices ENABLE TRIGGER trg_invoices_immutable_when_closed');
    }

    console.log(`✅ ${ok} massa(s) consolidada(s).`);
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Erro na consolidação:', err.message);
    process.exit(1);
});
