/**
 * encargosPagamento.js — quitação RASTREÁVEL dos encargos (billing_charges) quando a
 * fatura é paga. Regra de 2026-09-23: o pagamento abate ENCARGOS PRIMEIRO (multa →
 * juros de mora → juros remuneratórios → IOF diário) e só o que sobra abate o
 * principal (utils/invoiceMath.alocarPagamento é a fonte única da ordem).
 *
 * Como a quitação fica registrada (sem tocar a fatura FECHADA, que é imutável):
 *  - charge quitada inteira: status 'paid' + paid_at + payment_id (= id da transação
 *    INVOICE_PAYMENT que pagou);
 *  - charge quitada em parte: a linha pending fica com o que falta e nasce uma linha
 *    FILHA 'paid' com a parte quitada, id `<id da mãe>:q:<payment_id>` (a linhagem é o
 *    próprio id — o unique index billing_charges_daily_unique só vale para pending).
 *  - o principal pago por uma transação = |amount| − encargos quitados por ela
 *    (sqlPrincipalPorPagamento). O extrato continua com UM lançamento do valor pago.
 *
 * IOF: o banco grava tudo como charge_type 'iof'. A 1ª linha do débito junta o IOF
 * adicional 0,38% (e o IOF câmbio 6,38% em compra internacional) com o diário
 * acumulado; as seguintes são só o diário de 1 dia. Só o DIÁRIO entra na ordem; o
 * fixo (adicional/câmbio) é calculado sobre as compras, não é abatido pela ordem e só
 * sai de 'pending' no pagamento TOTAL (separarIof).
 */
const { round2, calcIofDiario, alocarPagamento, ORDEM_ALOCACAO_PAGAMENTO, TOLERANCIA_QUITACAO } = require('../utils/invoiceMath');

// charge_type do banco → chave de alocarPagamento. Mapa EXPLÍCITO de propósito:
// alocarPagamento trata chave ausente como dívida 0 sem aviso, então tipo com nome
// diferente viraria "nada a pagar". Tipo fora do mapa cai no balde `fixo` (só o
// pagamento TOTAL quita) e é logado.
const CHAVE_POR_CHARGE_TYPE = Object.freeze({
    multa: 'multa',
    juros_mora: 'jurosMora',
    juros_remuneratorios: 'jurosRemuneratorios',
    iof: 'iofDiario',
});

const ENCARGOS_NA_ORDEM = ORDEM_ALOCACAO_PAGAMENTO.filter(chave => chave !== 'principal');
const SUFIXO_QUITACAO = ':q:';
// Só para reconhecer a linha de IOF só-diário (arredondamento do motor). A decisão
// TOTAL / principal quitado usa TOLERANCIA_QUITACAO — a mesma do motor diário.
const TOLERANCIA_IOF = 0.01;

const valor = v => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? round2(n) : 0;
};

/** Id da linha mãe de uma linha filha de quitação parcial (null se não for filha). */
function idMaeDaQuitacao(id) {
    const s = String(id || '');
    const i = s.indexOf(SUFIXO_QUITACAO);
    return i > 0 ? s.slice(0, i) : null;
}

/**
 * Separa uma linha 'iof' pending em { diario, fixo }.
 * `jaQuitado` = o que filhas de quitação parcial já tiraram desta linha (sempre da
 * parte diária) — sem isso, a linha que já perdeu parte do diário teria o diário
 * reestimado cheio e o próximo pagamento abateria o IOF adicional como se fosse diário.
 * Linha só-diário: amount original ≈ IOF diário de 1 dia sobre invoice_amount (é o que
 * o motor grava a partir do 2º dia). Senão é a linha combinada: diário = IOF diário de
 * days_overdue dias sobre invoice_amount; o resto é fixo (adicional + câmbio).
 */
function separarIof(row, jaQuitado = 0) {
    const amount = valor(row && row.amount);
    const quitado = valor(jaQuitado);
    const original = round2(amount + quitado);
    const base = valor(row && row.invoice_amount);
    const dias = Math.max(0, parseInt(row && row.days_overdue, 10) || 0);
    const umDia = calcIofDiario(base, 1);
    const soDiario = umDia > 0 && Math.abs(original - umDia) <= TOLERANCIA_IOF;
    const diarioOriginal = soDiario ? original : Math.min(original, calcIofDiario(base, dias));
    const diario = round2(Math.min(amount, Math.max(0, diarioOriginal - quitado)));
    return { diario, fixo: round2(amount - diario) };
}

