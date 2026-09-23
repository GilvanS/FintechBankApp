/**
 * discrepanciasAudit.js — "Corrigir Discrepâncias" do painel Admin (Scripts & Massas).
 *
 * Mesma detecção/correção de scripts/audit_completo.js --fix, só que rodando DENTRO
 * da API (igual ao "Recalcular Limite Disponível"): o script filho imprimia o log
 * inteiro antes do JSON (o parse falhava e o painel recebia um blob de texto) e,
 * na base toda, passava do timeout de 30s do proxy do DESKTOP.
 *
 * dryRun=true SIMULA: mesma conta, nenhum UPDATE — o painel mostra o antes × depois
 * de cada correção e só aplica quando o admin confirma.
 *
 * Diferença proposital em relação ao script: com CPF informado, as correções da
 * Auditoria 2 (pagamento excessivo, saldo negativo, limite negativo) também ficam
 * restritas a esse CPF — no script elas rodavam na base inteira mesmo com --cpf.
 */
const { esc: escPadrao } = require('../repositories/context');

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => parseFloat(v || 0);
const brl = (v) => `R$ ${v.toFixed(2)}`;
const CONCORRENCIA = 5;

// Bruto da fatura: compras do ciclo + saldo anterior + encargos consolidados.
// Mesma definição de utils/invoiceMath.js (computeInvoiceGross) e do audit_completo.js.
const GROSS_SQL = `(COALESCE(i.valor_total,0) + COALESCE(i.saldo_anterior,0)
                  + COALESCE(i.valor_iof,0) + COALESCE(i.valor_multa,0)
                  + COALESCE(i.valor_juros_remuneratorios,0) + COALESCE(i.valor_juros_mora,0))`;

async function emParalelo(itens, limite, fn) {
    let proximo = 0;
    const worker = async () => {
        while (proximo < itens.length) await fn(itens[proximo++]);
    };
    await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker));
}

