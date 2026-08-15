#!/usr/bin/env node
/**
 * freeze_orphaned_charges.cjs
 * Backfill de encargos órfãos do billing_charges para a fatura fechada correta.
 *
 * Contexto do bug (massa 805.357.576-54): no fechamento do Fat 2 (30/jul), o
 * invoiceEngine procurava charges pendentes filtradas por invoice_reference do
 * ciclo ATUAL ('2026-08'), mas o runBillingValidation/seed gravava os encargos
 * do atraso sob a referência da fatura VENCIDA que os gerou ('2026-07'). Com o
 * filtro errado, o Fat 2 fechava com multa/juros/IOF congelados = 0 e as charges
 * de julho (R$ 414,08) ficavam 'pending' órfãs, sendo herdadas pela fatura aberta
 * em vez de aparecerem na análise mensal do período certo.
 *
 * Este script replica o que o motor corrigido faz automaticamente a partir de
 * agora: para o CPF + ref informados, congela as charges 'pending' da ref nas
 * colunas (valor_multa, valor_juros_mora, valor_juros_remuneratorios, valor_iof)
 * da fatura fechada cujo
 * vencimento é logo após o fim daquele mês (a que foi criada no fechamento
 * seguinte ao período de acúmulo).
 *
 * IMPORTANTE — o congelamento é DISPLAY-ONLY (análise mensal por período). As
 * charges NÃO são marcadas 'paid': a rota de pagamento (invoiceController.pay)
 * cobra `principal + SUM(billing_charges pending)` e nunca marca paid — marcar
 * aqui removeria os encargos da coleta (perda de dívida). O freeze só copia os
 * valores para as colunas da fatura fechada; o status das charges permanece
 * 'pending' para o fluxo de cobrança.
 *
 * A fatura FECHADA é monetariamente imutável (trigger
 * trg_invoices_immutable_when_closed, migration 006) — o UPDATE das colunas de
 * encargos exige DISABLE TRIGGER, mesma porta de manutenção do
 * fix_orphan_payment_step7.cjs.
 *
 * Uso:
 *   node scripts/freeze_orphaned_charges.cjs                       # dry-run (CPF 80535757654, ref 2026-07)
 *   node scripts/freeze_orphaned_charges.cjs 12345678901 2026-08   # dry-run de outro CPF/ref
 *   node scripts/freeze_orphaned_charges.cjs --confirm             # aplica (transação + DISABLE/ENABLE TRIGGER)
 *
 * Requer acesso ao PostgreSQL (somente leitura no dry-run).
 */
require('dotenv').config();
const { Pool } = require('pg');

const schema = process.env.DB_SCHEMA || 'fintech';
const TRIGGER_NAME = 'trg_invoices_immutable_when_closed';
const DEFAULT_CPF = '80535757654';
const DEFAULT_REF = '2026-07';
const r2 = (n) => Math.round(n * 100) / 100;

const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');
const cpf = String(
    args.find((a) => !a.startsWith('--') && a.replace(/\D/g, '').length === 11) || DEFAULT_CPF
).replace(/\D/g, '');
const ref = String(
    args.find((a) => /^\d{4}-\d{2}$/.test(a)) || DEFAULT_REF
);

if (cpf.length !== 11) {
    console.error(`CPF inválido: "${cpf}"`);
    process.exit(1);
}

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'fintechbank',
});

let triggerDisabled = false;
async function ensureTriggerEnabled() {
    if (!triggerDisabled) return;
    try {
        await pool.query(`ALTER TABLE ${schema}.invoices ENABLE TRIGGER ${TRIGGER_NAME}`);
        console.log(`[guard] Trigger "${TRIGGER_NAME}" reabilitada (morte prematura).`);
        triggerDisabled = false;
    } catch (_) { /* o finally do main cobre */ }
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => {
        ensureTriggerEnabled().finally(() => process.exit(130));
    });
}