const ordemCronologica = (a, b) => {
    const ta = new Date(a.created_at).getTime() || 0;
    const tb = new Date(b.created_at).getTime() || 0;
    if (ta !== tb) return ta - tb;
    const da = parseInt(a.days_overdue, 10) || 0;
    const db = parseInt(b.days_overdue, 10) || 0;
    if (da !== db) return da - db;
    return String(a.id).localeCompare(String(b.id));
};

/**
 * Dívida de encargos discriminada a partir das linhas pending do CPF.
 * @param {Array<object>} pendentes - billing_charges status 'pending'
 * @param {Array<object>} [filhasQuitadas] - linhas 'paid' de quitação parcial (id com ':q:')
 * @returns {{ divida: {multa:number, jurosMora:number, jurosRemuneratorios:number, iofDiario:number},
 *             fixo: number, total: number, linhas: Array<{row:object, chave:string|null, amount:number, abativel:number}>,
 *             tiposDesconhecidos: string[] }}
 */
function montarDividaEncargos(pendentes, filhasQuitadas = []) {
    const quitadoPorMae = new Map();
    for (const f of filhasQuitadas || []) {
        const mae = idMaeDaQuitacao(f.id);
        if (mae) quitadoPorMae.set(mae, round2((quitadoPorMae.get(mae) || 0) + valor(f.amount)));
    }
    const divida = { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iofDiario: 0 };
    const tiposDesconhecidos = new Set();
    let fixo = 0;
    let total = 0;
    const linhas = [...(pendentes || [])].sort(ordemCronologica).map(row => {
        const amount = valor(row.amount);
        total = round2(total + amount);
        const chave = CHAVE_POR_CHARGE_TYPE[row.charge_type] || null;
        let abativel = amount;
        if (!chave) {
            tiposDesconhecidos.add(String(row.charge_type));
            abativel = 0;
        } else if (row.charge_type === 'iof') {
            abativel = separarIof(row, quitadoPorMae.get(row.id) || 0).diario;
        }
        if (chave) divida[chave] = round2(divida[chave] + abativel);
        fixo = round2(fixo + amount - abativel);
        return { row, chave, amount, abativel };
    });
    return { divida, fixo, total, linhas, tiposDesconhecidos: [...tiposDesconhecidos] };
}

/**
 * Decide, linha a linha, o que o valor aplicado em cada encargo quita (mais antiga
 * primeiro dentro de cada tipo). Cobre só `abativel` — o fixo do IOF nunca é tocado.
 * @param {Array} linhas - saída de montarDividaEncargos
 * @param {{multa:number, jurosMora:number, jurosRemuneratorios:number, iofDiario:number}} aplicado
 * @returns {{ quitarInteiras: string[], dividir: Array<{id:string, pago:number, resta:number}>, totalQuitado: number }}
 */
function planejarQuitacao(linhas, aplicado) {
    const quitarInteiras = [];
    const dividir = [];
    let totalQuitado = 0;
    for (const chave of ENCARGOS_NA_ORDEM) {
        let disponivel = valor(aplicado && aplicado[chave]);
        for (const l of linhas) {
            if (disponivel <= 0) break;
            if (l.chave !== chave || l.abativel <= 0) continue;
            const pago = round2(Math.min(disponivel, l.abativel));
            disponivel = round2(disponivel - pago);
            totalQuitado = round2(totalQuitado + pago);
            if (pago >= l.amount) quitarInteiras.push(l.row.id);
            else dividir.push({ id: l.row.id, pago, resta: round2(l.amount - pago) });
        }
        if (disponivel > 0) {
            // Não acontece se `aplicado` veio de alocarPagamento com a MESMA dívida —
            // falhar aqui evita gravar um pagamento de encargo que não existe.
            throw new Error(`[encargosPagamento] R$ ${disponivel.toFixed(2)} de ${chave} sem charge pending para quitar.`);
        }
    }
    return { quitarInteiras, dividir, totalQuitado };
}

/**
 * Plano completo do pagamento: quanto vai para cada encargo, para o principal e se é
 * TOTAL. TOTAL (paga principal + TODAS as pending, inclusive o fixo) quita tudo; os
 * demais seguem a ordem encargos → principal e deixam o fixo e o restante pending
 * (herdados pela fatura aberta, que segue gerando encargo sobre o residual).
 * @param {number} payAmount
 * @param {number} principalDevido - dívida das fechadas (getClosedInvoiceDebt.owed)
 * @param {ReturnType<typeof montarDividaEncargos>} encargos
 */