// ── Auditoria 1: dupla cobrança (INVOICE_PAYMENT × invoices.valor_pago) ──
async function auditarDuplaCobranca(ctx, user, rel) {
    const { db, esc, fq, dryRun } = ctx;
    const cpf = user.cpf;
    const fullName = user.full_name || null;

    const pagamentos = await db.executeQuery(`
        SELECT amount FROM ${fq('transactions')}
        WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT'
            AND (status IS NULL OR status <> 'cancelled')
    `);
    const faturas = await db.executeQuery(`
        SELECT id, valor_total, valor_pago, data_pagamento
        FROM ${fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND COALESCE(valor_pago, 0) > 0
        ORDER BY due_date DESC
    `);
    if (pagamentos.length === 0 && faturas.length === 0) return;

    const totalPagamentos = pagamentos.reduce((s, r) => s + Math.abs(num(r.amount)), 0);
    const totalValorPago = faturas.reduce((s, r) => s + num(r.valor_pago), 0);
    // Status por massa no mesmo vocabulário do audit_completo.js (o audit_scheduler.js
    // conta as ativas por status === 'discrepancy').
    const detalhe = { cpf, fullName, status: 'ok', totalPagamentos: round2(totalPagamentos), totalValorPago: round2(totalValorPago) };
    rel.duplaCobranca.push(detalhe);
    if (round2(Math.abs(totalPagamentos - totalValorPago)) <= 0.02) return;
    detalhe.status = pagamentos.length > 0 && faturas.length === 0 ? 'orphan_payments' : 'discrepancy';

    if (totalValorPago > totalPagamentos + 0.02) {
        // Resíduo de correção anterior: toda fatura com valor_pago já tem data de
        // pagamento e não passa do valor_total — não é discrepância ativa.
        const jaCorrigida = faturas.every((f) => {
            const vp = num(f.valor_pago);
            return vp <= 0 || (f.data_pagamento && vp <= num(f.valor_total) + 0.02);
        });
        if (jaCorrigida) { detalhe.status = 'resolvido'; rel.resolvidas++; return; }

        rel.anomalias++;
        const excesso = round2(totalValorPago - totalPagamentos);
        const pct = totalPagamentos > 0 ? (excesso / totalPagamentos) * 100 : 100;
        if (pct > 50 && totalPagamentos > 0) {
            rel.pulados.push({ tipo: 'DUPLA_COBRANCA', cpf, fullName, motivo: `Faturas registram ${brl(excesso)} (${pct.toFixed(1)}%) a mais que os pagamentos — acima de 50%, exige análise manual.` });
            return;
        }
        const fat = faturas[0];
        const antes = num(fat.valor_pago);
        const depois = Math.max(0, round2(antes - excesso));
        if (!dryRun) {
            await db.executeQuery(`UPDATE ${fq('invoices')} SET valor_pago = ${depois.toFixed(2)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${esc(fat.id)}`);
        }
        rel.correcoes.push({ tipo: 'DUPLA_COBRANCA', cpf, fullName, invoiceId: fat.id, alvo: `Fatura ${fat.id}`, campo: 'valor_pago', antes, depois, motivo: `Faturas registram ${brl(excesso)} a mais que os pagamentos (INVOICE_PAYMENT).` });
        return;
    }

    rel.anomalias++;
    const faltante = round2(totalPagamentos - totalValorPago);
    const [fat] = await db.executeQuery(`
        SELECT id, valor_pago FROM ${fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
        ORDER BY due_date DESC LIMIT 1
    `);
    if (!fat) {
        rel.pulados.push({ tipo: 'DUPLA_COBRANCA', cpf, fullName, motivo: `Pagamentos excedem valor_pago em ${brl(faltante)}, mas não há fatura FECHADA em aberto para receber a diferença.` });
        return;
    }
    const antes = num(fat.valor_pago);
    const depois = round2(antes + faltante);
    if (!dryRun) {
        await db.executeQuery(`UPDATE ${fq('invoices')} SET valor_pago = ${depois.toFixed(2)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${esc(fat.id)}`);
    }
    rel.correcoes.push({ tipo: 'DUPLA_COBRANCA', cpf, fullName, invoiceId: fat.id, alvo: `Fatura ${fat.id}`, campo: 'valor_pago', antes, depois, motivo: `Pagamentos (INVOICE_PAYMENT) excedem o valor_pago das faturas em ${brl(faltante)}.` });
}

// ── Auditoria 2: pagamento excessivo, saldo negativo, limite negativo ──
async function corrigirPagamentoExcessivo(ctx, rel) {
    const { db, esc, fq, dryRun, cpfClause } = ctx;
    const rows = await db.executeQuery(`
        SELECT i.cpf, u.full_name, i.id, i.valor_pago, ${GROSS_SQL} AS gross
        FROM ${fq('invoices')} i LEFT JOIN ${fq('users')} u ON i.cpf = u.cpf
        WHERE i.valor_pago IS NOT NULL AND i.valor_total IS NOT NULL
          AND i.valor_pago > ${GROSS_SQL} + 0.02 ${cpfClause('i.cpf')}
    `);
    for (const inv of rows) {
        const antes = num(inv.valor_pago);
        const depois = round2(num(inv.gross));
        const excesso = round2(antes - depois);
        if (excesso <= 0.02) continue;
        rel.anomalias++;
        try {
            if (!dryRun) {
                // Teto é o bruto: o que passou disso é excedente de verdade e volta ao saldo.
                await db.executeQuery(`UPDATE ${fq('invoices')} SET valor_pago = ${depois.toFixed(2)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${esc(inv.id)}`);
                await db.executeQuery(`UPDATE ${fq('users')} SET balance = balance + ${excesso.toFixed(2)}, updated_at = CURRENT_TIMESTAMP WHERE cpf = ${esc(inv.cpf)}`);
            }
            rel.correcoes.push({ tipo: 'PAGAMENTO_EXCESSIVO', cpf: inv.cpf, fullName: inv.full_name || null, invoiceId: inv.id, alvo: `Fatura ${inv.id}`, campo: 'valor_pago', antes, depois, motivo: `Pago acima do bruto da fatura — excesso de ${brl(excesso)} volta ao saldo.` });
        } catch (err) {
            rel.erros.push({ cpf: inv.cpf, etapa: 'PAGAMENTO_EXCESSIVO', erro: err.message });
        }
    }
}

