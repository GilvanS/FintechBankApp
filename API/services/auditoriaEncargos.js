/**
 * auditoriaEncargos.js — detecção (só leitura) de encargo fora da regra de 2026-09-23:
 *   - o pagamento TOTAL encerra o débito: encargo NÃO pode continuar contando depois
 *     dele enquanto não houver fatura vencida em aberto (Anomalia 8e,
 *     ENCARGO_APOS_QUITACAO_TOTAL);
 *   - pagamento parcial/mínimo/abaixo do mínimo NÃO para os encargos: o residual segue
 *     gerando juros/IOF do vencimento até a quitação total (Anomalia 8f,
 *     RESIDUAL_PARCIAL_SEM_ENCARGO).
 *
 * Mesma derivação de quitação do fechamento e da tela: cascata do PRINCIPAL pago
 * (sqlPrincipalPorPagamento — encargos primeiro), da fechada mais antiga para a mais
 * nova (residualEmAberto). O fim do débito é a transação DESCRICAO_PAGAMENTO_TOTAL.
 *
 * Só pagamento AO VIVO dispara as checagens: data do pagamento >= criação da fatura a
 * que ele está vinculado. O gerador de massa grava o histórico de uma vez, com
 * pagamentos retroativos e valor_pago preenchido nas fechadas, e a cascata não sabe
 * separar isso (mesmo motivo de a 8d só olhar fechamento do motor). Esses pagamentos
 * continuam entrando na cascata; só não servem de gatilho.
 *
 * Nada aqui escreve: a FECHADA é imutável e a cura (cancelar encargo indevido, voltar a
 * cobrar o residual) é decisão de quem trata o alerta, pelos serviços existentes.
 */
const { esc: escPadrao } = require('../repositories/context');
const { round2, TOLERANCIA_QUITACAO } = require('../utils/invoiceMath');
const { residualEmAberto } = require('./saldoAnterior');
const {
    sqlPrincipalPorPagamento, garantirColunasQuitacao, DESCRICAO_PAGAMENTO_TOTAL, separarIof,
} = require('./encargosPagamento');

const DIA = 86400000;
const ms = (v) => new Date(v).getTime();
const verdadeiro = (v) => v === true || v === 't' || v === 'true' || v === 1;
const agrupar = (rows) => {
    const m = new Map();
    for (const r of rows || []) (m.get(r.cpf) || m.set(r.cpf, []).get(r.cpf)).push(r);
    return m;
};

/**
 * Fechadas, pagamentos (principal), quitações TOTAL e encargos, por CPF.
 * `somenteLeitura`: não chama garantirColunasQuitacao (ALTER TABLE) — a simulação da
 * cura não pode escrever nada; sem as colunas paid_at/payment_id a leitura falha.
 */
async function carregarDebitos(db, { cpf, esc, somenteLeitura = false }) {
    const filtro = (col) => (cpf ? `AND ${col} = ${esc(cpf)}` : '');
    if (!somenteLeitura) await garantirColunasQuitacao(db);
    const fechadas = await db.executeQuery(`
        SELECT id, cpf, due_date, valor_total, COALESCE(valor_pago, 0) AS valor_pago
        FROM ${db.fq('invoices')}
        WHERE status = 'FECHADA' ${filtro('cpf')}
        ORDER BY cpf, due_date ASC
    `);
    // ao_vivo compara no banco (mesmo tipo de coluna dos dois lados).
    const pagamentos = await db.executeQuery(`
        SELECT pp.cpf, pp.date, pp.principal, t.description,
               CASE WHEN inv.created_at IS NOT NULL AND pp.date >= inv.created_at THEN 1 ELSE 0 END AS ao_vivo
        FROM (${sqlPrincipalPorPagamento(db, cpf ? esc(cpf) : undefined)}) pp
        JOIN ${db.fq('transactions')} t ON t.id = pp.id
        LEFT JOIN ${db.fq('invoices')} inv ON inv.id = pp.invoice_id
    `);
    const encargos = await db.executeQuery(`
        SELECT cpf, id, charge_type, amount, status, created_at, days_overdue, invoice_amount, invoice_id
        FROM ${db.fq('billing_charges')}
        WHERE created_at IS NOT NULL ${filtro('cpf')}
    `);
    const usuarios = await db.executeQuery(`
        SELECT cpf, full_name, COALESCE(is_blacklisted, false) AS is_blacklisted
        FROM ${db.fq('users')}
        WHERE role IS DISTINCT FROM 'admin' ${filtro('cpf')}
    `);
    const pags = (pagamentos || []).map((p) => ({
        ...p, quando: ms(p.date), aoVivo: Number(p.ao_vivo) === 1,
        total: p.description === DESCRICAO_PAGAMENTO_TOTAL,
    }));
    return {
        fechadas: agrupar(fechadas),
        pagamentos: agrupar(pags),
        encargos: agrupar(encargos),
        usuarios: new Map((usuarios || []).map((u) => [u.cpf, u])),
    };
}

