
function calcEffectiveRates(rate, installments) {
    const r = Number(rate) || 0;
    const n = Number(installments) || 1;
    if (r <= 0 || n <= 1) return { mensal: 0, anual: 0 };
    const iMensal = Math.pow(1 + r, 1 / n) - 1;
    const iAnual = Math.pow(1 + iMensal, 12) - 1;
    return { mensal: round2(iMensal * 100), anual: round2(iAnual * 100) };
}
/**
 * Aritmética de fatura — funções puras, sem I/O.
 *
 * Fonte única do valor bruto de uma fatura e da distribuição de um pagamento entre
 * faturas fechadas em aberto. index.cjs (getClosedInvoiceDebt, enrichUserCreditCardData,
 * distributePaymentAmongInvoices) e os endpoints de auditoria consomem daqui — divergir
 * reintroduz o bug de totais inconsistentes entre web, resumo e admin.
 */

const round2 = n => Math.round(n * 100) / 100;

// Compras do ciclo + saldo anterior + encargos consolidados no fechamento.
const INVOICE_GROSS_FIELDS = [
    'valor_total',
    'saldo_anterior',
    'valor_iof',
    'valor_multa',
    'valor_juros_remuneratorios',
    'valor_juros_mora'
];

/**
 * Valor bruto congelado da fatura.
 * @param {object} invoice - linha da tabela `invoices`
 * @returns {number}
 */
function computeInvoiceGross(invoice) {
    if (!invoice) return 0;
    return INVOICE_GROSS_FIELDS.reduce((sum, field) => sum + parseFloat(invoice[field] || 0), 0);
}

/**
 * Saldo devedor de uma fatura = valor_total - valor_pago (nunca negativo).
 * NÃO inclui encargos (multa, juros, IOF) — eles são exibidos separadamente em
 * closedInvoiceCharges no enrichUserCreditCardData.
 * @param {object} invoice
 * @returns {number}
 */
function computeInvoiceOwed(invoice) {
    if (!invoice) return 0;
    const target = round2(parseFloat(invoice.valor_total || 0));
    return Math.max(0, round2(target - parseFloat(invoice.valor_pago || 0)));
}

/**
 * Distribui um pagamento entre faturas, da mais antiga para a mais recente, amortizando
 * o saldo remanescente de cada uma até exaurir o valor. Não aplica nada — só calcula.
 *
 * @param {Array<object>} invoiceRows - faturas FECHADAS não pagas, ordenadas por due_date ASC
 * @param {number} payAmount - valor total a distribuir
 * @returns {{applied: number, remaining: number, allPaid: boolean, invoices: Array<object>}}
 */
function planDistribution(invoiceRows, payAmount) {
    const rows = Array.isArray(invoiceRows) ? invoiceRows : [];
    let remaining = round2(Number(payAmount) > 0 ? Number(payAmount) : 0);
    let applied = 0;
    let allPaid = true;
    const invoices = [];

    for (const inv of rows) {
        const gross = round2(computeInvoiceGross(inv));
        const currentPago = parseFloat(inv.valor_pago || 0);
        // Target de pagamento = valor_total (NÃO inclui encargos). Encargos (multa, juros,
        // IOF) são exibidos separadamente em closedInvoiceCharges no enrichUserCreditCardData.
        // Usar gross (= valor_total + encargos) como target faria o pagamento "total" nunca
        // quitar a fatura — pois newValorPago(valor_total) < gross, isFullyPaid = false.
        const target = round2(parseFloat(inv.valor_total || 0));
        const remainingDebt = round2(Math.max(0, target - currentPago));
        const base = { id: inv.id, due_date: inv.due_date, gross, target, currentPago };

        if (remainingDebt <= 0.005) {
            // Fatura já quitada: nada a aplicar, não impede allPaid
            invoices.push({ ...base, appliedAmount: 0, newValorPago: currentPago, isFullyPaid: true });
            continue;
        }

        if (remaining <= 0.005) {
            // Pagamento exaurido: fatura segue devendo
            allPaid = false;
            invoices.push({ ...base, appliedAmount: 0, newValorPago: currentPago, isFullyPaid: false });
            continue;
        }

        const appliedAmount = round2(Math.min(remaining, remainingDebt));
        const newValorPago = round2(currentPago + appliedAmount);
        const isFullyPaid = newValorPago >= target - 0.005;

        remaining = round2(remaining - appliedAmount);
        applied = round2(applied + appliedAmount);
        if (!isFullyPaid) allPaid = false;

        invoices.push({ ...base, appliedAmount, newValorPago, isFullyPaid });
    }

    // Sem faturas em aberto não há o que quitar
    if (rows.length === 0) allPaid = false;

    return { applied, remaining, allPaid, invoices };
}

