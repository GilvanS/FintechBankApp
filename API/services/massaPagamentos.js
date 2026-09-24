/**
 * massaPagamentos.js — histórico de faturas da massa (Gerador 4.0) quando algum ciclo
 * inadimplente traz PAGAMENTO feito em atraso: TOTAL, MÍNIMO, ABAIXO DO MÍNIMO ou
 * PARCIAL. Função PURA (sem banco): devolve as linhas que o seedMassBilling grava.
 *
 * O histórico nasce como se a rota de pagamento e o motor diário tivessem rodado no
 * dia de cada evento — assim a massa não é acusada pela auditoria (8d/8e/8f) nem
 * engana o motor quando ele continuar a partir de hoje:
 *  - fatura FECHADA inserida já com os valores do fechamento (created_at = corte,
 *    vencimento − 10 dias), sem valor_pago/data_pagamento: a quitação é DERIVADA dos
 *    INVOICE_PAYMENT vinculados (transactions.invoice_id), em cascata da mais antiga
 *    para a mais nova — nunca carimbada na fechada (imutável);
 *  - saldo_anterior = SÓ o principal residual das fechadas anteriores no instante do
 *    corte (residualEmAberto, a mesma conta do fechamento e da 8d). Os encargos são
 *    herdados pelo caminho deles: seguem pending e são congelados nas colunas da
 *    próxima fechada (como faz o invoiceEngine);
 *  - o pagamento abate ENCARGOS PRIMEIRO (planejarPagamento, a mesma função da rota):
 *    charges quitadas ficam 'paid' com paid_at = data do pagamento e payment_id; a
 *    quitada em parte vira mãe pending + filha paga `<id>:q:<payment_id>`;
 *  - mínimo, parcial e abaixo do mínimo NÃO param os encargos: o residual segue
 *    gerando juros/IOF do vencimento até hoje. Só o TOTAL ('Pagamento fatura') para.
 *
 * created_at de cada charge = fim do trecho que ela cobre (data retroativa do ciclo,
 * nunca a data da geração): charge paga com created_at = hoje fazia o motor contá-la
 * no débito ATUAL e deixar de cobrar a multa de um débito novo de verdade.
 */
const {
    round2, TOLERANCIA_QUITACAO,
    calcMulta, calcJurosMora, calcJurosRemuneratorios, calcIofAdicional, calcIofDiario,
} = require('../utils/invoiceMath');
const { residualEmAberto } = require('./saldoAnterior');
const {
    montarDividaEncargos, planejarPagamento, idMaeDaQuitacao, SUFIXO_QUITACAO, DESCRICAO_PAGAMENTO_TOTAL,
} = require('./encargosPagamento');

const DIA = 86400000;
const TIPOS_PAGAMENTO_MASSA = Object.freeze(['TOTAL', 'MINIMO', 'ABAIXO_MINIMO', 'PARCIAL']);
const DIAS_ATRASO_PAGAMENTO_PADRAO = 10;
// Teto: o pagamento sai ANTES do corte da fatura seguinte (vencimento dela − 10 dias,
// >= 18 dias depois deste vencimento). Assim cada pagamento enxerga só as fechadas
// que já existiam e a herança da seguinte é o residual depois dele.
const MAX_DIAS_ATRASO_PAGAMENTO = 15;
const DIAS_CORTE_ANTES_DO_VENCIMENTO = 10;
// PARCIAL = entre o mínimo e o total; ABAIXO DO MÍNIMO = metade do mínimo (quita só
// parte dos encargos, o que exercita a quitação parcial de charge).
const FRACAO_PARCIAL = 0.5;
const FRACAO_ABAIXO_MINIMO = 0.5;
// Mesmas descrições da rota (invoiceController.pay): 'minimo' quando o principal
// abatido chega a 10% do devido (piso R$ 10), 'parcial' abaixo disso.
const DESCRICAO_PAGAMENTO_MINIMO = 'Pagamento minimo de fatura';
const DESCRICAO_PAGAMENTO_PARCIAL = 'Pagamento parcial de fatura';

