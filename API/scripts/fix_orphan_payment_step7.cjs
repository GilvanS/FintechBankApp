#!/usr/bin/env node
/**
 * fix_orphan_payment_step7.cjs
 * Passo 7 do plano de imutabilidade — corrige pagamentos órfãos (INVOICE_PAYMENT
 * sem invoice_id) que fazem a quitação não ser derivável pelo SUM(transactions).
 *
 * Contexto: a trigger `trg_invoices_immutable_when_closed` congela o monetário da
 * fatura FECHADA. A quitação CORRETA é derivada de transactions.invoice_id
 * (getClosedInvoiceDebt). Pagamentos pré-migration-005 sem invoice_id ficaram
 * "herdados" no valor_pago legado — e o health check (categoria C do
 * runInvoiceImmutabilityHealth) flagra a divergência SUM(payments) vs valor_pago.
 *
 * Este script resolve a categoria C inteira com RATEIO RETROATIVO por CPF:
 *   - COBERTA    (órfãos == valor_pago)     → só vincula invoice_id;
 *   - EXCEDENTE  (órfãos > valor_pago)      → rateia: o principal vira vínculo e
 *     o excedente vira transação de ENCARGOS (invoice_id NULL, pré-005 → fora da
 *     categoria A). Ex.: pagamento 4.284,94 de fatura 3.870,86 → vínculo 3.870,86
 *     + tx de encargos 414,08;
 *   - MULTI-FATURA (um pagamento cobriu N faturas, ex.: 4.282,39 = 3.870,86 +
 *     411,53) → SPLIT da transação em N partes vinculadas;
 *   - status='cancelled' (estornados) são EXCLUÍDOS do pool — não viram vínculo;
 *   - DÉFICIT (órfãos < valor_pago, ex.: Beatriz 345,07 sem tx) → por padrão NÃO
 *     mexe e reporta para decisão humana. Com `--align-deficits` (requer
 *     `--confirm`), o valor_pago da fatura é ALINHADO à soma derivável das
 *     transações vinculadas (SUM payments) via DISABLE TRIGGER → UPDATE → ENABLE
 *     TRIGGER — zera a categoria C quando a divergência não tem transação.
 *
 * IMPORTANTE: --all (sem --align-deficits) NÃO altera invoices — só muta a
 * tabela transactions (sem trigger de imutabilidade), então a trigger de
 * invoices NUNCA é desabilitada no rateio. O DISABLE/ENABLE é usado apenas no
 * caminho legado (CPF único, sincronização de valor_pago) e no
 * --align-deficits (alinhamento explícito de déficit).
 *
 * Uso:
 *   node scripts/fix_orphan_payment_step7.cjs                # legado: CPF 09086747329
 *   node scripts/fix_orphan_payment_step7.cjs 12345678901    # legado: CPF específico
 *   node scripts/fix_orphan_payment_step7.cjs --all          # dry-run da categoria C inteira
 *   node scripts/fix_orphan_payment_step7.cjs --all --dry-run# idem (explícito)
 *   node scripts/fix_orphan_payment_step7.cjs --all --confirm# aplica (transação, ROLLBACK em erro)
 *   node scripts/fix_orphan_payment_step7.cjs --all --confirm --align-deficits # + alinha déficits sem transação
 *
 * Requer acesso ao PostgreSQL (somente leitura no --dry-run).
 */
require('dotenv').config();
const { Pool } = require('pg');

const schema = process.env.DB_SCHEMA || 'fintech';
const TRIGGER_NAME = 'trg_invoices_immutable_when_closed';
const DEFAULT_CPF = '09086747329';
const r2 = (n) => Math.round(n * 100) / 100;

const args = process.argv.slice(2);
const ALL_MODE = args.includes('--all');
const CONFIRM = args.includes('--confirm');
const ALIGN_DEFICITS = args.includes('--align-deficits');
const DRY_RUN = ALL_MODE && !CONFIRM;
const cpfArg = args.find((a) => !a.startsWith('--') && a.replace(/\D/g, '').length === 11);
const cpf = ALL_MODE ? null : String(cpfArg || DEFAULT_CPF).replace(/\D/g, '');