/**
 * Sinaliza se uma fatura está quitada. UI precisa distinguir "zerada por nada"
 * (fatura fechada com saldo 0 por algum motivo) de "zerada por pagamento total".
 * Critério: valor_pago cobre o valor_total E há timestamp de quitação (data_pagamento).
 * Encargos (multa, juros, IOF) não entram nesta conta — são exibidos separadamente.
 *
 * @param {object|null} invoice - linha da tabela `invoices`
 * @returns {{ isPaid: boolean, paidAt: string|null }}
 */
function computeInvoicePaidInfo(invoice) {
    if (!invoice) return { isPaid: false, paidAt: null };
    const target = parseFloat(invoice.valor_total || 0);
    const pago = parseFloat(invoice.valor_pago || 0);
    const paidAt = invoice.data_pagamento || null;
    const isPaid = pago >= target - 0.005 && Boolean(paidAt);
    return { isPaid, paidAt };
}

/**
 * Resumo de encargos da fatura fechada para o frontend.
 *
 * REGRA: a fatura fechada SEMPRE exibe encargos zerados — paga ou não.
 *
 * Fatura fechada está travada: nada mais entra nela. Os encargos gerados pelo
 * atraso são cobrados na fatura ABERTA, que os herda (currentInvoiceTotal em
 * index.cjs). Exibi-los também na fechada mostraria a mesma dívida duas vezes.
 *
 * `closedVal` e `paidLateCharges` seguem na assinatura porque os chamadores já
 * os passam, mas nenhum produz encargo aqui. `dueDate` ainda alimenta
 * `daysOverdue`, que é informativo.
 *
 * @param {{ closedVal: number, isPaid: boolean, dueDate: string|null, paidLateCharges?: object|null }} params
 * @returns {{ multa: number, jurosMora: number, jurosRemuneratorios: number, iof: number, totalEncargos: number, daysOverdue: number }}
 */
function buildClosedInvoiceSummary({ closedVal, isPaid, dueDate, paidLateCharges }) {
    // daysOverdue informativo: dias que a fatura fechada está vencida.
    // Zero quando quitada — não há mais atraso a contar.
    let daysOverdue = 0;
    if (dueDate && !isPaid) {
        const d = new Date(dueDate);
        d.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        daysOverdue = Math.max(0, Math.floor((now - d) / 86400000));
    }

    return { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iof: 0, totalEncargos: 0, daysOverdue };
}

/** ─── Fórmulas de Encargos (Fonte Única) ──────────────────────────────── */

/** Taxa de multa por atraso: 2% fixo sobre o principal */
const MULTA_RATE = 0.02;
/** Juros de mora: 0,0333% ao dia sobre o saldo residual */
const JUROS_MORA_DAILY = 0.000333;
/** Juros remuneratórios: 0,513% ao dia sobre o saldo residual */
const JUROS_REM_DAILY = 0.00513;
/** IOF adicional fixo: 0,38% sobre o valor (alíquota única de abertura) */
const IOF_ADICIONAL_RATE = 0.0038;
/** IOF diário: 0,0082% ao dia sobre o valor */
const IOF_DIARIO_DAILY = 0.000082;

/**
 * Calcula multa por atraso (2% fixo).
 * @param {number} principal - saldo devedor (valor_total - valor_pago)
 * @returns {number}
 */
function calcMulta(principal) {
    return round2(principal * MULTA_RATE);
}

/**
 * Calcula juros de mora (0,0333%/dia).
 * @param {number} principal - saldo devedor
 * @param {number} days - dias em atraso
 * @returns {number}
 */
function calcJurosMora(principal, days) {
    return round2(principal * JUROS_MORA_DAILY * days);
}

/**
 * Calcula juros remuneratórios (0,513%/dia).
 * @param {number} principal - saldo devedor
 * @param {number} days - dias em atraso
 * @returns {number}
 */
