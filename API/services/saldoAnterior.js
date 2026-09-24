/**
 * saldoAnterior.js — quanto da fatura FECHADA anterior ainda está em aberto no momento
 * em que a próxima fecha (coluna invoices.saldo_anterior). FONTE ÚNICA: usada no
 * fechamento (invoiceEngine) e na auditoria (dailyAudit, SALDO_ANTERIOR_DIVERGENTE).
 *
 * Regra de quitação = a do enrichUserCreditCardData: os INVOICE_PAYMENT vinculados
 * (transactions.invoice_id) somados por CPF e distribuídos em cascata, da fechada mais
 * antiga para a mais nova (planDistribution). invoices.valor_pago/data_pagamento NÃO
 * servem: desde a trava de imutabilidade a FECHADA nunca os recebe — o filtro antigo
 * (data_pagamento IS NULL) tratava toda fechada como não paga e herdava o valor cheio
 * (CT03.1, 2026-09-23: R$ 3.870,86 já pagos às 18:25 herdados no fechamento das 21:35).
 *
 * O que entra na cascata é o PRINCIPAL pago (sqlPrincipalPorPagamento: |amount| − os
 * encargos que a transação quitou). O pagamento abate ENCARGOS PRIMEIRO; somar o
 * |amount| cheio contaria a multa/juros/IOF pagos como principal e a próxima fatura
 * herdaria um saldo menor que o devido. Os encargos que sobram continuam 'pending' e
 * são herdados por eles mesmos (congelados na próxima fechada e cobrados na aberta),
 * por isso o saldo anterior segue sendo só o principal residual. Pagamento antigo, sem
 * charge com payment_id, sai com o valor cheio (comportamento de antes).
 */
const { esc: escPadrao } = require('../repositories/context');
const { planDistribution, round2 } = require('../utils/invoiceMath');
const { sqlPrincipalPorPagamento, garantirColunasQuitacao } = require('./encargosPagamento');

/**
 * Total AINDA EM ABERTO de todas as `fechadas` (ordenadas por vencimento, mais antiga
 * primeiro), dado o total pago vinculado do CPF. Saldo anterior é ACUMULADO (tudo que
 * ficou para trás), como o gerador de massa grava (ex.: 3 fechadas de 584,97 sem
 * pagamento → a 4ª herda 1.754,91).
 */
function residualEmAberto(fechadas, totalPago) {
    if (!fechadas.length) return 0;
    const pagoPorId = new Map();
    if (totalPago > 0.005) {
        for (const d of planDistribution(fechadas, totalPago).invoices) pagoPorId.set(d.id, d.newValorPago);
    }
    return round2(fechadas.reduce((s, f) => {
        const pago = pagoPorId.has(f.id) ? pagoPorId.get(f.id) : parseFloat(f.valor_pago || 0);
        return s + Math.max(0, parseFloat(f.valor_total || 0) - pago);
    }, 0));
}

/**
 * Quando a fatura FECHOU de fato. Fechamento do motor (no prazo ou recuperado depois,
 * como o CT03.1 às 21:35) grava created_at até poucos dias após o vencimento — vale o
 * created_at. Histórico gerado de uma vez pelo gerador de massa tem created_at = data
 * da geração (meses depois): aí o fechamento é o corte, ~10 dias antes do vencimento.
 */
const DIA = 86400000;
function fechadaPeloMotor(inv) {
    return new Date(inv.created_at).getTime() <= new Date(inv.due_date).getTime() + 5 * DIA;
}
function momentoDoFechamento(inv) {
    return fechadaPeloMotor(inv) ? new Date(inv.created_at).getTime() : new Date(inv.due_date).getTime() - 10 * DIA;
}

/** Saldo anterior para a fatura que está fechando AGORA (fechamento do invoiceEngine). */
async function calcularSaldoAnterior(db, cpf, esc = escPadrao) {
    const fechadas = await db.executeQuery(`
        SELECT id, due_date, valor_total, COALESCE(valor_pago, 0) AS valor_pago
        FROM ${db.fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND status = 'FECHADA'
        ORDER BY due_date ASC
    `);
    if (!fechadas.length) return 0;
    await garantirColunasQuitacao(db);
    const [pg] = await db.executeQuery(`
        SELECT COALESCE(SUM(pp.principal), 0) AS pago
        FROM (${sqlPrincipalPorPagamento(db, esc(cpf))}) pp
    `);
    return residualEmAberto(fechadas, parseFloat((pg && pg.pago) || 0));
}

// Diferença mínima para acusar divergência (arredondamento de centavos no fechamento).
const TOLERANCIA_DIVERGENCIA = 0.02;

