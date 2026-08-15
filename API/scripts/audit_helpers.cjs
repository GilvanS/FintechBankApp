#!/usr/bin/env node
/**
 * audit_helpers.cjs
 *
 * Lógica PURA compartilhada entre sync_dias_atraso.cjs e
 * run_audit_consistency_report.js — e, por réplica, com o motor
 * (runBillingValidation / syncInvoiceDiasAtraso em index.cjs).
 *
 * IMPORTANTE: este módulo NÃO tem side effects — não chama dotenv, não conecta
 * no banco, não lê process.argv. Ele pode ser require() de qualquer CWD sem
 * risco de carregar um .env diferente (o problema do require direto do sync,
 * que disparava dotenv.config() sem path). Toda dependência entra por
 * parâmetro (fq para a SQL) ou por argumento (rows para selectAnchors).
 *
 * Regras replicadas (fonte de verdade = motor):
 *   - Âncora por massa = fatura FECHADA não paga MAIS ANTIGA com DÍVIDA.
 *     Fatura quitada (residual <= 0.005) é PULADA antes de ocupar o slot do
 *     CPF (continue antes do has()) — uma fantasma (total 0) nunca mascara a
 *     fatura seguinte legítima em aberto.
 *   - Pago HÍBRIDO: se a invoice tem vínculo (transactions.invoice_id,
 *     migration 005), o pago é a SOMA dos INVOICE_PAYMENT vinculados; sem
 *     vínculo, cai no valor_pago legado.
 *   - Sem dívida (residual <= 0.005) ou pagamento mínimo (>= 10%, piso R$ 10)
 *     → dias 0 / adimplente. Caso contrário → real-time (CURRENT_DATE -
 *     due_date), inadimplente se >= 1 dia.
 */

// Mesma query de âncoras usada pelo motor (closedInvoiceRows): fatura FECHADA
// não paga, LEFT JOIN com a soma dos INVOICE_PAYMENT vinculados por invoice_id
// E com o TOTAL de INVOICE_PAYMENT do CPF (pago_total_cpf) — base da CASCATA:
// um pagamento é UMA transação com o valor total (igual ao comprovante), e a
// quitação de cada fatura é derivada distribuindo o total do CPF da mais antiga
// para a mais nova (planDistribution), não por invoice_id isolado.
// O LEFT JOIN com users traz o estado atual do usuário para comparar e montar
// o plano de correção. `extra` permite filtrar (ex.: --cpf no auditor).
const ANCHOR_SQL = (fq, extra) => `
    SELECT i.cpf, u.full_name, i.id AS invoice_id, i.due_date,
           COALESCE(i.dias_atraso, 0) AS invoice_dias_atraso,
           COALESCE(i.valor_total, 0) AS valor_total,
           COALESCE(i.valor_pago, 0) AS valor_pago,
           COALESCE(pagos.total, 0) AS pago_vinculado,
           CASE WHEN pagos.total IS NULL THEN 0 ELSE 1 END AS tem_vinculo,
           COALESCE(pagos_cpf.total, 0) AS pago_total_cpf,
           GREATEST(0, (CURRENT_DATE - i.due_date::date)) AS real_time_days,
           COALESCE(u.account_status, 'adimplente') AS account_status,
           COALESCE(u.days_overdue, 0) AS days_overdue,
           u.overdue_status
    FROM ${fq('invoices')} i
    LEFT JOIN (
        SELECT invoice_id, SUM(ABS(CAST(amount AS DECIMAL(15,2)))) AS total
        FROM ${fq('transactions')}
        WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
        GROUP BY invoice_id
    ) pagos ON pagos.invoice_id = i.id
    LEFT JOIN (
        SELECT cpf, SUM(ABS(CAST(amount AS DECIMAL(15,2)))) AS total
        FROM ${fq('transactions')}
        WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
        GROUP BY cpf
    ) pagos_cpf ON pagos_cpf.cpf = i.cpf
    LEFT JOIN ${fq('users')} u ON u.cpf = i.cpf
    WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL
      AND i.due_date < CURRENT_TIMESTAMP
      ${extra || ''}
    ORDER BY i.cpf, i.due_date ASC
`;

// CASCATA pura (réplica do motor via planDistribution): distribui o TOTAL de
// INVOICE_PAYMENT de cada CPF entre suas faturas fechadas não pagas, da mais
// antiga para a mais nova. Retorna Map<invoice_id, pagoCascata>. Se o CPF não
// tem vínculo (pré-005), não distribui — o fallback híbrido abaixo assume.
// Requer as linhas de ANCHOR_SQL agrupáveis por cpf e ordenadas por due_date ASC.
const planDistribution = require('../utils/invoiceMath').planDistribution;