function calcJurosRemuneratorios(principal, days) {
    return round2(principal * JUROS_REM_DAILY * days);
}

/**
 * Calcula IOF adicional fixo (0,38% única).
 * @param {number} principal - saldo devedor
 * @returns {number}
 */
function calcIofAdicional(principal) {
    return round2(principal * IOF_ADICIONAL_RATE);
}

/**
 * Calcula IOF diário (0,0082%/dia).
 * @param {number} principal - saldo devedor
 * @param {number} days - dias em atraso
 * @returns {number}
 */
function calcIofDiario(principal, days) {
    return round2(principal * IOF_DIARIO_DAILY * days);
}

/**
 * Calcula IOF total (adicional fixo + diário).
 * @param {number} principal - saldo devedor
 * @param {number} days - dias em atraso
 * @returns {number}
 */
function calcIof(principal, days) {
    return round2(calcIofAdicional(principal) + calcIofDiario(principal, days));
}

/**
 * Calcula TODOS os encargos de uma vez.
 * @param {number} principal - saldo devedor (valor_total - valor_pago)
 * @param {number} days - dias em atraso
 * @returns {{ multa: number, jurosMora: number, jurosRemuneratorios: number, iofAdicional: number, iofDiario: number, iof: number, total: number }}
 */
function calcAllCharges(principal, days) {
    const multa = calcMulta(principal);
    const jurosMora = calcJurosMora(principal, days);
    const jurosRemuneratorios = calcJurosRemuneratorios(principal, days);
    const iofAdicional = calcIofAdicional(principal);
    const iofDiario = calcIofDiario(principal, days);
    const iof = calcIof(principal, days); // delega a calcIof para fonte única
    const total = round2(multa + jurosMora + jurosRemuneratorios + iof);
    return { multa, jurosMora, jurosRemuneratorios, iofAdicional, iofDiario, iof, total };
}

/**
 * Classifica o status de double-counting para um CPF: compara a soma dos
 * pagamentos (transactions.type = INVOICE_PAYMENT) com a soma de
 * invoices.valor_pago. Usada por GET /admin/audit-double-count e por
 * scripts/audit_completo.js (mesma regra, sem duplicar a lógica).
 * @param {{ paymentTotal: number, invoiceTotalPago: number, invoiceRows: Array<{valor_pago?: number, valor_total?: number, data_pagamento?: any}>, hasPayments: boolean, hasInvoices: boolean }} args
 * @returns {{ status: 'ok'|'discrepancy'|'resolvido'|'orphan_payments', diff: number }}
 */
function classifyDoubleCount({ paymentTotal, invoiceTotalPago, invoiceRows, hasPayments, hasInvoices }) {
    const diff = round2(Math.abs(paymentTotal - invoiceTotalPago));
    const isDiscrepancy = diff > 0.02;

    let status = 'ok';
    if (isDiscrepancy) {
        status = 'discrepancy';
        if (invoiceTotalPago > paymentTotal + 0.02) {
            const allPaidAndCorrected = (invoiceRows || []).every(inv => {
                const vp = parseFloat(inv.valor_pago || 0);
                if (vp <= 0) return true;
                if (!inv.data_pagamento) return false;
                return vp <= parseFloat(inv.valor_total || 0) + 0.02;
            });
            if (allPaidAndCorrected) status = 'resolvido';
        }
    }
    if (hasPayments && !hasInvoices) status = 'orphan_payments';

    return { status, diff };
}

module.exports = {
    round2,
    classifyDoubleCount,
    INVOICE_GROSS_FIELDS,
    computeInvoiceGross,
    computeInvoiceOwed,
    computeInvoicePaidInfo,
    planDistribution,
    // Taxas expostas para testes e auditoria
    MULTA_RATE,
    JUROS_MORA_DAILY,
    JUROS_REM_DAILY,
    IOF_ADICIONAL_RATE,
    IOF_DIARIO_DAILY,
    // Funções de cálculo de encargos
    calcMulta,
    calcJurosMora,
    calcJurosRemuneratorios,
    calcIofAdicional,
    calcIofDiario,
    calcIof,
    calcAllCharges,
    buildClosedInvoiceSummary,
    calcEffectiveRates,
};