/** 'Mínimo', 'abaixo do minimo', 'ABAIXO_DO_MINIMO'... → tipo canônico (null se inválido). */
function normalizarTipoPagamento(tipo) {
    if (tipo === null || tipo === undefined || tipo === '') return null;
    const t = String(tipo).normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().toUpperCase().replace(/[\s-]+/g, '_').replace('ABAIXO_DO_MINIMO', 'ABAIXO_MINIMO');
    return TIPOS_PAGAMENTO_MASSA.includes(t) ? t : null;
}

/** Dias de atraso do pagamento: inteiro entre 1 e MAX_DIAS_ATRASO_PAGAMENTO. */
function normalizarDiasAtrasoPagamento(dias) {
    const n = parseInt(dias, 10);
    if (!Number.isFinite(n)) return DIAS_ATRASO_PAGAMENTO_PADRAO;
    return Math.min(MAX_DIAS_ATRASO_PAGAMENTO, Math.max(1, n));
}

/** Parte do principal que o mínimo exige: 10% do devido, piso R$ 10 (regra da rota). */
function principalDoMinimo(principalDevido) {
    return round2(Math.min(principalDevido, Math.max(principalDevido * 0.10, 10)));
}

/**
 * Valor pago por tipo. `abativeis` = encargos que a ordem abate (sem o IOF fixo, que
 * só o TOTAL quita). Mínimo = 100% dos encargos + 10% do principal — o mesmo corte
 * que a rota usa para classificar o pagamento como mínimo.
 */
function valorDoPagamento(tipo, principalDevido, encargos) {
    const d = encargos.divida;
    const abativeis = round2(d.multa + d.jurosMora + d.jurosRemuneratorios + d.iofDiario);
    const minimo = round2(abativeis + principalDoMinimo(principalDevido));
    if (tipo === 'TOTAL') return round2(principalDevido + encargos.total);
    if (tipo === 'MINIMO') return minimo;
    if (tipo === 'PARCIAL') return round2(abativeis + round2(principalDevido * FRACAO_PARCIAL));
    return Math.max(0.01, round2(minimo * FRACAO_ABAIXO_MINIMO));
}

/** Descrição da transação pela regra da rota (TOTAL encerra o débito). */
function descricaoDoPagamento(plano, principalDevido) {
    if (plano.isTotal || plano.principalQuitado) return DESCRICAO_PAGAMENTO_TOTAL;
    const minPayment = Math.max(principalDevido * 0.10, 10);
    return plano.principalAplicado >= minPayment - 0.05 ? DESCRICAO_PAGAMENTO_MINIMO : DESCRICAO_PAGAMENTO_PARCIAL;
}

const referenciaDoMes = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const dias = (de, ate) => Math.round((ate - de) / DIA);

/**
 * Simula o histórico. Datas em ms; todas ao meio-dia (dias inteiros entre eventos).
 * @param {{
 *   ciclos: Array<{status:'adimplente'|'inadimplente', pagamento?:string|null, diasAtrasoPagamento?:number,
 *                  dueDate:Date, principal:number, iofFixoExtra?:number}>,
 *   agora: number, genId: function(): string
 * }} args
 *   - 'adimplente': pagamento TOTAL no vencimento (quita também o que ficou para trás);
 *   - 'inadimplente' sem pagamento: débito segue aberto;
 *   - 'inadimplente' com pagamento: pago `diasAtrasoPagamento` dias depois do vencimento.
 *   iofFixoExtra = IOF de câmbio da compra internacional (fixo, só o TOTAL quita).
 * @returns {{faturas: Array, pagamentos: Array, encargos: Array,
 *            usuario: {accountStatus:string, daysOverdue:number}}}
 */