async function corrigirSaldoNegativo(ctx, rel) {
    const { db, esc, fq, dryRun, cpfClause } = ctx;
    const rows = await db.executeQuery(`
        SELECT cpf, full_name, balance FROM ${fq('users')}
        WHERE balance IS NOT NULL AND balance < 0 ${cpfClause('cpf')}
    `);
    for (const u of rows) {
        rel.anomalias++;
        try {
            if (!dryRun) {
                await db.executeQuery(`UPDATE ${fq('users')} SET balance = 0, updated_at = CURRENT_TIMESTAMP WHERE cpf = ${esc(u.cpf)}`);
            }
            rel.correcoes.push({ tipo: 'SALDO_NEGATIVO', cpf: u.cpf, fullName: u.full_name || null, alvo: 'Saldo da conta', campo: 'balance', antes: num(u.balance), depois: 0, motivo: 'Saldo negativo zerado.' });
        } catch (err) {
            rel.erros.push({ cpf: u.cpf, etapa: 'SALDO_NEGATIVO', erro: err.message });
        }
    }
}

// Recalcula com a fórmula canônica (limite_total − fatura aberta) em vez de zerar.
// Continuar negativo é válido: a dívida real passou do limite total.
async function corrigirLimiteNegativo(ctx, rel) {
    const { db, fq, dryRun, cpfClause, recalcularLimiteDisponivel } = ctx;
    const rows = await db.executeQuery(`
        SELECT cpf, full_name FROM ${fq('users')}
        WHERE credit_card_available_limit IS NOT NULL AND credit_card_available_limit < 0 ${cpfClause('cpf')}
    `);
    for (const u of rows) {
        try {
            const r = await recalcularLimiteDisponivel(u.cpf, { persist: !dryRun });
            if (!r) throw new Error('Massa não encontrada ao recalcular o limite.');
            if (r.alterado) {
                rel.anomalias++;
                rel.correcoes.push({ tipo: 'LIMITE_NEGATIVO', cpf: u.cpf, fullName: r.fullName || u.full_name || null, alvo: 'Limite disponível', campo: 'credit_card_available_limit', antes: r.limiteAnterior, depois: r.limiteNovo, estourado: r.estourado, motivo: 'Recalculado pela fórmula canônica (limite total − fatura aberta).' });
            } else if (r.estourado) {
                rel.alertas.push({ tipo: 'LIMITE_ESTOURADO', cpf: u.cpf, fullName: r.fullName || u.full_name || null, saldo: r.limiteNovo, divida: r.currentInvoiceTotal, motivo: 'Limite negativo já correto — dívida real acima do limite total.' });
            }
        } catch (err) {
            rel.erros.push({ cpf: u.cpf, etapa: 'LIMITE_NEGATIVO', erro: err.message });
        }
    }
}