/**
 * Auditoria (Anomalia 8d, SALDO_ANTERIOR_DIVERGENTE): faturas FECHADAS cujo
 * saldo_anterior gravado NÃO bate com o residual que as fechadas anteriores tinham no
 * instante em que esta fechou (pagamentos com data anterior ao fechamento). Pagamento
 * feito DEPOIS do fechamento não conta — o saldo herdado estava certo naquele momento.
 *   - direcao 'A_MAIS':  herdou valor que já estava pago (fechamento antigo, que olhava
 *     data_pagamento; ou encargo pago contado como principal).
 *   - direcao 'A_MENOS': deixou de herdar principal que continuava devendo (ex.: parcial
 *     que só cobriu encargos lido como abatimento de principal).
 * O esperado é SÓ o principal residual: os encargos são herdados pelo caminho próprio
 * (pending → congelados na nova fechada), e somá-los aqui os contaria duas vezes.
 */
async function listarSaldoAnteriorDivergente(db, { cpf = null, esc = escPadrao } = {}) {
    // Só CPFs com 2+ fechadas: a 1ª não tem de quem herdar. Sem o filtro antigo
    // (saldo_anterior > 0) — a herança A MENOS aparece justamente com saldo_anterior 0.
    const cpfsComHeranca = `SELECT cpf FROM ${db.fq('invoices')} WHERE status = 'FECHADA'
        ${cpf ? `AND cpf = ${esc(cpf)}` : ''} GROUP BY cpf HAVING COUNT(*) >= 2`;
    const fechadas = await db.executeQuery(`
        SELECT i.id, i.cpf, u.full_name, i.due_date, i.created_at, i.valor_total,
               COALESCE(i.valor_pago, 0) AS valor_pago, COALESCE(i.saldo_anterior, 0) AS saldo_anterior
        FROM ${db.fq('invoices')} i
        JOIN ${db.fq('users')} u ON u.cpf = i.cpf
        WHERE i.status = 'FECHADA' AND i.cpf IN (${cpfsComHeranca})
        ORDER BY i.cpf, i.due_date ASC
    `);
    if (!fechadas.length) return [];
    // Principal de cada pagamento (encargos primeiro — ver o cabeçalho): com o |amount|
    // cheio, um parcial que quitou encargos faria o "devido" sair menor que o real e o
    // saldo herdado CORRETO seria acusado.
    await garantirColunasQuitacao(db);
    const pagamentos = await db.executeQuery(`
        SELECT pp.cpf, pp.date, pp.principal AS valor
        FROM (${sqlPrincipalPorPagamento(db, cpf ? esc(cpf) : undefined)}) pp
        WHERE pp.cpf IN (${cpfsComHeranca})
    `);

    const porCpf = new Map();
    for (const f of fechadas) (porCpf.get(f.cpf) || porCpf.set(f.cpf, []).get(f.cpf)).push(f);
    const pagosPorCpf = new Map();
    for (const p of pagamentos) (pagosPorCpf.get(p.cpf) || pagosPorCpf.set(p.cpf, []).get(p.cpf)).push(p);

    const divergentes = [];
    for (const [cpfAtual, lista] of porCpf) {
        for (let i = 1; i < lista.length; i++) {
            const inv = lista[i];
            // Só fechamentos do MOTOR (regressão do invoiceEngine). Histórico gerado de uma
            // vez pelo gerador antigo paga encargos junto com o principal, e a cascata de
            // quitação (só principal) não sabe separar — comparar ali dá falso positivo.
            if (!fechadaPeloMotor(inv)) continue;
            const gravado = round2(parseFloat(inv.saldo_anterior || 0));
            const fechouEm = momentoDoFechamento(inv);
            const pagoAteFechar = (pagosPorCpf.get(cpfAtual) || [])
                .filter((p) => new Date(p.date).getTime() < fechouEm)
                .reduce((s, p) => s + parseFloat(p.valor || 0), 0);
            const devido = residualEmAberto(lista.slice(0, i), pagoAteFechar);
            if (Math.abs(gravado - devido) <= TOLERANCIA_DIVERGENCIA) continue;
            divergentes.push({
                invoiceId: inv.id, cpf: cpfAtual, fullName: inv.full_name || null,
                dueDate: inv.due_date, fechadaEm: inv.created_at,
                direcao: gravado > devido ? 'A_MAIS' : 'A_MENOS',
                saldoAnteriorGravado: gravado, saldoAnteriorCorreto: devido,
                diferenca: round2(Math.abs(gravado - devido)), valorTotal: round2(parseFloat(inv.valor_total || 0)),
            });
        }
    }
    return divergentes;
}

/** Só a direção A_MAIS (nome e contrato de antes da 8d virar bidirecional). */
async function listarSaldoAnteriorIndevido(db, opts = {}) {
    return (await listarSaldoAnteriorDivergente(db, opts)).filter((d) => d.direcao === 'A_MAIS');
}

module.exports = {
    calcularSaldoAnterior, listarSaldoAnteriorDivergente, listarSaldoAnteriorIndevido,
    residualEmAberto, fechadaPeloMotor, momentoDoFechamento,
};