function planejarPagamento(payAmount, principalDevido, encargos) {
    const pago = valor(payAmount);
    const principal = valor(principalDevido);
    const totalDevido = round2(principal + encargos.total);
    // Mesma tolerância do motor (TOLERANCIA_QUITACAO): Total − R$ 0,01 NÃO é TOTAL —
    // senão a rota encerrava o débito e o motor, vendo 0,01 devendo, criava 2ª multa.
    const isTotal = pago >= totalDevido - TOLERANCIA_QUITACAO;
    const alocacao = alocarPagamento(pago, { ...encargos.divida, principal });
    if (isTotal) {
        return {
            isTotal,
            principalQuitado: true,
            alocacao,
            principalAplicado: principal,
            encargosQuitados: encargos.total,
            quitacao: { quitarInteiras: encargos.linhas.map(l => l.row.id), dividir: [], totalQuitado: encargos.total },
        };
    }
    const quitacao = planejarQuitacao(encargos.linhas, alocacao.aplicado);
    return {
        isTotal,
        principalQuitado: alocacao.restante.principal <= TOLERANCIA_QUITACAO,
        alocacao,
        principalAplicado: alocacao.aplicado.principal,
        encargosQuitados: quitacao.totalQuitado,
        quitacao,
    };
}

// ── I/O ────────────────────────────────────────────────────────────────────────

const colunasGarantidas = new WeakSet();

/** Colunas da quitação rastreável (idempotente; memoizado por dbService). */
async function garantirColunasQuitacao(dbService) {
    if (!dbService || colunasGarantidas.has(dbService)) return;
    try {
        await dbService.executeQuery(`ALTER TABLE ${dbService.fq('billing_charges')} ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP NULL`);
        await dbService.executeQuery(`ALTER TABLE ${dbService.fq('billing_charges')} ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255) NULL`);
        colunasGarantidas.add(dbService);
    } catch (err) {
        // Não memoiza a falha: a próxima chamada tenta de novo.
        console.error('[encargosPagamento] Falha ao garantir paid_at/payment_id em billing_charges:', err.message);
    }
}

/** Linhas pending do CPF + filhas de quitação parcial (para o IOF já abatido). */
async function buscarEncargosDoCpf(dbService, esc, cpf) {
    await garantirColunasQuitacao(dbService);
    const rows = await dbService.executeQuery(`
        SELECT id, charge_type, amount, days_overdue, invoice_amount, invoice_reference, invoice_id, created_at, status
        FROM ${dbService.fq('billing_charges')}
        WHERE cpf = ${esc(cpf)}
          AND (status = 'pending' OR (status = 'paid' AND payment_id IS NOT NULL AND POSITION('${SUFIXO_QUITACAO}' IN id) > 0))
    `);
    return {
        pendentes: rows.filter(r => r.status === 'pending'),
        filhasQuitadas: rows.filter(r => r.status === 'paid'),
    };
}

/** Grava a quitação planejada, amarrada à transação INVOICE_PAYMENT `paymentId`. */
async function gravarQuitacao(dbService, esc, { quitacao, paymentId, paidAt }) {
    const bc = dbService.fq('billing_charges');
    let quitado = 0;
    if (quitacao.quitarInteiras.length) {
        const rows = await dbService.executeQuery(`
            UPDATE ${bc}
            SET status = 'paid', paid_at = ${esc(paidAt)}, payment_id = ${esc(paymentId)}
            WHERE status = 'pending' AND id IN (${quitacao.quitarInteiras.map(id => esc(id)).join(', ')})
            RETURNING id, amount
        `);
        quitado = round2((rows || []).reduce((s, r) => s + valor(r.amount), 0));
    }
    for (const d of quitacao.dividir) {
        // UM statement (atômico): a mãe só perde `pago` se ainda estiver pending e
        // tiver mais que isso, e a filha só nasce da linha que o UPDATE devolveu. Em
        // dois passos, falha entre eles cobrava em dobro (filha paga + mãe cheia) e
        // dois pagamentos simultâneos podiam gerar filhas somando mais que a charge.
        const pago = d.pago.toFixed(2);
        const rows = await dbService.executeQuery(`
            WITH mae AS (
                UPDATE ${bc} SET amount = amount - ${pago}
                WHERE id = ${esc(d.id)} AND status = 'pending' AND amount > ${pago}
                RETURNING id, cpf, invoice_reference, charge_type, days_overdue, invoice_amount, invoice_id, created_at
            )
            INSERT INTO ${bc}
            (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, invoice_id, created_at, status, paid_at, payment_id)
            SELECT mae.id || ${esc(SUFIXO_QUITACAO + paymentId)}, cpf, invoice_reference, charge_type, ${pago}, days_overdue, invoice_amount, invoice_id, created_at, 'paid', ${esc(paidAt)}, ${esc(paymentId)}
            FROM mae
            RETURNING id, amount
        `);
        quitado = round2(quitado + (rows || []).reduce((s, r) => s + valor(r.amount), 0));
    }
    if (Math.abs(quitado - quitacao.totalQuitado) > 0.005) {
        // Outro processo mexeu nas charges entre a leitura e a escrita: vale o que foi
        // gravado (a derivação conta a diferença como principal — lado do cliente).
        console.warn(`[encargosPagamento] pagamento ${paymentId}: planejado R$ ${quitacao.totalQuitado.toFixed(2)} de encargos, gravado R$ ${quitado.toFixed(2)}.`);
    }
    return { quitado };
}

