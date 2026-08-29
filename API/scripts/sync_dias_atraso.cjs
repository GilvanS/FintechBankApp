#!/usr/bin/env node
/**
 * sync_dias_atraso.cjs
 *
 * Sincroniza os dias de atraso de TODA a base com a regra do motor
 * (runBillingValidation / syncInvoiceDiasAtraso em index.cjs):
 *   - Âncora por massa = fatura FECHADA não paga MAIS ANTIGA com DÍVIDA.
 *     Réplica exata do motor: fatura quitada (residual <= 0.005) é PULADA
 *     antes de ocupar o slot do CPF (continue antes do has()), então uma fatura
 *     fantasma (total 0) nunca mascara a fatura seguinte legítima em aberto.
 *   - Fonte de verdade da quitação = HÍBRIDA, igual ao motor: se a invoice tem
 *     vínculo (transactions.invoice_id, migration 005), o pago é a SOMA dos
 *     INVOICE_PAYMENT vinculados; sem vínculo, cai no valor_pago legado.
 *   - Sem dívida (residual = total - pagoEfetivo <= 0.005)  → dias 0, adimplente.
 *   - Pagamento mínimo (>= 10%, piso R$ 10)               → dias 0, adimplente
 *     (encargos continuam acumulando, mas o contador exibido fica 0).
 *   - Caso contrário                                      → dias = real-time
 *     (CURRENT_DATE - due_date), inadimplente, overdue_status via overdueStatusFor.
 *
 * Atualiza users (account_status, days_overdue, overdue_status) e
 * invoices.dias_atraso (todas as fechadas não pagas da base).
 *
 * Uso:
 *   node scripts/sync_dias_atraso.cjs            # dry-run
 *   node scripts/sync_dias_atraso.cjs --confirm  # aplica em transação
 */
require('dotenv').config();
const DatabaseFactory = require('../services/database/DatabaseFactory');
const { overdueStatusFor } = require('../repositories/usersRepo');
// Lógica pura compartilhada com o auditor (audit_helpers.cjs) — o auditor NÃO
// pode require este script direto (dispararia dotenv.config() sem path e, se
// rodado de outro CWD, carregaria um .env diferente). Re-exportamos aqui para
// o teste unitário continuar importando do mesmo lugar de sempre.
const { ANCHOR_SQL, pagoEfetivo, selectAnchors, expectedUserStateFor, buildCascadePago } = require('./audit_helpers.cjs');
const { planDistribution } = require('../utils/invoiceMath');

const CONFIRM = process.argv.includes('--confirm');
const fmtCpf = (c) => (c ? `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9)}` : c);