if (!ALL_MODE && cpf.length !== 11) {
    console.error(`CPF inválido: "${cpfArg || DEFAULT_CPF}"`);
    process.exit(1);
}

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'fintechbank',
});

// Guard: se o processo morrer (Ctrl+C/crash) entre DISABLE e ENABLE (apenas no
// caminho legado que sincroniza valor_pago), a trigger fica desabilitada no banco.
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

// ── Helpers de consulta ─────────────────────────────────────────────────────

/** Categoria C do health check (mesma query, com filtro de contas de serviço). */
async function queryCategoryC(client) {
    const r = await client.query(`
        SELECT i.id, i.cpf, i.valor_total, i.valor_pago, i.data_pagamento, i.due_date, u.full_name
        FROM ${schema}.invoices i
        LEFT JOIN ${schema}.users u ON u.cpf = i.cpf
        LEFT JOIN ${schema}.transactions t ON t.invoice_id = i.id AND t.type = 'INVOICE_PAYMENT'
        WHERE i.status = 'FECHADA'
          AND i.valor_pago IS NOT NULL
          AND i.valor_pago > 0
          AND u.cpf IS NOT NULL
          AND u.role IS DISTINCT FROM 'admin'
        GROUP BY i.id, i.cpf, i.valor_total, i.valor_pago, i.data_pagamento, i.due_date, u.full_name
        HAVING ABS(
            COALESCE(SUM(ABS(CAST(t.amount AS DECIMAL(15,2)))), 0)
            - CAST(COALESCE(i.valor_pago, '0') AS DECIMAL(15,2))
        ) > 0.02
        ORDER BY i.cpf, i.due_date
    `);
    return r.rows;
}

/** Pool de órfãos por CPF, excluindo cancelados (estornados) e txs de encargos
 *  criadas por rateios anteriores (são órfãs intencionais: pré-005 sem invoice por
 *  definição). Re-ratear essas txs duplicaria o excedente. */
async function queryOrphanPool(client, cpfs) {
    const r = await client.query(
        `SELECT id, cpf, type, amount, description, date, status, from_user, to_user, to_key
         FROM ${schema}.transactions
         WHERE cpf = ANY($1)
           AND type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
           AND invoice_id IS NULL
           AND (status IS NULL OR status <> 'cancelled')
           AND description IS DISTINCT FROM 'Encargos de atraso (rateio retroativo)'
         ORDER BY cpf, date ASC, id ASC`,
        [cpfs]
    );
    return r.rows;
}

async function queryCancelledOrphans(client, cpfs) {
    const r = await client.query(
        `SELECT id, cpf, amount, description, date, status
         FROM ${schema}.transactions
         WHERE cpf = ANY($1)
           AND type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
           AND invoice_id IS NULL
           AND status = 'cancelled'
         ORDER BY cpf, date ASC`,
        [cpfs]
    );
    return r.rows;
}

// ── Algoritmo de rateio retroativo (por CPF) ────────────────────────────────
// Invoices ordenadas por due_date ASC; órfãos por date ASC. Cada órfão é uma
// "unidade" que consome-se até esgotar: primeiro vínculo usa a tx original
// (reduzida se necessário), os seguintes criam novas txs, e o resto viram
// encargos (invoice_id NULL). Déficit não é tocado — reportado.