// ── Débito contínuo: o que já foi quitado dele ────────────────────────────────

/**
 * Descrição da transação que QUITA o débito (branch de pagamento total da rota pay,
 * cardRepo e gerador de massa; tipoPelaDescricao a lê como TOTAL). Depois dela
 * começa um débito novo — com multa própria.
 */
const DESCRICAO_PAGAMENTO_TOTAL = 'Pagamento fatura';

/**
 * Charge pertence ao débito contínuo atual? Pending sempre; quitada por pagamento
 * (payment_id) só se foi paga DEPOIS do último pagamento que quitou tudo. Âncora
 * que não depende da cascata: ancorar no vencimento da fechada mais antiga que ainda
 * deve fazia a multa paga "sumir" quando um parcial quitava a 1ª fechada do débito
 * (A→B) e o motor cobrava uma 2ª multa sobre B.
 * @param {{status:string, payment_id?:string|null, paid_at?:any}} row
 * @param {Date|string|null} ultimaQuitacaoTotal - data do último DESCRICAO_PAGAMENTO_TOTAL
 */
function pertenceAoDebitoAtual(row, ultimaQuitacaoTotal) {
    if (!row) return false;
    if (row.status === 'pending') return true;
    if (row.status !== 'paid' || !row.payment_id || !row.paid_at) return false;
    const pagoEm = new Date(row.paid_at).getTime();
    if (!Number.isFinite(pagoEm)) return false;
    const corte = ultimaQuitacaoTotal ? new Date(ultimaQuitacaoTotal).getTime() : NaN;
    return !Number.isFinite(corte) || pagoEm > corte;
}

/** Totais por tipo + linhas do débito atual (entrada do motor diário). */
function resumirEncargosDoDebito(rows, ultimaQuitacaoTotal) {
    const linhas = (rows || []).filter(r => pertenceAoDebitoAtual(r, ultimaQuitacaoTotal));
    const porTipo = new Map();
    for (const r of linhas) porTipo.set(r.charge_type, round2((porTipo.get(r.charge_type) || 0) + valor(r.amount)));
    return {
        existingCharges: [...porTipo].map(([charge_type, total]) => ({ charge_type, total })),
        linhas,
    };
}

/**
 * Subquery: datas dos pagamentos que quitaram o débito do CPF. Usada como
 * `paid_at > ALL (...)` (conjunto vazio = nenhum TOTAL ainda = tudo conta).
 */
function sqlDatasQuitacaoTotal(dbService, cpfExpr) {
    return `SELECT tq.date FROM ${dbService.fq('transactions')} tq
        WHERE tq.cpf = ${cpfExpr} AND tq.type = 'INVOICE_PAYMENT'
          AND tq.description = '${DESCRICAO_PAGAMENTO_TOTAL}' AND tq.date IS NOT NULL`;
}

/**
 * Charges do débito atual do CPF (pending + quitadas por pagamento depois da última
 * quitação total). O motor usa isto na checagem de multa/IOF adicional únicos e na
 * idempotência diária — só com as pending, pagar a multa fazia o motor recriá-la e
 * quitar o incremento de hoje fazia o catch-up reinseri-lo.
 * @param {string} cpfSql - CPF já escapado
 */
async function buscarEncargosDoDebitoAtual(dbService, cpfSql) {
    await garantirColunasQuitacao(dbService);
    const rows = await dbService.executeQuery(`
        SELECT charge_type, amount, invoice_reference, days_overdue, status, payment_id, paid_at
        FROM ${dbService.fq('billing_charges')}
        WHERE cpf = ${cpfSql} AND (status = 'pending' OR (status = 'paid' AND payment_id IS NOT NULL))
    `);
    const ult = await dbService.executeQuery(`SELECT MAX(q.date) AS ultima FROM (${sqlDatasQuitacaoTotal(dbService, cpfSql)}) q`);
    return resumirEncargosDoDebito(rows, ult && ult[0] ? ult[0].ultima : null);
}