const buildCascadePago = (rows) => {
    const map = new Map();
    const byCpf = new Map();
    for (const r of rows || []) {
        if (!byCpf.has(r.cpf)) byCpf.set(r.cpf, []);
        byCpf.get(r.cpf).push(r);
    }
    for (const [cpf, rs] of byCpf) {
        const total = parseFloat(rs[0]?.pago_total_cpf || 0);
        if (total <= 0.005) continue;
        // planDistribution espera o shape da linha `invoices` (id, valor_total,
        // valor_pago, saldo_anterior, encargos), mas ANCHOR_SQL aliaseia o id como
        // `invoice_id`. Sem o rename, inv.id vira undefined e a cascata não distribui
        // (mapa vazio -> auditor via faturas pagas como devidas).
        const shape = rs.map(r => ({
            ...r,
            id: r.invoice_id,
            valor_total: parseFloat(r.valor_total || 0),
            valor_pago: parseFloat(r.valor_pago || 0),
        }));
        const dist = planDistribution(shape, total);
        for (const inv of dist.invoices) map.set(inv.id, inv.newValorPago);
    }
    return map;
};

// Réplica do pago do motor: CASCATA tem precedência (1 tx cobre as faturas da
// massa); sem cascata, híbrido legado — vínculo por invoice_id; sem vínculo,
// cai no valor_pago legado (pré-migration 005).
const pagoEfetivo = (r, cascadeMap) => {
    if (cascadeMap && cascadeMap.has(r.invoice_id)) return cascadeMap.get(r.invoice_id);
    return parseInt(r.tem_vinculo, 10) === 1
        ? parseFloat(r.pago_vinculado || 0)
        : parseFloat(r.valor_pago || 0);
};

// Escolhe a âncora por CPF replicando o loop do motor: `continue` para fatura
// quitada ANTES do has(), garantindo que a mais antiga COM DÍVIDA ganhe o slot.
function selectAnchors(rows, cascadeMap) {
    const anchors = [];
    const seen = new Set();
    for (const r of rows) {
        const total = parseFloat(r.valor_total || 0);
        const pago = pagoEfetivo(r, cascadeMap);
        const residual = Math.max(0, total - pago);
        if (residual <= 0.005) continue;
        if (seen.has(r.cpf)) continue;
        seen.add(r.cpf);
        anchors.push(r);
    }
    return anchors;
}

// Dias e status ESPERADOS do usuário a partir da âncora da massa — lógica
// ÚNICA compartilhada entre o nível A do auditor (HTML), a seção CSV e o plano
// do sync, para que nenhum deles divirja (o CSV já divergiu do HTML uma vez por
// duplicação crua; se a regra mudar, muda aqui e todos seguem).
// Âncora com pagamento mínimo (>= 10% ou R$ 10) → dias 0 e adimplente; senão →
// real-time da âncora (inadimplente se >= 1 dia). Sem âncora (só faturas
// fantasma/quitadas) → 0/adimplente.
const expectedUserStateFor = (anchor, cascadeMap) => {
    if (!anchor) return { days: 0, status: 'adimplente', flag: 'sem dívida', pagMinimo: false };
    const total = parseFloat(anchor.valor_total || 0);
    const pago = pagoEfetivo(anchor, cascadeMap);
    const pagMinimo = pago >= Math.max(total * 0.10, 10) - 0.01;
    const rt = parseInt(anchor.real_time_days || 0);
    return {
        days: pagMinimo ? 0 : rt,
        status: pagMinimo ? 'adimplente' : (rt >= 1 ? 'inadimplente' : 'adimplente'),
        flag: pagMinimo ? 'pagamento mínimo' : 'real-time',
        pagMinimo,
    };
};

// Dias ESPERADOS de uma invoice individual (nível B do auditor) — lógica ÚNICA
// compartilhada entre a checagem de invoices do auditor, a seção CSV e o sync
// (UPDATE de invoices). Mesma regra do motor: sem dívida (residual <= 0.005)
// ou pagamento mínimo (>= 10%, piso R$ 10) → dias 0; senão → real-time do
// vencimento da própria fatura. Retorna também os flags para o relatório.
const invoiceExpectedStateFor = (r, cascadeMap) => {
    const total = parseFloat(r.valor_total || 0);
    const pago = pagoEfetivo(r, cascadeMap);
    const residual = Math.max(0, total - pago);
    const semDivida = residual <= 0.005;
    const pagMinimo = !semDivida && pago >= Math.max(total * 0.10, 10) - 0.01;
    const days = (semDivida || pagMinimo) ? 0 : parseInt(r.real_time_days || 0);
    return { days, semDivida, pagMinimo };
};

module.exports = { ANCHOR_SQL, pagoEfetivo, selectAnchors, expectedUserStateFor, invoiceExpectedStateFor, buildCascadePago };