/** Principal vencido e ainda em aberto no instante `t` (cascata dos pagamentos até `t`). */
function residualVencidoEm(fechadas, pagamentos, t) {
    const vencidas = (fechadas || []).filter((f) => ms(f.due_date) < t);
    if (!vencidas.length) return 0;
    const pago = (pagamentos || [])
        .filter((p) => ms(p.date) < t)
        .reduce((s, p) => s + parseFloat(p.principal || 0), 0);
    return residualEmAberto(vencidas, pago);
}

const somaValores = (rows) => round2(rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0));

/**
 * Multa DUPLA: a mesma fatura já tinha multa (paga ou pending) criada antes desta. A
 * multa é cobrança única por débito; a 2ª é indevida mesmo quando o débito é anterior
 * ao TOTAL (a Anomalia 8b recriava a multa sobre a que o gerador/rota já tinham lançado).
 */
function ehMultaDupla(c, fatura, encargosDoCpf, fechadas) {
    if (c.charge_type !== 'multa' || !fatura) return false;
    return encargosDoCpf.some((o) => o.id !== c.id && o.charge_type === 'multa'
        && parseFloat(o.amount || 0) > TOLERANCIA_QUITACAO
        && ms(o.created_at) < ms(c.created_at)
        && (faturaDoEncargo(o, fechadas) || {}).id === fatura.id);
}

/**
 * Fatura a que o encargo se refere: pelo invoice_id; no legado (sem invoice_id), a
 * fechada de valor_total = invoice_amount que venceu por último antes da criação dele.
 */
function faturaDoEncargo(c, fechadas) {
    if (c.invoice_id) return fechadas.find((f) => f.id === c.invoice_id) || null;
    const base = round2(parseFloat(c.invoice_amount || 0));
    const candidatas = fechadas.filter((f) => round2(parseFloat(f.valor_total || 0)) === base);
    const vencidas = candidatas.filter((f) => ms(f.due_date) <= ms(c.created_at));
    return (vencidas.length ? vencidas[vencidas.length - 1] : candidatas[0]) || null;
}

/** Multa ou linha de IOF com a parte fixa (adicional 0,38%): cobrança única por atraso. */
const encargoUnico = (c) => c.charge_type === 'multa'
    || (c.charge_type === 'iof' && separarIof(c).fixo > TOLERANCIA_QUITACAO);

/**
 * O encargo criado depois do TOTAL conta um período DEPOIS dele? Período = vencimento
 * da fatura + days_overdue do encargo. Se não conta (período até o TOTAL), é débito
 * anterior ao TOTAL recriado com created_at novo (ex.: Anomalia 8b antes do filtro de
 * residual) — cobrança indevida também, mas não é "encargo que continuou contando".
 * Multa/IOF adicional não têm período: acusa quando o TOTAL saiu até o vencimento (não
 * houve atraso para cobrar). Sem fatura identificável não acusa (não dá para provar).
 * @returns {{fatura: object|null, totalNoPrazo: boolean, acusa: boolean}}
 */
function classificarEncargoAposTotal(c, fechadas, totalEm) {
    const fatura = faturaDoEncargo(c, fechadas);
    if (!fatura) return { fatura: null, totalNoPrazo: false, acusa: false };
    const venc = ms(fatura.due_date);
    const periodo = venc + (parseInt(c.days_overdue, 10) || 0) * DIA;
    const totalNoPrazo = totalEm <= venc;
    return { fatura, totalNoPrazo, acusa: periodo > totalEm || (encargoUnico(c) && totalNoPrazo) };
}

/**
 * Anomalia 8e: encargo criado DEPOIS de um pagamento TOTAL ao vivo sem que houvesse,
 * naquele instante, principal vencido em aberto (nenhuma fatura venceu desde a
 * quitação, ou a que venceu já estava paga) E que conta um período depois do TOTAL
 * (classificarEncargoAposTotal). Um débito novo — fatura que venceu depois do TOTAL e
 * não foi paga — tem encargo próprio e NÃO é acusado. Uma linha por CPF, com as faturas.
 */
/**
 * Todo encargo criado depois de um TOTAL ao vivo sem principal vencido em aberto
 * naquele instante — cobrança sem dívida, venha ela de "continuou contando" (acusa) ou
 * de débito anterior ao TOTAL recriado com created_at novo (a Anomalia 8b antes do
 * filtro de residual). Base da 8e e da cura (scripts/cura_encargos_apos_total.cjs).
 * @returns {Promise<Array<{cpf, fullName, encargos: Array}>>}
 */