async function main() {
    const client = await pool.connect();
    try {
        await client.query('SET statement_timeout = 60000');
        console.log('===[ Freeze de encargos órfãos em fatura fechada ]===');
        console.log(`CPF: ${cpf} | ref: ${ref}${CONFIRM ? ' | CONFIRM' : ' | dry-run'}\n`);

        // 1. Charges pending da ref (fonte da verdade dos valores a congelar)
        const chargesRes = await client.query(
            `SELECT charge_type, ROUND(SUM(amount)::numeric, 2) AS total, COUNT(*)::int AS qtd
             FROM ${schema}.billing_charges
             WHERE cpf = $1 AND invoice_reference = $2 AND status = 'pending'
             GROUP BY charge_type ORDER BY charge_type`,
            [cpf, ref]
        );
        if (chargesRes.rows.length === 0) {
            console.log(`Nenhuma charge pending na ref ${ref} para o CPF ${cpf} — nada a congelar. ✅`);
            return;
        }
        const byType = Object.fromEntries(chargesRes.rows.map((r) => [r.charge_type, parseFloat(r.total)]));
        const multa = byType['multa'] || 0;
        const jurosMora = byType['juros_mora'] || 0;
        const jurosRem = byType['juros_remuneratorios'] || 0;
        const iof = byType['iof'] || 0;
        const totalCharges = r2(multa + jurosMora + jurosRem + iof);
        console.log('Charges pending da ref a congelar:');
        for (const r of chargesRes.rows) {
            console.log(`   - ${r.charge_type.padEnd(22)} R$ ${r.total} (${r.qtd} linha(s))`);
        }
        console.log(`   TOTAL: R$ ${totalCharges.toFixed(2)}\n`);

        // 2. Fatura alvo: FECHADA, vencimento depois do fim da ref (criada no
        //    fechamento seguinte ao período de acúmulo) e ainda SEM encargos
        //    congelados (não pode ser duplicada).
        const [y, m] = ref.split('-').map(Number);
        const refEnd = new Date(Date.UTC(y, m, 1)); // 1º do mês seguinte
        const invRes = await client.query(
            `SELECT id, due_date, valor_total, saldo_anterior,
                    COALESCE(valor_multa,0) AS valor_multa,
                    COALESCE(valor_juros_mora,0) AS valor_juros_mora,
                    COALESCE(valor_juros_remuneratorios,0) AS valor_juros_remuneratorios,
                    COALESCE(valor_iof,0) AS valor_iof
             FROM ${schema}.invoices
             WHERE cpf = $1 AND status = 'FECHADA'
               AND due_date > $2
             ORDER BY due_date ASC`,
            [cpf, refEnd.toISOString()]
        );
        const target = invRes.rows.find((i) => {
            const frozen = parseFloat(i.valor_multa) + parseFloat(i.valor_juros_mora) +
                           parseFloat(i.valor_juros_remuneratorios) + parseFloat(i.valor_iof);
            return frozen < 0.005;
        });
        if (!target) {
            console.log('⚠️  Nenhuma fatura FECHADA posterior à ref e ainda sem encargos congelados encontrada.');
            console.log('   Nada foi alterado. (Se a fatura já tem encargos congelados, o freeze já foi feito.)');
            return;
        }
        const frozenAtual = r2(
            parseFloat(target.valor_multa) + parseFloat(target.valor_juros_mora) +
            parseFloat(target.valor_juros_remuneratorios) + parseFloat(target.valor_iof)
        );
        console.log(`Fatura alvo: ${target.id}`);
        console.log(`   venc ${new Date(target.due_date).toISOString()} | principal ${target.valor_total} | saldo_anterior ${target.saldo_anterior}`);
        console.log(`   encargos congelados atuais: R$ ${frozenAtual.toFixed(2)}`);
        console.log(`\nPLANO: congelar R$ ${totalCharges.toFixed(2)} nas colunas da fatura fechada.`);
        console.log(`   As charges da ref permanecem 'pending' (coleta preservada — pay cobra principal + SUM(pending)).`);
        console.log(`   multa=${multa.toFixed(2)} | juros_mora=${jurosMora.toFixed(2)} | juros_rem=${jurosRem.toFixed(2)} | iof=${iof.toFixed(2)}`);

        if (!CONFIRM) {
            console.log('\n── DRY-RUN: nenhuma alteração aplicada. Use --confirm para aplicar. ──');
            return;
        }

        console.log('\n--[ DISABLE TRIGGER ]--');
        await client.query(`ALTER TABLE ${schema}.invoices DISABLE TRIGGER ${TRIGGER_NAME}`);
        triggerDisabled = true;
        try {
            await client.query('BEGIN');
            await client.query(
                `UPDATE ${schema}.invoices
                 SET valor_multa = $1, valor_juros_mora = $2, valor_juros_remuneratorios = $3,
                     valor_iof = $4, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5`,
                [multa.toFixed(2), jurosMora.toFixed(2), jurosRem.toFixed(2), iof.toFixed(2), target.id]
            );
            console.log(`  ✅ invoice ${target.id}: encargos congelados gravados (R$ ${totalCharges.toFixed(2)}).`);

            // NÃO marcar as charges como 'paid' — o freeze é display-only e a
            // cobrança real usa SUM(billing_charges pending) (invoiceController.pay).
            // Marcar paid aqui perderia R$ 414,08 da coleta desta massa.
            await client.query('COMMIT');
            console.log('Transação commitada.');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('❌ Erro no freeze, ROLLBACK aplicado. Nada foi alterado:', err.message);
            throw err;
        } finally {
            await client.query(`ALTER TABLE ${schema}.invoices ENABLE TRIGGER ${TRIGGER_NAME}`);
            triggerDisabled = false;
            console.log('--[ ENABLE TRIGGER ]--');
            console.log(`Trigger "${TRIGGER_NAME}" reabilitada.`);
        }

        // Verificação
        console.log('\n--[ Verificação pós-freeze ]--');
        const afterInv = await client.query(
            `SELECT due_date, valor_total, valor_multa, valor_juros_mora, valor_juros_remuneratorios, valor_iof
             FROM ${schema}.invoices WHERE cpf = $1 AND status = 'FECHADA' ORDER BY due_date ASC`,
            [cpf]
        );
        for (const i of afterInv.rows) {
            const frozen = r2(parseFloat(i.valor_multa) + parseFloat(i.valor_juros_mora) +
                              parseFloat(i.valor_juros_remuneratorios) + parseFloat(i.valor_iof));
            console.log(`   ${new Date(i.due_date).toISOString()} | principal ${i.valor_total} | encargos congelados R$ ${frozen.toFixed(2)}`);
        }
        const pendingRes = await client.query(
            `SELECT ROUND(SUM(amount)::numeric,2) AS total FROM ${schema}.billing_charges
             WHERE cpf = $1 AND status = 'pending'`,
            [cpf]
        );
        console.log(`   charges ainda pending do CPF: R$ ${pendingRes.rows[0].total || 0} (mantidas para a coleta)`);
        console.log('\n✅ Freeze concluído.');
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error('ERRO FATAL:', e.message);
    process.exit(1);
}).finally(() => {
    setTimeout(() => process.exit(0), 800);
});