function buildCpfPlan(invoices, orphans) {
    const units = orphans.map((tx) => ({
        tx,
        remaining: r2(Math.abs(parseFloat(tx.amount))),
        allocations: [], // { inv, take }
    }));
    const plan = { links: [], splits: [], charges: [], deficits: [], unassigned: [] };

    // Passo 1 — vínculo EXATO: fatura que tem um órfão com remaining == target.
    // Evita dividir um pagamento perfeito (ex.: tx 393.07 → fatura de 393.07) em
    // rateio, o que criaria déficit artificial em faturas multi-invoice.
    for (const inv of invoices) {
        const target = r2(parseFloat(inv.valor_pago));
        const exact = units.find(
            (u) => u.allocations.length === 0 && u.remaining >= target - 0.005 && u.remaining <= target + 0.005
        );
        if (exact) {
            exact.allocations.push({ inv, take: target });
            exact.remaining = 0;
        }
    }

    // Passo 2 — rateio guloso (invoices por due_date ASC, órfãos por date ASC)
    for (const inv of invoices) {
        const target = r2(parseFloat(inv.valor_pago));
        let assigned = 0;
        for (const u of units) {
            const alloc = u.allocations.find((a) => a.inv.id === inv.id);
            if (alloc) assigned = r2(assigned + alloc.take);
        }
        for (const u of units) {
            if (assigned >= target - 0.005) break;
            if (u.remaining <= 0.005) continue;
            const take = r2(Math.min(u.remaining, target - assigned));
            u.allocations.push({ inv, take });
            u.remaining = r2(u.remaining - take);
            assigned = r2(assigned + take);
        }
        if (assigned < target - 0.005) {
            plan.deficits.push({ inv, assigned, deficit: r2(target - assigned) });
        }
    }

    for (const u of units) {
        if (u.allocations.length === 0) {
            // Órfão não consumido por nenhuma fatura — não fabricar encargo:
            // deixa como está e reporta.
            if (u.remaining > 0.005) plan.unassigned.push({ tx: u.tx, amount: u.remaining });
            continue;
        }
        const originalAmount = r2(Math.abs(parseFloat(u.tx.amount)));
        const first = u.allocations[0];
        if (r2(first.take) < originalAmount - 0.005) {
            // Reduz a tx original ao principal vinculado
            plan.splits.push({ tx: u.tx, newAmount: -first.take, invId: first.inv.id });
        } else {
            plan.links.push({ tx: u.tx, invId: first.inv.id });
        }
        for (const a of u.allocations.slice(1)) {
            plan.splits.push({
                tx: u.tx,
                newAmount: -a.take,
                invId: a.inv.id,
                create: true, // cria tx nova (rateio entre faturas)
                description: 'Pagamento fatura (rateio retroativo)',
            });
        }
        if (u.remaining > 0.005) {
            const totalAlocado = u.allocations.reduce((sum, a) => r2(sum + a.take), 0);
            plan.charges.push({ tx: u.tx, amount: u.remaining, totalAlocado });
        }
    }
    return plan;
}

// ── Modo --all: dry-run + aplicar ───────────────────────────────────────────