async function listarEncargosSemDebitoAposTotal(db, { cpf = null, esc = escPadrao, somenteLeitura = false } = {}) {
    const d = await carregarDebitos(db, { cpf, esc, somenteLeitura });
    const porCpf = [];
    for (const [cpfAtual, encargos] of d.encargos) {
        const usuario = d.usuarios.get(cpfAtual);
        const pagamentos = d.pagamentos.get(cpfAtual) || [];
        const totais = pagamentos.filter((p) => p.total).sort((a, b) => a.quando - b.quando);
        if (!usuario || !totais.length) continue;
        const fechadas = d.fechadas.get(cpfAtual) || [];
        const lista = [];
        for (const c of encargos) {
            if (parseFloat(c.amount || 0) <= TOLERANCIA_QUITACAO) continue;
            const criadoEm = ms(c.created_at);
            const ultimoTotal = totais.filter((t) => t.quando < criadoEm).pop();
            if (!ultimoTotal || !ultimoTotal.aoVivo) continue;
            if (residualVencidoEm(fechadas, pagamentos, criadoEm) > TOLERANCIA_QUITACAO) continue;
            const cls = classificarEncargoAposTotal(c, fechadas, ultimoTotal.quando);
            lista.push({
                ...c, quitacaoTotalEm: ultimoTotal.date, invoiceId: cls.fatura ? cls.fatura.id : null,
                totalNoPrazo: cls.totalNoPrazo, acusa: cls.acusa,
                multaDupla: ehMultaDupla(c, cls.fatura, encargos, fechadas),
            });
        }
        if (lista.length) porCpf.push({ cpf: cpfAtual, fullName: usuario.full_name || null, encargos: lista });
    }
    return porCpf;
}

async function listarEncargosAposQuitacaoTotal(db, opts = {}) {
    const achados = [];
    for (const { cpf: cpfAtual, fullName, encargos } of await listarEncargosSemDebitoAposTotal(db, opts)) {
        const indevidos = encargos.filter((c) => c.acusa);
        if (!indevidos.length) continue;
        indevidos.sort((a, b) => ms(a.created_at) - ms(b.created_at));
        const pendentes = indevidos.filter((c) => c.status === 'pending');
        const faturas = new Map();
        for (const c of indevidos) {
            const f = faturas.get(c.invoiceId) || { invoiceId: c.invoiceId, totalNoPrazo: c.totalNoPrazo, quantidade: 0, valor: 0 };
            f.quantidade += 1;
            f.valor = round2(f.valor + parseFloat(c.amount || 0));
            faturas.set(c.invoiceId, f);
        }
        achados.push({
            cpf: cpfAtual, fullName,
            faturas: [...faturas.values()],
            quitacaoTotalEm: indevidos[0].quitacaoTotalEm,
            primeiroEncargoEm: indevidos[0].created_at,
            ultimoEncargoEm: indevidos[indevidos.length - 1].created_at,
            quantidade: indevidos.length, valor: somaValores(indevidos),
            pendentes: pendentes.length, valorPendente: somaValores(pendentes),
            chargeIds: indevidos.map((c) => c.id),
        });
    }
    return achados;
}

/**
 * Anomalia 8f: principal vencido em aberto depois de pagamento PARCIAL ao vivo (feito
 * depois da última quitação total) cujo último encargo é anterior à última rodada do
 * motor − 1 dia: o residual parou de gerar juros/IOF antes do pagamento total. A
 * referência é o encargo mais recente da base (não o relógio), para a API parada por
 * uns dias não virar anomalia em massa. Blacklist (90+ dias) para de acumular por
 * regra do motor e fica de fora.
 */
async function listarResidualParcialSemEncargo(db, { cpf = null, esc = escPadrao } = {}) {
    const [ref] = await db.executeQuery(`SELECT MAX(created_at) AS ultima FROM ${db.fq('billing_charges')}`);
    if (!ref || !ref.ultima) return [];
    const limite = ms(ref.ultima) - DIA;
    const d = await carregarDebitos(db, { cpf, esc });
    const achados = [];
    for (const [cpfAtual, fechadas] of d.fechadas) {
        const usuario = d.usuarios.get(cpfAtual);
        if (!usuario || verdadeiro(usuario.is_blacklisted)) continue;
        const pagamentos = d.pagamentos.get(cpfAtual) || [];
        const ultimoTotal = pagamentos.filter((p) => p.total).reduce((a, p) => Math.max(a, p.quando), -Infinity);
        const parciais = pagamentos
            .filter((p) => p.quando > ultimoTotal && p.aoVivo)
            .sort((a, b) => a.quando - b.quando);
        if (!parciais.length) continue;
        const residual = residualVencidoEm(fechadas, pagamentos, limite);
        if (residual <= TOLERANCIA_QUITACAO) continue;
        const ultimoEncargo = (d.encargos.get(cpfAtual) || [])
            .map((c) => ms(c.created_at))
            .filter((t) => t > ultimoTotal)
            .reduce((a, b) => Math.max(a, b), -Infinity);
        if (ultimoEncargo >= limite) continue;
        achados.push({
            cpf: cpfAtual, fullName: usuario.full_name || null, residual,
            ultimoPagamentoParcialEm: parciais[parciais.length - 1].date,
            ultimoEncargoEm: Number.isFinite(ultimoEncargo) ? new Date(ultimoEncargo) : null,
            motorRodouEm: ref.ultima,
        });
    }
    return achados;
}

module.exports = {
    listarEncargosAposQuitacaoTotal, listarResidualParcialSemEncargo, residualVencidoEm,
    classificarEncargoAposTotal, carregarDebitos, listarEncargosSemDebitoAposTotal,
};
