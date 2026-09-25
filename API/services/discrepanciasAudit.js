/**
 * discrepanciasAudit.js — "Corrigir Discrepâncias" do painel Admin (Scripts & Massas)
 * e do CLI scripts/audit_completo.js (fonte única dos dois).
 *
 * Roda DENTRO da API (igual ao "Recalcular Limite Disponível"). dryRun=true SIMULA:
 * mesma conta, nenhuma escrita — o painel mostra o antes × depois de cada correção
 * e só aplica quando o admin confirma. Com CPF, TUDO fica restrito a ele.
 *
 * Fatura FECHADA é imutável (trigger invoices_immutability, REGRAS-NEGOCIO-FATURA
 * §23): nada aqui escreve nela. O pagamento de fatura fechada vive nas transações
 * vinculadas por transactions.invoice_id — invoices.valor_pago fica 0 de propósito.
 */
const crypto = require('crypto');
const { esc: escPadrao } = require('../repositories/context');

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => parseFloat(v || 0);
const brl = (v) => `R$ ${v.toFixed(2)}`;

// Marca na descrição do REFUND de devolução: torna a correção idempotente (a próxima
// rodada desconta o que já foi devolvido) sem vincular por invoice_id — um REFUND
// com invoice_id poderia ser contado como pagamento da fatura.
const marcaDevolucao = (invoiceId) => `[excedente-fatura:${invoiceId}]`;

// Bruto da fatura: compras do ciclo + saldo anterior + encargos consolidados.
// Mesma definição de utils/invoiceMath.js (computeInvoiceGross).
const GROSS_SQL = `(COALESCE(i.valor_total,0) + COALESCE(i.saldo_anterior,0)
                  + COALESCE(i.valor_iof,0) + COALESCE(i.valor_multa,0)
                  + COALESCE(i.valor_juros_remuneratorios,0) + COALESCE(i.valor_juros_mora,0))`;

/**
 * Pagamento a mais em fatura FECHADA — FONTE ÚNICA (também usada pela Anomalia 8c
 * do services/dailyAudit.js).
 *
 * pago     = Σ |INVOICE_PAYMENT + INVOICE_ANTICIPATION| vinculados (invoice_id), não cancelados
 * devido   = valor_total + saldo_anterior + encargos (billing_charges da fatura)
 * excedente = pago − devido − já devolvido (REFUND com a marca desta fatura)
 *
 * O saldo_anterior entra no devido: sem ele, quem quitou compras + saldo herdado
 * (ex.: massa 805, 364,97 + 3.870,86) aparecia com "excedente" do saldo herdado.
 */
async function listarExcedentesFaturaFechada(db, { cpf = null, esc = escPadrao } = {}) {
    const fq = (t) => db.fq(t);
    const rows = await db.executeQuery(`
        SELECT i.id, i.cpf, u.full_name, u.balance, i.valor_total, i.saldo_anterior, pg.pago,
            (SELECT COALESCE(SUM(b.amount), 0) FROM ${fq('billing_charges')} b
              WHERE b.cpf = i.cpf AND b.invoice_amount = i.valor_total) AS encargos,
            (SELECT COALESCE(SUM(ABS(r.amount)), 0) FROM ${fq('transactions')} r
              WHERE r.cpf = i.cpf AND r.type = 'REFUND'
                AND r.description LIKE '%[excedente-fatura:' || i.id || ']%') AS devolvido
        FROM ${fq('invoices')} i
        JOIN ${fq('users')} u ON u.cpf = i.cpf
        JOIN (
            SELECT invoice_id, SUM(ABS(amount)) AS pago
            FROM ${fq('transactions')}
            WHERE type IN ('INVOICE_PAYMENT', 'INVOICE_ANTICIPATION')
              AND invoice_id IS NOT NULL
              AND (status IS NULL OR status <> 'cancelled')
            GROUP BY invoice_id
        ) pg ON pg.invoice_id = i.id
        WHERE i.status = 'FECHADA' ${cpf ? `AND i.cpf = ${esc(cpf)}` : ''}
        ORDER BY i.cpf, i.due_date
    `);
    return rows.map((r) => {
        const principal = round2(num(r.valor_total) + num(r.saldo_anterior));
        const encargos = round2(num(r.encargos));
        const devido = round2(principal + encargos);
        const pago = round2(num(r.pago));
        const devolvido = round2(num(r.devolvido));
        return {
            invoiceId: r.id, cpf: r.cpf, fullName: r.full_name || null, balance: num(r.balance),
            principal, encargos, devido, pago, devolvido,
            excedente: round2(pago - devido - devolvido),
        };
    });
}