async function main() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    const fq = (t) => db.fq(t);

    // Pre-check: coluna overdue_status existe? (depende do add-mass-generator-schema)
    const schema = (fq('users').split('.')[0] || 'fintech').replace(/"/g, '');
    const col = await db.executeQuery(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '${schema}' AND table_name = 'users' AND column_name = 'overdue_status'
    `);
    if (!col.length) {
        console.error('❌ coluna overdue_status não encontrada — rode add-mass-generator-schema primeiro');
        await db.disconnect();
        process.exit(1);
    }

    console.log(CONFIRM ? '⚙️  Modo APLICAR (--confirm)' : '👁️  Modo DRY-RUN (use --confirm para aplicar)');

    // Âncora por massa: fatura FECHADA não paga mais antiga COM DÍVIDA
    const rows = await db.executeQuery(ANCHOR_SQL(fq));
    // CASCATA (mesma regra do motor): 1 transação única cobre as faturas da massa
    // da mais antiga para a mais nova — o pago por fatura é derivado do total do CPF.
    const cascadePago = buildCascadePago(rows);
    const anchors = selectAnchors(rows, cascadePago);
    const anchorsByCpf = new Map(anchors.map(a => [a.cpf, a]));

    // Plano por CPF ÚNICO nas rows (mesma cobertura do auditor nível A): massa
    // COM âncora segue a regra da âncora (mínimo → 0/adimplente, senão real-time);
    // massa SEM âncora (só faturas quitadas/fantasma) deve estar em 0/adimplente.
    // Antes o loop só iterava `anchors` — uma massa quitada mas com user legado
    // em atraso (ex.: 378.105.131-50 com user 35d após pagamento total) nunca
    // entrava no plano e o sync dizia "0 massas" enquanto o auditor reportava.
    const plan = [];
    const cpfRows = new Map();
    for (const r of rows || []) {
        if (!cpfRows.has(r.cpf)) cpfRows.set(r.cpf, r);
    }
    for (const [cpf, r] of cpfRows) {
        const anchor = anchorsByCpf.get(cpf) || null;
        const total = anchor ? parseFloat(anchor.valor_total || 0) : 0;
        const pago = anchor ? pagoEfetivo(anchor, cascadePago) : 0;
        const rt = anchor ? parseInt(anchor.real_time_days || 0) : 0;

        // Regra ÚNICA vinda do módulo puro (mesma do auditor): sem âncora →
        // 0/adimplente; com âncora, pagamento mínimo (>= 10% ou R$ 10) →
        // 0/adimplente; senão real-time.
        const exp = expectedUserStateFor(anchor, cascadePago);
        const expUserDays = exp.days;
        const expStatus = exp.status;
        const expOv = overdueStatusFor(expStatus, expUserDays);

        const curUserDays = parseInt(r.days_overdue || 0);
        const curStatus = r.account_status || 'adimplente';
        const curOv = r.overdue_status || null;

        if (curUserDays !== expUserDays || curStatus !== expStatus || curOv !== expOv) {
            plan.push({
                cpf,
                nome: null, // preenchido abaixo
                motivo: anchor ? (exp.pagMinimo ? 'pagamento mínimo' : 'real-time') : 'sem dívida',
                cur: `${curStatus}/${curUserDays}/${curOv}`,
                novo: `${expStatus}/${expUserDays}/${expOv}`,
                rt,
                total,
                pago,
            });
        }
    }

    // Nomes para o relatório
    if (plan.length) {
        const cpfs = plan.map(p => p.cpf);
        const users = await db.executeQuery(`
            SELECT cpf, full_name FROM ${fq('users')} WHERE cpf IN (${cpfs.map(c => `'${c}'`).join(',')})
        `);
        const nameByCpf = new Map(users.map(u => [u.cpf, u.full_name]));
        for (const p of plan) p.nome = nameByCpf.get(p.cpf) || '—';
    }

    console.log(`\n=== MASSAS A CORRIGIR (${plan.length}) ===\n`);
    if (!plan.length) {
        console.log('✅ Nenhuma massa com dias dessincronizados (user/status/overdue_status).');
    }
    for (const p of plan) {
        console.log(`  ${fmtCpf(p.cpf)} | ${(p.nome || '').padEnd(24)} | ${p.motivo.padEnd(26)} | ${p.cur} → ${p.novo} | realTime=${p.rt}d total=${p.total}`);
    }

    // ——— Plano de invoices (independente do plano de users) ———
    // Mesma regra do motor/auditor: fatura SEM DÍVIDA (residual <= 0.005 pela
    // cascata) ou com pagamento mínimo (>= 10% ou R$ 10) → dias 0; senão
    // real-time do vencimento. A quitação é derivada das transações (cascata
    // planDistribution), nunca de invoices.valor_pago (fechada imutável na
    // pós-migration-005). Este plano roda MESMO quando o plano de users está
    // vazio — uma massa com user consistente mas invoices com dias_atraso
    // antigos (ex.: 982.158.285-07, paga por tx única) precisa ter as faturas
    // zeradas (o auditor nível B reporta o diff).
    const cascadeZeroIds = [];
    const cascadeValorPagoById = new Map();
    for (const [cpf, rs] of (() => {
        const m = new Map();
        for (const r of rows) {
            if (!m.has(r.cpf)) m.set(r.cpf, []);
            m.get(r.cpf).push(r);
        }
        return m;
    })()) {
        const total = parseFloat(rs[0]?.pago_total_cpf || 0);
        if (total <= 0.005) continue;
        // planDistribution espera o shape da linha `invoices` (id), mas
        // ANCHOR_SQL aliaseia como invoice_id — sem o rename, inv.id vira
        // undefined e nenhuma fatura é zerada (mesmo bug do auditor antes).
        const shape = rs.map(r => ({
            ...r,
            id: r.invoice_id,
            valor_total: parseFloat(r.valor_total || 0),
            valor_pago: parseFloat(r.valor_pago || 0),
        }));
        const dist = planDistribution(shape, total);
        for (const inv of dist.invoices) {
            const pago = inv.newValorPago || 0;
            const valorTotal = parseFloat(inv.target || inv.valor_total || 0);
            cascadeValorPagoById.set(inv.id, pago);
            if (pago >= Math.max(valorTotal * 0.10, 10) - 0.01) cascadeZeroIds.push(inv.id);
        }
    }
    // Zera dias de faturas SEM DÍVIDA (residual <= 0.005 pela cascata) ou com
    // pagamento mínimo (>= 10% ou R$ 10) — mesma regra do motor/auditor.
    const zeroInvoiceIds = new Set(cascadeZeroIds);
    for (const r of rows || []) {
        const total = parseFloat(r.valor_total || 0);
        const pago = cascadeValorPagoById.get(r.invoice_id) ?? parseFloat(r.valor_pago || 0);
        if (Math.max(0, total - pago) <= 0.005) zeroInvoiceIds.add(r.invoice_id);
    }
    const invoicePlan = {
        zero: zeroInvoiceIds.size,
        realtime: rows.filter(r => !zeroInvoiceIds.has(r.invoice_id)
            && parseInt(r.invoice_dias_atraso || 0) !== parseInt(r.real_time_days || 0)).length,
    };

    if (!CONFIRM) {
        console.log(`\n(dry-run — ${plan.length} massa(s) seriam corrigida(s) no user;`);
        console.log(`  invoices: ${invoicePlan.zero} zerada(s), ${invoicePlan.realtime} para real-time. Rode com --confirm para aplicar.)`);
        await db.disconnect();
        process.exit((plan.length || invoicePlan.zero || invoicePlan.realtime) ? 2 : 0);
    }

    // ── Aplicar em transação ──
    console.log('\n⚙️  Aplicando em transação...');
    await db.executeQuery('BEGIN');
    try {
        for (const p of plan) {
            const [st, days, ov] = p.novo.split('/');
            await db.executeQuery(`
                UPDATE ${fq('users')}
                SET account_status = '${st}', days_overdue = ${days}, overdue_status = '${ov}', updated_at = CURRENT_TIMESTAMP
                WHERE cpf = '${p.cpf}'
            `);
        }
        // Invoices: TODA a base (idempotente — só grava quando difere). O plano
        // (cascadeZeroIds / zeroInvoiceIds) já foi montado acima, ANTES do gate
        // de confirmação, para que a correção rode mesmo com plano de users vazio.
        const invRes = { rowCount: 0 };
        if (zeroInvoiceIds.size) {
            const res = await db.executeQuery(`
                UPDATE ${fq('invoices')}
                SET dias_atraso = 0, updated_at = CURRENT_TIMESTAMP
                WHERE status = 'FECHADA' AND data_pagamento IS NULL
                  AND id IN (${[...zeroInvoiceIds].map(id => `'${id}'`).join(',')})
                  AND dias_atraso != 0
            `);
            invRes.rowCount = res.rowCount ?? res.length ?? 0;
        }
        // Demais invoices com dívida real: real-time individual do vencimento
        // (só as que a cascata NÃO zerou acima).
        if ([...zeroInvoiceIds].length) {
            const idsSql = [...zeroInvoiceIds].map(id => `'${id}'`).join(',');
            const res = await db.executeQuery(`
                UPDATE ${fq('invoices')}
                SET dias_atraso = GREATEST(0, (CURRENT_DATE - due_date::date)),
                    updated_at = CURRENT_TIMESTAMP
                WHERE status = 'FECHADA' AND data_pagamento IS NULL
                  AND due_date < CURRENT_TIMESTAMP
                  AND id NOT IN (${idsSql})
                  AND dias_atraso IS DISTINCT FROM GREATEST(0, (CURRENT_DATE - due_date::date))
            `);
            invRes.rowCount += res.rowCount ?? res.length ?? 0;
        }
        // ── Backfill de encargos diários faltantes (billing_charges) ──
        // O motor insere 1 incremento/dia (apenas o dia corrente): se uma massa teve
        // a série interrompida (carga retroativa, recompute parcial), os dias
        // intermediários nunca seriam preenchidos — o dia exibido diria 31 mas as
        // charges parariam no 27. Preenche os dias faltantes com as MESMAS fórmulas
        // do motor (multa/IOF adicional sobre o valor_total ORIGINAL no dia 1;
        // incrementos diários sobre o residual; invoice_amount = residual).
        const { calcJurosMora, calcJurosRemuneratorios, calcIofDiario, calcMulta, calcIof } = require('../utils/invoiceMath');
        const backfilled = await backfillChargeGaps(db, fq, { calcJurosMora, calcJurosRemuneratorios, calcIofDiario, calcMulta, calcIof }, anchorsByCpf, cascadePago);
        console.log(`✅ Backfill de encargos diários: ${backfilled} linha(s) inserida(s).`);

        await db.executeQuery('COMMIT');
        console.log(`✅ ${plan.length} massa(s) corrigida(s) e commitada(s).`);
        if (invRes && invRes.rowCount !== undefined) {
            console.log(`✅ invoices.dias_atraso corrigidas na base toda (${invRes.rowCount} linha(s)).`);
        }

        // Verificação pós-sync (mesma lógica, deve dar 0)
        const rows2 = await db.executeQuery(ANCHOR_SQL(fq));
        const cascadePago2 = buildCascadePago(rows2);
        const anchors2 = selectAnchors(rows2, cascadePago2);
        let pendentes = 0;
        for (const r of anchors2) {
            const exp = expectedUserStateFor(r, cascadePago2);
            if (parseInt(r.days_overdue || 0) !== exp.days || (r.account_status || 'adimplente') !== exp.status) pendentes++;
        }
        console.log(`🔍 Verificação pós-sync: ${pendentes} massa(s) pendente(s) (esperado 0).`);
    } catch (e) {
        await db.executeQuery('ROLLBACK');
        console.error('❌ Erro — ROLLBACK aplicado:', e.message);
        process.exit(1);
    } finally {
        await db.disconnect();
    }
}

/**
 * Preenche dias faltantes nas charges diárias pendentes (juros_mora,
 * juros_remuneratorios, iof diário) para massas com fatura fechada não paga,
 * usando a âncora (fatura mais antiga COM DÍVIDA) e a mesma ref estável do motor.
 *
 * Modelo das massas: dias 1..FROZEN são congelados nas colunas monetárias da
 * fatura (display) e as charges pending começam onde a multa entrou. Logo o
 * backfill NÃO toca os dias já cobertos — preenche apenas o GAP entre o último
 * dia de pending existente e o real-time (ex.: série parou no 27, hoje é 31 →
 * insere 28,29,30,31). Massa sem pending nenhuma recebe a série completa a
 * partir do dia 1 (multa + IOF adicional no dia 1 sobre o valor_total ORIGINAL,
 * como o motor; incrementos diários sobre o residual; invoice_amount = residual).
 * Idempotente: só insere (cpf, ref, charge_type, days_overdue) inexistentes.
 */
async function backfillChargeGaps(db, fq, math, anchorsByCpf, cascadePago) {
    let inserted = 0;
    for (const a of anchorsByCpf.values()) {
        const total = parseFloat(a.valor_total || 0);
        const pago = pagoEfetivo(a, cascadePago);
        const residual = Math.max(0, total - pago);
        const rt = parseInt(a.real_time_days || 0);
        if (residual <= 0.005 || rt < 1) continue;

        // due_date pode chegar como Date (pg) ou string — normaliza antes de
        // extrair ano/mês da ref estável.
        const due = a.due_date instanceof Date ? a.due_date : new Date(a.due_date);
        const ref = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;

        const exist = await db.executeQuery(`
            SELECT charge_type, MAX(days_overdue) AS max_d, COUNT(*) AS n
            FROM ${fq('billing_charges')}
            WHERE cpf = '${a.cpf}' AND status = 'pending'
            GROUP BY charge_type
        `);
        const maxByType = new Map(exist.map(r => [r.charge_type, { maxD: parseInt(r.max_d || 0), n: parseInt(r.n || 0) }]));

        const insertCharge = async (type, amount, day, invoiceAmount) => {
            if (amount <= 0.005) return false;
            // Sufixo aleatório evita colisão de PK entre execuções no mesmo ms
            const idBase = `${a.cpf}_${ref}_${Date.now()}_${day}_${type}_${Math.random().toString(36).slice(2, 6)}`;
            try {
                await db.executeQuery(`
                    INSERT INTO ${fq('billing_charges')}
                    (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                    VALUES ('${idBase}', '${a.cpf}', '${ref}', '${type}', ${amount}, ${day}, ${invoiceAmount})
                `);
                return true;
            } catch (e) {
                if (e && (e.code === '23505' || /duplicate key/i.test(e.message || ''))) return false;
                throw e;
            }
        };

        if (exist.length === 0) {
            // Massa sem pending nenhuma: série completa a partir do dia 1.
            // Dia 1: multa + IOF adicional sobre o valor_total ORIGINAL (mesma
            // regra do motor — calcMulta(originalValorTotal), calcIof(originalValorTotal, days)).
            // Dias seguintes: incrementos diários sobre o residual. A coluna
            // invoice_amount é SEMPRE o residual (mesma convenção do motor:
            // insertCharge usa invoiceAmount = closedInvoiceData.amount = residual).
            for (let d = 1; d <= rt; d++) {
                const base = d === 1 ? total : residual;
                const isDia1 = d === 1;
                const rows = [
                    ...(isDia1 ? [['multa', math.calcMulta(base), residual]] : []),
                    ['juros_mora', math.calcJurosMora(residual, 1), residual],
                    ['juros_remuneratorios', math.calcJurosRemuneratorios(residual, 1), residual],
                    ...(isDia1
                        ? [['iof', math.calcIof(base, 1), residual]]
                        : [['iof', math.calcIofDiario(residual, 1), residual]]),
                ];
                for (const [type, amount, invAmt] of rows) {
                    if (await insertCharge(type, amount, d, invAmt)) inserted++;
                }
            }
            continue;
        }

        // Massa com pending: preenche apenas o gap entre maxDia e real-time
        // (incrementos diários sobre o residual; multa/IOF adicional já entraram
        // quando a série começou e não podem ser re-inseridos).
        for (const type of ['juros_mora', 'juros_remuneratorios', 'iof']) {
            const info = maxByType.get(type);
            const from = info ? info.maxD + 1 : 1;
            for (let d = from; d <= rt; d++) {
                const amount = type === 'iof'
                    ? math.calcIofDiario(residual, 1)
                    : (type === 'juros_mora'
                        ? math.calcJurosMora(residual, 1)
                        : math.calcJurosRemuneratorios(residual, 1));
                if (await insertCharge(type, amount, d, residual)) inserted++;
            }
        }
    }
    return inserted;
}

// Exporta as funções puras para teste unitário SEM disparar main() (que conecta
// no banco). No CLI, main() roda normalmente via require.main === module.
// As funções vêm do audit_helpers.cjs — re-exportadas para o teste manter o
// mesmo caminho de import de sempre.
module.exports = { selectAnchors, pagoEfetivo, ANCHOR_SQL };

if (require.main === module) {
    main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
}