function simularCiclosComPagamento({ ciclos, agora, genId }) {
    const fat = ciclos.map((c, idx) => {
        const venc = new Date(c.dueDate).getTime();
        return {
            idx, id: genId(), venc, corte: venc - DIAS_CORTE_ANTES_DO_VENCIMENTO * DIA,
            valorTotal: round2(c.principal), iofFixoExtra: round2(c.iofFixoExtra || 0), ref: referenciaDoMes(venc),
            pago: 0, cursor: null, multaLancada: false, iofLancado: false, quitadaEm: null,
            saldoAnterior: 0, congelado: { multa: 0, juros_mora: 0, juros_remuneratorios: 0, iof: 0 },
        };
    });
    const devido = (f) => round2(Math.max(0, f.valorTotal - f.pago));

    const eventos = ciclos.map((c, idx) => {
        if (c.status === 'adimplente') return { idx, tipo: 'TOTAL', quando: fat[idx].venc };
        const tipo = normalizarTipoPagamento(c.pagamento);
        if (!tipo) return null;
        return { idx, tipo, quando: fat[idx].venc + normalizarDiasAtrasoPagamento(c.diasAtrasoPagamento) * DIA };
    }).filter(Boolean);
    for (const e of eventos) {
        if (e.quando > agora) {
            throw new Error(`Pagamento do ciclo ${e.idx + 1} cairia no futuro (${new Date(e.quando).toISOString().slice(0, 10)}).`);
        }
    }

    const encargos = [];
    const pagamentos = [];

    // Juros/IOF de 1 trecho (cursor → t) sobre o residual de cada fechada vencida em
    // aberto; multa e IOF adicional (+ câmbio) uma vez por fechada, sobre o valor_total,
    // na 1ª linha — a mesma forma que o motor grava (separarIof lê diário × fixo dela).
    const acumularAte = (t) => {
        for (const f of fat) {
            if (f.cursor === null || t <= f.cursor) continue;
            const n = dias(f.cursor, t);
            if (n < 1) continue;
            const residual = devido(f);
            const linha = (tipo, valor) => {
                if (valor <= TOLERANCIA_QUITACAO) return;
                encargos.push({
                    id: genId(), invoice_id: f.id, invoice_reference: f.ref, charge_type: tipo, amount: valor,
                    days_overdue: dias(f.venc, t), invoice_amount: residual, created_at: t,
                    status: 'pending', paid_at: null, payment_id: null,
                });
            };
            if (!f.multaLancada) linha('multa', calcMulta(f.valorTotal));
            linha('juros_mora', calcJurosMora(residual, n));
            linha('juros_remuneratorios', calcJurosRemuneratorios(residual, n));
            const iofDiario = calcIofDiario(residual, n);
            linha('iof', f.iofLancado ? iofDiario : round2(calcIofAdicional(f.valorTotal) + f.iofFixoExtra + iofDiario));
            f.multaLancada = true;
            f.iofLancado = true;
            f.cursor = t;
        }
    };

    const pagar = (e, t) => {
        const fechadas = fat.filter((f) => f.corte <= t);
        const principalDevido = round2(fechadas.reduce((s, f) => s + devido(f), 0));
        const pendentes = encargos.filter((r) => r.status === 'pending');
        const filhas = encargos.filter((r) => r.status === 'paid' && idMaeDaQuitacao(r.id));
        const divida = montarDividaEncargos(pendentes, filhas);
        const valor = valorDoPagamento(e.tipo, principalDevido, divida);
        if (valor <= TOLERANCIA_QUITACAO) return;
        const plano = planejarPagamento(valor, principalDevido, divida);
        const payId = genId();
        // Âncora do lançamento = fechada MAIS RECENTE em aberto (persistPaymentDistribution).
        const emAberto = fechadas.filter((f) => devido(f) > TOLERANCIA_QUITACAO);
        const ancora = emAberto.length ? emAberto[emAberto.length - 1] : fat[e.idx];

        const porId = new Map(encargos.map((r) => [r.id, r]));
        for (const id of plano.quitacao.quitarInteiras) {
            Object.assign(porId.get(id), { status: 'paid', paid_at: t, payment_id: payId });
        }
        for (const d of plano.quitacao.dividir) {
            const mae = porId.get(d.id);
            mae.amount = round2(mae.amount - d.pago);
            encargos.push({ ...mae, id: `${mae.id}${SUFIXO_QUITACAO}${payId}`, amount: d.pago, status: 'paid', paid_at: t, payment_id: payId });
        }

        // Principal em cascata, da fechada mais antiga para a mais nova.
        let resto = round2(plano.principalAplicado);
        for (const f of fechadas) {
            if (resto <= TOLERANCIA_QUITACAO) break;
            const abate = round2(Math.min(resto, devido(f)));
            f.pago = round2(f.pago + abate);
            resto = round2(resto - abate);
        }
        for (const f of fechadas) {
            if (f.quitadaEm === null && devido(f) <= TOLERANCIA_QUITACAO) {
                f.quitadaEm = t;
                f.cursor = null; // só o principal quitado para de render encargo
            }
        }
        pagamentos.push({
            id: payId, date: t, amount: valor, invoice_id: ancora.id, tipo: e.tipo,
            description: descricaoDoPagamento(plano, principalDevido),
            principal: round2(plano.principalAplicado), encargosQuitados: round2(plano.quitacao.totalQuitado),
        });
    };

    const fechar = (f, t) => {
        const anteriores = fat.filter((g) => g.corte < t);
        const pagoAte = pagamentos.filter((p) => p.date < t).reduce((s, p) => s + p.principal, 0);
        f.saldoAnterior = residualEmAberto(
            anteriores.map((g) => ({ id: g.id, due_date: new Date(g.venc), valor_total: g.valorTotal, valor_pago: 0 })),
            round2(pagoAte),
        );
        // Congela (só exibição) os encargos pending criados desde o corte anterior.
        const anterior = f.idx > 0 ? fat[f.idx - 1].corte : -Infinity;
        for (const r of encargos) {
            if (r.status !== 'pending' || r.created_at <= anterior || r.created_at > t) continue;
            f.congelado[r.charge_type] = round2((f.congelado[r.charge_type] || 0) + r.amount);
        }
    };

    const instantes = [...new Set([...fat.flatMap((f) => [f.corte, f.venc]), ...eventos.map((e) => e.quando), agora])]
        .filter((t) => t <= agora)
        .sort((a, b) => a - b);
    for (const t of instantes) {
        acumularAte(t);
        for (const e of eventos) if (e.quando === t) pagar(e, t);
        // Vencida sem quitar começa a render encargo a partir do vencimento.
        for (const f of fat) if (f.venc === t && devido(f) > TOLERANCIA_QUITACAO) f.cursor = t;
        for (const f of fat) if (f.corte === t) fechar(f, t);
    }

    // Estado do usuário pela regra do motor: âncora = fechada em aberto mais antiga;
    // principal pago >= mínimo (10%, piso R$ 10) deixa a conta em dia (dias 0), mas os
    // encargos seguem; abaixo disso, inadimplente com os dias desde o vencimento dela.
    const aberta = fat.find((f) => devido(f) > TOLERANCIA_QUITACAO);
    let usuario = { accountStatus: 'adimplente', daysOverdue: 0 };
    if (aberta && !(aberta.pago >= Math.max(aberta.valorTotal * 0.10, 10) - 0.01)) {
        usuario = { accountStatus: 'inadimplente', daysOverdue: Math.max(1, dias(aberta.venc, agora)) };
    }

    const faturas = fat.map((f) => ({
        id: f.id, dueDate: f.venc, createdAt: f.corte, valorTotal: f.valorTotal, saldoAnterior: f.saldoAnterior,
        valorMulta: f.congelado.multa, valorJurosMora: f.congelado.juros_mora,
        valorJurosRemuneratorios: f.congelado.juros_remuneratorios, valorIof: f.congelado.iof,
        diasAtraso: f.quitadaEm !== null
            ? Math.max(0, dias(f.venc, f.quitadaEm))
            : (agora > f.venc ? Math.max(1, dias(f.venc, agora)) : 0),
    }));
    return { faturas, pagamentos, encargos, usuario };
}

module.exports = {
    TIPOS_PAGAMENTO_MASSA, DIAS_ATRASO_PAGAMENTO_PADRAO, MAX_DIAS_ATRASO_PAGAMENTO,
    DESCRICAO_PAGAMENTO_MINIMO, DESCRICAO_PAGAMENTO_PARCIAL,
    normalizarTipoPagamento, normalizarDiasAtrasoPagamento, valorDoPagamento, descricaoDoPagamento,
    simularCiclosComPagamento,
};