// ── Auditoria 1: pago a mais em fatura FECHADA → devolve ao saldo da conta ──
// A fatura fechada não muda; o excedente volta ao saldo como lançamento REFUND
// (aparece no extrato e NÃO entra na fatura aberta — a query do cartão não lê REFUND).
async function auditarPagamentoExcedente(ctx, rel) {
    const { db, esc, fq, dryRun, cpf } = ctx;
    const faturas = await listarExcedentesFaturaFechada(db, { cpf, esc });
    const saldoCorrente = new Map(); // mesma massa com 2+ faturas: encadeia antes → depois

    for (const f of faturas) {
        const status = f.excedente > 0.02 ? 'discrepancy' : (f.devolvido > 0 ? 'resolvido' : 'ok');
        rel.duplaCobranca.push({ cpf: f.cpf, fullName: f.fullName, invoiceId: f.invoiceId, status, totalPagamentos: f.pago, devido: f.devido, devolvido: f.devolvido });
        if (status === 'resolvido') rel.resolvidas++;
        if (status !== 'discrepancy') continue;

        rel.anomalias++;
        const antes = saldoCorrente.has(f.cpf) ? saldoCorrente.get(f.cpf) : f.balance;
        const depois = round2(antes + f.excedente);
        try {
            if (!dryRun) {
                const descricao = `Devolução de pagamento excedente — fatura fechada ${f.invoiceId} ${marcaDevolucao(f.invoiceId)}`;
                await db.executeQuery(`UPDATE ${fq('users')} SET balance = balance + ${f.excedente.toFixed(2)}, updated_at = CURRENT_TIMESTAMP WHERE cpf = ${esc(f.cpf)}`);
                await db.executeQuery(`
                    INSERT INTO ${fq('transactions')} (id, cpf, type, amount, description, date)
                    VALUES (${esc(crypto.randomUUID())}, ${esc(f.cpf)}, 'REFUND', ${f.excedente.toFixed(2)}, ${esc(descricao)}, ${esc(new Date().toISOString())})
                `);
            }
            saldoCorrente.set(f.cpf, depois);
            rel.correcoes.push({
                tipo: 'DUPLA_COBRANCA', cpf: f.cpf, fullName: f.fullName, invoiceId: f.invoiceId,
                alvo: 'Saldo da conta', campo: 'balance', antes, depois,
                motivo: `Massa já cortada: a fatura FECHADA ${f.invoiceId} (imutável) recebeu ${brl(f.pago)} para ${brl(f.devido)} devidos`
                    + `${f.devolvido > 0 ? ` (${brl(f.devolvido)} já devolvidos)` : ''} — excedente de ${brl(f.excedente)} volta ao saldo da conta como lançamento.`,
            });
        } catch (err) {
            rel.erros.push({ cpf: f.cpf, etapa: 'DUPLA_COBRANCA', erro: err.message });
        }
    }

    // Legado: pagamentos de antes do vínculo invoice_id. Só informativo (sem fatura
    // não há o que comparar) — agregado para não poluir a lista.
    const [orf] = await db.executeQuery(`
        SELECT COUNT(*) AS transacoes, COUNT(DISTINCT cpf) AS massas, COALESCE(SUM(ABS(amount)), 0) AS valor
        FROM ${fq('transactions')}
        WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NULL
          AND (status IS NULL OR status <> 'cancelled') ${ctx.cpfClause('cpf')}
    `);
    rel.pagamentosSemFatura = { transacoes: Number(orf?.transacoes || 0), massas: Number(orf?.massas || 0), valor: round2(num(orf?.valor)) };
    return faturas.length;
}

// ── Auditoria 2: pagamento excessivo (fatura não fechada), saldo negativo, limite negativo ──
async function corrigirPagamentoExcessivo(ctx, rel) {
    const { db, esc, fq, dryRun, cpfClause } = ctx;
    // FECHADA fica de fora: é imutável e o pago a mais dela é a Auditoria 1.
    const rows = await db.executeQuery(`
        SELECT i.cpf, u.full_name, i.id, i.valor_pago, ${GROSS_SQL} AS gross
        FROM ${fq('invoices')} i LEFT JOIN ${fq('users')} u ON i.cpf = u.cpf
        WHERE i.status <> 'FECHADA' AND i.valor_pago IS NOT NULL AND i.valor_total IS NOT NULL
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

// Só detecção: saldo abaixo do mínimo de fatura FECHADA em aberto.
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
        db, esc, fq, dryRun, cpf, recalcularLimiteDisponivel,
        cpfClause: (col) => (cpf ? `AND ${col} = ${esc(cpf)}` : ''),
    };
    const rel = {
        anomalias: 0, resolvidas: 0, correcoes: [], pulados: [], alertas: [], erros: [], duplaCobranca: [],
        pagamentosSemFatura: { transacoes: 0, massas: 0, valor: 0 },
    };

    const verificadas = duplaCobranca ? await auditarPagamentoExcedente(ctx, rel) : 0;

    if (auditoria2) {
        await corrigirPagamentoExcessivo(ctx, rel);
        await corrigirSaldoNegativo(ctx, rel);
        await corrigirLimiteNegativo(ctx, rel);
        await coletarAlertasDeSaldo(ctx, rel);
    }

    return {
        modo: dryRun ? 'SIMULACAO' : 'APLICADO',
        cpfFiltro: cpf || 'TODAS',
        // Faturas FECHADAS com pagamento vinculado checadas na Auditoria 1.
        verificadas,
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
        pagamentosSemFatura: rel.pagamentosSemFatura,
        // Status por fatura da Auditoria 1 (o painel não usa; o CLI monta o JSON legado com ele).
        duplaCobranca: rel.duplaCobranca,
    };
}

module.exports = { runDiscrepanciasAudit, listarExcedentesFaturaFechada };