// Só detecção (o script também não corrige): saldo abaixo do mínimo de fatura FECHADA em aberto.
async function coletarAlertasDeSaldo(ctx, rel) {
    const { db, fq, cpfClause } = ctx;
    const rows = await db.executeQuery(`
        SELECT u.cpf, u.full_name, u.balance,
               (COALESCE(i.valor_total,0) - COALESCE(i.valor_pago,0)) AS divida
        FROM ${fq('users')} u INNER JOIN ${fq('invoices')} i ON u.cpf = i.cpf
        WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL
          AND COALESCE(i.valor_pago,0) < COALESCE(i.valor_total,0)
          AND u.balance IS NOT NULL
          AND u.balance < (COALESCE(i.valor_total,0) - COALESCE(i.valor_pago,0)) * 0.10 ${cpfClause('u.cpf')}
        ORDER BY divida DESC
    `);
    const vistos = new Set();
    for (const u of rows) {
        if (vistos.has(u.cpf)) continue;
        vistos.add(u.cpf);
        const saldo = num(u.balance);
        rel.alertas.push({
            tipo: saldo <= 0 ? 'SALDO_ZERADO_COM_DIVIDA' : 'SALDO_INSUFICIENTE',
            cpf: u.cpf, fullName: u.full_name || null, saldo, divida: round2(num(u.divida)),
            motivo: 'Saldo abaixo do pagamento mínimo (10%) da fatura fechada em aberto.',
        });
    }
}

/**
 * @param {object} opts
 * @param {object} opts.db  dbService (executeQuery, fq)
 * @param {string|null} opts.cpf  11 dígitos, ou null para todas as massas
 * @param {boolean} opts.dryRun  true = só simula
 * @param {Function} opts.recalcularLimiteDisponivel  fonte única do index.cjs
 * @param {boolean} [opts.duplaCobranca=true]  false pula a Auditoria 1 (CLI --skip-double-count)
 * @param {boolean} [opts.auditoria2=true]  false pula a Auditoria 2 (CLI --skip-negative)
 */
async function runDiscrepanciasAudit({
    db, cpf = null, dryRun = false, recalcularLimiteDisponivel, esc = escPadrao,
    duplaCobranca = true, auditoria2 = true,
}) {
    const fq = (t) => db.fq(t);
    const ctx = {
        db, esc, fq, dryRun, recalcularLimiteDisponivel,
        cpfClause: (col) => (cpf ? `AND ${col} = ${esc(cpf)}` : ''),
    };
    const rel = { anomalias: 0, resolvidas: 0, correcoes: [], pulados: [], alertas: [], erros: [], duplaCobranca: [] };

    let comPagamento = [];
    if (duplaCobranca) {
        comPagamento = await db.executeQuery(`
            SELECT DISTINCT t.cpf, u.full_name
            FROM ${fq('transactions')} t LEFT JOIN ${fq('users')} u ON t.cpf = u.cpf
            WHERE t.type = 'INVOICE_PAYMENT' ${ctx.cpfClause('t.cpf')}
        `);
        await emParalelo(comPagamento, CONCORRENCIA, async (u) => {
            try {
                await auditarDuplaCobranca(ctx, u, rel);
            } catch (err) {
                rel.duplaCobranca.push({ cpf: u.cpf, fullName: u.full_name || null, status: 'error' });
                rel.erros.push({ cpf: u.cpf, etapa: 'DUPLA_COBRANCA', erro: err.message });
            }
        });
    }

    if (auditoria2) {
        // Mesma ordem do script: o estorno do pagamento excessivo credita o saldo antes
        // da checagem de saldo negativo.
        await corrigirPagamentoExcessivo(ctx, rel);
        await corrigirSaldoNegativo(ctx, rel);
        await corrigirLimiteNegativo(ctx, rel);
        await coletarAlertasDeSaldo(ctx, rel);
    }

    return {
        modo: dryRun ? 'SIMULACAO' : 'APLICADO',
        cpfFiltro: cpf || 'TODAS',
        verificadas: comPagamento.length,
        anomalias: rel.anomalias,
        resolvidasAntes: rel.resolvidas,
        totalCorrecoes: rel.correcoes.length,
        totalPulados: rel.pulados.length,
        totalAlertas: rel.alertas.length,
        totalErros: rel.erros.length,
        correcoes: rel.correcoes,
        pulados: rel.pulados,
        alertas: rel.alertas,
        erros: rel.erros,
        // Status por massa da Auditoria 1 (o painel não usa; o CLI monta o JSON legado com ele).
        duplaCobranca: rel.duplaCobranca,
    };
}

module.exports = { runDiscrepanciasAudit };