async function runAll(client) {
    console.log('===[ Passo 7 — --all: categoria C (faturas legadas com divergência) ]===');

    const invoices = await queryCategoryC(client);
    if (invoices.length === 0) {
        console.log('\nNenhuma fatura na categoria C — nada a fazer. ✅');
        return;
    }
    const cpfs = [...new Set(invoices.map((i) => i.cpf))];
    const orphans = await queryOrphanPool(client, cpfs);
    const cancelled = await queryCancelledOrphans(client, cpfs);

    console.log(`Faturas categoria C: ${invoices.length} | Órfãos ativos: ${orphans.length} | Cancelados (ignorados): ${cancelled.length}\n`);

    const byCpf = {};
    for (const i of invoices) (byCpf[i.cpf] ||= { invoices: [], orphans: [] });
    for (const i of invoices) byCpf[i.cpf].invoices.push(i);
    for (const o of orphans) if (byCpf[o.cpf]) byCpf[o.cpf].orphans.push(o);

    const allPlans = [];
    for (const [cpfKey, group] of Object.entries(byCpf)) {
        group.invoices.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        const plan = buildCpfPlan(group.invoices, group.orphans);
        allPlans.push({ cpf: cpfKey, plan });
    }

    // Déficits: divergência de valor_pago que NENHUM órfão cobre (sem transação).
    // Com --align-deficits o valor_pago é alinhado à soma derivável REAL — o SUM de
    // TODOS os pagamentos vinculados (invoice_id setado), incluindo os pré-005 já
    // vinculados no rateio anterior. O pool de órfãos é insuficiente aqui: uma tx já
    // vinculada (ex.: 1.155,43 da Beatriz) NÃO está no pool, então assigned=0, mas ela
    // cobre parte do valor_pago. A divergência real = valor_pago − SUM(vinculados).
    const alignDeficits = [];
    for (const { cpf: cpfKey, plan } of allPlans) {
        for (const d of plan.deficits) {
            const sumRes = await client.query(
                `SELECT COALESCE(SUM(ABS(CAST(amount AS DECIMAL(15,2)))), 0) AS s
                 FROM ${schema}.transactions
                 WHERE invoice_id = $1 AND type = 'INVOICE_PAYMENT'`,
                [d.inv.id]
            );
            const derivable = r2(parseFloat(sumRes.rows[0].s));
            const divergence = r2(r2(parseFloat(d.inv.valor_pago)) - derivable);
            alignDeficits.push({ cpf: cpfKey, inv: d.inv, derivable, divergence });
        }
    }

    // ── Relatório do plano ──
    let willLink = 0, willSplit = 0, willCharge = 0, residual = 0, unassignedCount = 0;
    console.log('── PLANO POR FATURA ──');
    for (const { cpf: cpfKey, plan } of allPlans) {
        console.log(`\n▸ CPF ${cpfKey}`);
        for (const l of plan.links) {
            willLink++;
            console.log(`   ✓ vínculo      tx ${l.tx.id.slice(0, 8)} (R$ ${r2(Math.abs(parseFloat(l.tx.amount))).toFixed(2)}) → invoice ${l.invId}`);
        }
        for (const s of plan.splits) {
            willSplit++;
            const kind = s.create ? 'rateio(nova tx)' : 'split(reduz tx)';
            console.log(`   ✂ ${kind}   tx ${s.tx.id.slice(0, 8)} → R$ ${r2(Math.abs(s.newAmount)).toFixed(2)} → invoice ${s.invId}`);
        }
        for (const c of plan.charges) {
            willCharge++;
            console.log(`   ₵ encargos     tx ${c.tx.id.slice(0, 8)} excedente R$ ${c.amount.toFixed(2)} → nova tx "Encargos de atraso" (sem invoice, pré-005)`);
        }
        for (const d of plan.deficits) {
            residual++;
            console.log(`   ⚠ DÉFICIT      invoice ${d.inv.id} (${d.inv.due_date}): órfãos cobrem R$ ${d.assigned.toFixed(2)} de R$ ${r2(parseFloat(d.inv.valor_pago)).toFixed(2)} — sobram R$ ${d.deficit.toFixed(2)} SEM transação. REQUER DECISÃO HUMANA — não será tocada.`);
        }
        for (const u of plan.unassigned) {
            unassignedCount++;
            console.log(`   ? não-consumido tx ${u.tx.id.slice(0, 8)} R$ ${u.amount.toFixed(2)} — sem fatura correspondente, deixado como está.`);
        }
    }
    console.log(`\n── RESUMO ──`);
    console.log(`Vínculos: ${willLink} | Splits/rateios: ${willSplit} | Novas txs de encargos: ${willCharge} | Déficits: ${residual} | Não-consumidos: ${unassignedCount}`);
    console.log(`Faturas da categoria C que serão ZERADAS: ${invoices.length - residual} de ${invoices.length}`);

    if (alignDeficits.length > 0) {
        console.log('\n── ALINHAMENTO DE DÉFICIT (--align-deficits) ──');
        for (const a of alignDeficits) {
            console.log(`   ↻ ${a.cpf} invoice ${a.inv.id}: valor_pago ${r2(parseFloat(a.inv.valor_pago)).toFixed(2)} → ${a.derivable.toFixed(2)} (SUM derivável; remove divergência de R$ ${a.divergence.toFixed(2)}). Requer DISABLE TRIGGER.`);
        }
        if (!ALIGN_DEFICITS) {
            console.log('   ℹ️  Adicione --align-deficits ao --confirm para executar (altera valor_pago da fatura FECHADA).');
        }
    }

    // ── Guarda anti-regressão (A1.1) ──
    // Padrão Wade/Alexander: tx de encargo criada com amount == valor original
    // da tx de pagamento, em vez do excedente (pagamento − principal). 99% do
    // valor original é o limite conservador para detectar o padrão.
    let repprovado = false;
    for (const { cpf: cpfKey, plan } of allPlans) {
        for (const c of plan.charges) {
            const originalAmount = r2(Math.abs(parseFloat(c.tx.amount)));
            if (originalAmount > 0 && c.amount >= 0.99 * originalAmount) {
                console.error(`\n❌ REPROVADO — tx ${c.tx.id.slice(0, 8)} do CPF ${cpfKey}: encargo R$ ${c.amount.toFixed(2)} >= 99% do valor original R$ ${originalAmount.toFixed(2)}.`);
                console.error(`   Padrão Wade/Alexander detectado. Excedente deveria ser (pagamento − principal).`);
                console.error(`   Corrija manualmente antes de rodar o rateio retroativo.`);
                repprovado = true;
            }
        }
    }
    if (repprovado) {
        console.error('\n⛔ Plano REPROVADO pela guarda anti-regressão. Nada foi alterado.');
        process.exit(2);
    }

    if (DRY_RUN) {
        console.log('\n── DRY-RUN: nenhuma alteração aplicada. Use --confirm para aplicar. ──');
        return;
    }

    if (!CONFIRM) return;
    console.log('\n--[ Aplicando em transação ]--');
    const before = await queryCategoryC(client);
    await client.query('BEGIN');
    try {
        for (const { cpf: cpfKey, plan } of allPlans) {
            for (const l of plan.links) {
                await client.query(
                    `UPDATE ${schema}.transactions SET invoice_id = $1 WHERE id = $2`,
                    [l.invId, l.tx.id]
                );
            }
            for (const s of plan.splits) {
                if (s.create) {
                    await client.query(
                        `INSERT INTO ${schema}.transactions
                            (id, cpf, type, amount, description, date, status, from_user, to_user, to_key, invoice_id)
                         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [cpfKey, s.tx.type, s.newAmount, s.description || s.tx.description,
                         s.tx.date, s.tx.status, s.tx.from_user, s.tx.to_user, s.tx.to_key, s.invId]
                    );
                } else {
                    await client.query(
                        `UPDATE ${schema}.transactions SET amount = $1, invoice_id = $2 WHERE id = $3`,
                        [s.newAmount, s.invId, s.tx.id]
                    );
                }
            }
            for (const c of plan.charges) {
                // Guarda anti-regressão (A1.2): revalida antes do INSERT — encargo
                // nunca pode ser maior que o excedente real (originalAmount - totalAlocado).
                const originalAmount = r2(Math.abs(parseFloat(c.tx.amount)));
                const totalAlocado = c.totalAlocado || 0;
                const maxAllowedCharge = r2(originalAmount - totalAlocado);
                if (c.amount > maxAllowedCharge + 0.005) {
                    throw new Error(`encargo ${c.amount} > excedente real maximo permitido ${maxAllowedCharge} (original ${originalAmount} - alocado ${totalAlocado}) na tx ${c.tx.id}`);
                }
                await client.query(
                    `INSERT INTO ${schema}.transactions
                        (id, cpf, type, amount, description, date, status, from_user, to_user, to_key, invoice_id)
                     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)`,
                    [cpfKey, c.tx.type, -c.amount, 'Encargos de atraso (rateio retroativo)',
                     c.tx.date, c.tx.status, c.tx.from_user, c.tx.to_user, c.tx.to_key]
                );
            }
        }
        await client.query('COMMIT');
        console.log('Transação commitada. Trigger de invoices NÃO foi tocada (nenhuma coluna monetária de invoice foi alterada no rateio).');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Erro no rateio, ROLLBACK aplicado. Nada foi alterado:', err.message);
        throw err;
    }

    // ── Alinhamento de déficits (--align-deficits): única mutação em invoices ──
    if (ALIGN_DEFICITS && alignDeficits.length > 0) {
        console.log(`\n--[ ALINHAR DÉFICITS (${alignDeficits.length}) — DISABLE TRIGGER ]--`);
        await client.query(`ALTER TABLE ${schema}.invoices DISABLE TRIGGER ${TRIGGER_NAME}`);
        triggerDisabled = true;
        try {
            await client.query('BEGIN');
            for (const a of alignDeficits) {
                // Soma derivável REAL (já inclui os vínculos do rateio acima)
                const sum = await client.query(
                    `SELECT COALESCE(SUM(ABS(CAST(amount AS DECIMAL(15,2)))), 0) AS s
                     FROM ${schema}.transactions
                     WHERE invoice_id = $1 AND type = 'INVOICE_PAYMENT'`,
                    [a.inv.id]
                );
                const derivable = r2(parseFloat(sum.rows[0].s));
                await client.query(
                    `UPDATE ${schema}.invoices SET valor_pago = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                    [derivable, a.inv.id]
                );
                console.log(`  ✅ ${a.cpf} invoice ${a.inv.id}: valor_pago ${r2(parseFloat(a.inv.valor_pago)).toFixed(2)} → ${derivable.toFixed(2)} (SUM derivável; data_pagamento preservada)`);
            }
            await client.query('COMMIT');
            console.log('Alinhamento commitado.');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('❌ Erro no alinhamento, ROLLBACK aplicado:', err.message);
            throw err;
        } finally {
            await client.query(`ALTER TABLE ${schema}.invoices ENABLE TRIGGER ${TRIGGER_NAME}`);
            triggerDisabled = false;
            console.log('--[ ENABLE TRIGGER ]--');
            console.log(`Trigger "${TRIGGER_NAME}" reabilitada.`);
        }
    } else if (alignDeficits.length > 0) {
        console.log(`\n⚠️ ${alignDeficits.length} déficit(s) NÃO alinhado(s) — rode com --align-deficits para zerar a categoria C.`);
    }

    // ── Verificação ──
    console.log('\n--[ Verificação pós-rateio ]--');
    const after = await queryCategoryC(client);
    const remaining = after.filter((i) => !invoices.some((x) => x.id === i.id) || true);
    console.log(`Categoria C ANTES: ${before.length} → DEPOIS: ${after.length}`);
    for (const i of after) {
        console.log(`   ⚠ ainda divergente: ${i.cpf} invoice ${i.id} (valor_pago ${i.valor_pago})`);
    }

    // Verificação pós-rateio: alertar se alguma tx órfã nova tiver amount == amount de uma tx vinculada do mesmo CPF
    const dupCheck = await client.query(`
        SELECT t1.cpf, t1.id AS id1, t2.id AS id2, t1.amount
        FROM ${schema}.transactions t1
        JOIN ${schema}.transactions t2 ON t1.cpf = t2.cpf
          AND t1.id <> t2.id
          AND ABS(CAST(t1.amount AS DECIMAL(15,2))) = ABS(CAST(t2.amount AS DECIMAL(15,2)))
        WHERE t1.invoice_id IS NULL AND t1.type = 'INVOICE_PAYMENT'
          AND t2.invoice_id IS NOT NULL AND t2.type = 'INVOICE_PAYMENT'
          AND (t1.status IS NULL OR t1.status <> 'cancelled')
          AND (t2.status IS NULL OR t2.status <> 'cancelled')
          AND t1.description IS DISTINCT FROM 'Encargos de atraso (rateio retroativo)'
    `);
    if (dupCheck.rows.length > 0) {
        console.log('\n⚠️ [guard] Alerta de duplicação pós-rateio detectado:');
        for (const r of dupCheck.rows) {
            console.log(`   CPF ${r.cpf}: tx órfã ${r.id1.slice(0, 8)} tem o mesmo valor (R$ ${Math.abs(parseFloat(r.amount)).toFixed(2)}) da tx vinculada ${r.id2.slice(0, 8)}`);
        }
    }

    const orphanLeft = await client.query(
        `SELECT COUNT(*)::int AS n FROM ${schema}.transactions
         WHERE invoice_id IS NULL AND type = 'INVOICE_PAYMENT' AND (status IS NULL OR status <> 'cancelled')`
    );
    console.log(`Órfãos ativos totais (inclui pré-005 legítimos pós-rateio): ${orphanLeft.rows[0].n}`);
    console.log(after.length === 0
        ? '\n✅ Categoria C ZERADA.'
        : `\n⚠️ Restam ${after.length} fatura(s) — veja os DÉFICIT acima (requerem decisão humana).`);
}