/**
 * Condição SQL (para WHERE): o CPF tem encargo do débito atual já quitado por
 * pagamento. Rotinas que apagam as pending e regeram encargos "do zero"
 * (chargesProactiveFix, Anomalia 8 do dailyAudit) não podem rodar nesses débitos —
 * cobrariam de novo o que o cliente pagou. Independe do due_date (que a Anomalia 8
 * justamente corrige) e da cascata.
 */
function sqlExisteEncargoPagoNoDebito(dbService, cpfExpr) {
    return `EXISTS (
        SELECT 1 FROM ${dbService.fq('billing_charges')} bq
        WHERE bq.cpf = ${cpfExpr} AND bq.status = 'paid' AND bq.payment_id IS NOT NULL
          AND bq.paid_at > ALL (${sqlDatasQuitacaoTotal(dbService, cpfExpr)})
    )`;
}

/** Quanto do débito atual já foi quitado por pagamento, por charge_type. */
async function buscarEncargosPagosNoDebito(dbService, cpfSql) {
    const { linhas } = await buscarEncargosDoDebitoAtual(dbService, cpfSql);
    const pagos = {};
    for (const r of linhas) {
        if (r.status !== 'paid') continue;
        pagos[r.charge_type] = round2((pagos[r.charge_type] || 0) + valor(r.amount));
    }
    return pagos;
}

/**
 * Regerar encargos "do zero" sem cobrar de novo o que já foi pago: desconta de cada
 * tipo o que pagamentos do débito atual já quitaram; o que zerar não é recriado.
 * @param {Array<[string, number]>} novos - [charge_type, valor calculado]
 * @param {Object<string, number>} pagos - saída de buscarEncargosPagosNoDebito
 */
function descontarEncargosJaPagos(novos, pagos = {}) {
    return (novos || [])
        .map(([tipo, v]) => [tipo, round2(Math.max(0, valor(v) - valor(pagos && pagos[tipo])))])
        .filter(([, v]) => v > 0.005);
}

// ── SQL compartilhado (derivação da quitação) ─────────────────────────────────

/**
 * Subquery: uma linha por INVOICE_PAYMENT vinculado com o PRINCIPAL que ela pagou
 * (|amount| − encargos quitados por ela). É o que deve alimentar a cascata
 * planDistribution — somar o |amount| cheio contaria o encargo pago como principal.
 * Pagamentos antigos (sem charge com payment_id) saem com o valor cheio, como antes.
 * `date` vem junto para quem precisa recortar por momento (saldo anterior "até o
 * fechamento", data do último pagamento exibida no enrich).
 * @param {object} dbService
 * @param {string} [cpfSql] - CPF já escapado (ex.: esc(cpf)) para filtrar
 */
function sqlPrincipalPorPagamento(dbService, cpfSql) {
    const filtroTx = cpfSql ? `AND t.cpf = ${cpfSql}` : '';
    const filtroBc = cpfSql ? `AND cpf = ${cpfSql}` : '';
    return `
        SELECT t.id, t.cpf, t.invoice_id, t.date,
               ABS(CAST(t.amount AS DECIMAL(15,2))) - COALESCE(enc.total, 0) AS principal
        FROM ${dbService.fq('transactions')} t
        LEFT JOIN (
            SELECT payment_id, SUM(CAST(amount AS DECIMAL(15,2))) AS total
            FROM ${dbService.fq('billing_charges')}
            WHERE status = 'paid' AND payment_id IS NOT NULL ${filtroBc}
            GROUP BY payment_id
        ) enc ON enc.payment_id = t.id
        WHERE t.type = 'INVOICE_PAYMENT' AND t.invoice_id IS NOT NULL ${filtroTx}
    `;
}

module.exports = {
    CHAVE_POR_CHARGE_TYPE,
    SUFIXO_QUITACAO,
    DESCRICAO_PAGAMENTO_TOTAL,
    idMaeDaQuitacao,
    separarIof,
    montarDividaEncargos,
    planejarQuitacao,
    planejarPagamento,
    pertenceAoDebitoAtual,
    resumirEncargosDoDebito,
    descontarEncargosJaPagos,
    garantirColunasQuitacao,
    buscarEncargosDoCpf,
    gravarQuitacao,
    buscarEncargosDoDebitoAtual,
    buscarEncargosPagosNoDebito,
    sqlPrincipalPorPagamento,
    sqlDatasQuitacaoTotal,
    sqlExisteEncargoPagoNoDebito,
};