// ── Modo legado (CPF único) — comportamento original ────────────────────────

async function runLegacy(client) {
    console.log('===[ Passo 7 — Correção de pagamento órfão ]===');
    console.log(`CPF alvo: ${cpf}\n`);

    const beforeTx = await client.query(
        `SELECT id, type, amount, description, date, invoice_id, status
         FROM ${schema}.transactions
         WHERE cpf = $1 AND type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
           AND (invoice_id IS NULL)
         ORDER BY date ASC`,
        [cpf]
    );
    console.log(`Transações de pagamento órfãs encontradas: ${beforeTx.rows.length}`);
    for (const t of beforeTx.rows) {
        console.log(`  - ${t.id} | ${t.type} | ${t.amount} | ${t.description} | ${t.date}`);
    }
    if (beforeTx.rows.length === 0) {
        console.log('\nNenhum pagamento órfão — nada a corrigir. ✅');
        return;
    }

    const invoices = await client.query(
        `SELECT id, status, due_date, valor_total, valor_pago, data_pagamento
         FROM ${schema}.invoices
         WHERE cpf = $1 AND status = 'FECHADA'
         ORDER BY due_date DESC`,
        [cpf]
    );
    console.log(`\nFaturas FECHADA do CPF: ${invoices.rows.length}`);
    for (const i of invoices.rows) {
        console.log(`  - ${i.id} | venc ${i.due_date} | total ${i.valor_total} | pago ${i.valor_pago} | ${i.data_pagamento ? 'paga' : 'aberta'}`);
    }

    const pairs = [];
    for (const tx of beforeTx.rows) {
        const amt = Math.abs(parseFloat(tx.amount));
        const candidates = invoices.rows.filter(
            (i) => Math.abs(parseFloat(i.valor_total) - amt) < 0.01
        );
        if (candidates.length === 1) {
            pairs.push({ tx, inv: candidates[0] });
        } else if (candidates.length > 1) {
            const chosen = candidates[0];
            console.warn(`  ⚠️ ${candidates.length} faturas com valor_total = ${amt.toFixed(2)} para ${tx.id}; vinculando à mais recente (${chosen.id} — venc ${chosen.due_date}). Valide antes de confiar.`);
            pairs.push({ tx, inv: chosen });
        } else {
            console.warn(`  ⚠️ Sem invoice com valor_total = ${amt.toFixed(2)} para a transação ${tx.id} — pulando (não é seguro auto-vincular).`);
        }
    }
    if (pairs.length === 0) {
        console.log('\nNenhum par seguro encontrado. Nada foi alterado.');
        return;
    }

    console.log('\n--[ DISABLE TRIGGER ]--');
    await client.query(`ALTER TABLE ${schema}.invoices DISABLE TRIGGER ${TRIGGER_NAME}`);
    triggerDisabled = true;
    console.log(`Trigger "${TRIGGER_NAME}" desabilitada.`);

    try {
        await client.query('BEGIN');
        for (const { tx, inv } of pairs) {
            await client.query(
                `UPDATE ${schema}.transactions SET invoice_id = $1 WHERE id = $2`,
                [inv.id, tx.id]
            );
            console.log(`  ✅ transaction ${tx.id} → invoice_id = ${inv.id}`);

            const cur = invoices.rows.find((i) => i.id === inv.id);
            const hasPay = parseFloat(cur?.valor_pago || 0) > 0 || !!cur?.data_pagamento;
            if (!hasPay) {
                const amt = Math.abs(parseFloat(tx.amount));
                await client.query(
                    `UPDATE ${schema}.invoices
                     SET valor_pago = $1, data_pagamento = $2, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3`,
                    [r2(amt), tx.date, inv.id]
                );
                console.log(`  ✅ invoice ${inv.id}: valor_pago=${r2(amt).toFixed(2)} data_pagamento=${tx.date} (sincronizado da transação)`);
            } else {
                console.log(`  ℹ️  invoice ${inv.id} já marcada paga (valor_pago=${cur?.valor_pago}, data_pagamento=${cur?.data_pagamento}) — sem alteração.`);
            }
        }
        await client.query('COMMIT');
        console.log('Transação commitada.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Erro no reprocessamento, ROLLBACK aplicado:', err.message);
        throw err;
    } finally {
        await client.query(`ALTER TABLE ${schema}.invoices ENABLE TRIGGER ${TRIGGER_NAME}`);
        triggerDisabled = false;
        console.log('--[ ENABLE TRIGGER ]--');
        console.log(`Trigger "${TRIGGER_NAME}" reabilitada.`);
    }

    console.log('\n--[ Verificação pós-correção ]--');
    const afterTx = await client.query(
        `SELECT id, type, amount, invoice_id
         FROM ${schema}.transactions
         WHERE cpf = $1 AND type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
         ORDER BY date ASC`,
        [cpf]
    );
    let orphans = 0;
    for (const t of afterTx.rows) {
        const status = t.invoice_id ? 'vinculada ✅' : 'ÓRFÃ ❌';
        if (!t.invoice_id) orphans++;
        console.log(`  - ${t.id} | ${t.amount} | invoice_id=${t.invoice_id || 'NULL'} ${status}`);
    }

    const afterInv = await client.query(
        `SELECT id, valor_total, valor_pago, data_pagamento
         FROM ${schema}.invoices WHERE cpf = $1`,
        [cpf]
    );
    for (const i of afterInv.rows) {
        console.log(`  - invoice ${i.id} | total ${i.valor_total} | pago ${i.valor_pago} | ${i.data_pagamento ? 'paga' : 'aberta'}`);
    }

    const triggerCheck = await client.query(
        `SELECT tgname, tgenabled FROM pg_trigger
         WHERE tgname = $1 AND tgrelid = $2::regclass`,
        [TRIGGER_NAME, `${schema}.invoices`]
    );
    const enabled = triggerCheck.rows[0]?.tgenabled === 'O';
    console.log(`\nTrigger "${TRIGGER_NAME}" está ${enabled ? 'ATIVA (O) ✅' : 'DESATIVADA ❌'}`);
    console.log(orphans === 0
        ? '\n✅ Passo 7 concluído: 0 pagamentos órfãos restantes.'
        : `\n⚠️ Ainda restam ${orphans} pagamento(s) órfão(s).`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const client = await pool.connect();
    try {
        await client.query('SET statement_timeout = 60000');
        if (ALL_MODE) {
            await runAll(client);
        } else {
            await runLegacy(client);
        }
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
