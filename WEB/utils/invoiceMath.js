/**
 * Bridge file: funções de cálculo de fatura (ESM).
 *
 * Fonte única do valor bruto de uma fatura e da distribuição de um pagamento entre
 * faturas fechadas em aberto. As funções são implementadas diretamente aqui como ESM
 * para evitar o problema de Vite servir o arquivo CJS original via @fs/ sem aplicar
 * o pipeline de transform CJS→ESM.
 *
 * As implementações são idênticas às de API/utils/invoiceMath.js (fonte única).
 * Mantenha ambas sincronizadas ao alterar fórmulas de cálculo.
 */

const round2 = n => Math.round(n * 100) / 100;

const INVOICE_GROSS_FIELDS = [
    'valor_total',
    'saldo_anterior',
    'valor_iof',
    'valor_multa',
    'valor_juros_remuneratorios',
    'valor_juros_mora'
];

function computeInvoiceGross(invoice) {
    if (!invoice) return 0;
    return INVOICE_GROSS_FIELDS.reduce((sum, field) => sum + parseFloat(invoice[field] || 0), 0);
}

function computeInvoiceOwed(invoice) {
    if (!invoice) return 0;
    const target = round2(parseFloat(invoice.valor_total || 0));
    return Math.max(0, round2(target - parseFloat(invoice.valor_pago || 0)));
}

function planDistribution(invoiceRows, payAmount) {
    const rows = Array.isArray(invoiceRows) ? invoiceRows : [];
    let remaining = round2(Number(payAmount) > 0 ? Number(payAmount) : 0);
    let applied = 0;
    let allPaid = true;
    const invoices = [];

    for (const inv of rows) {
        const gross = round2(computeInvoiceGross(inv));
        const currentPago = parseFloat(inv.valor_pago || 0);
        const target = round2(parseFloat(inv.valor_total || 0));
        const remainingDebt = round2(Math.max(0, target - currentPago));
        const base = { id: inv.id, due_date: inv.due_date, gross, target, currentPago };

        if (remainingDebt <= 0.005) {
            invoices.push({ ...base, appliedAmount: 0, newValorPago: currentPago, isFullyPaid: true });
            continue;
        }

        if (remaining <= 0.005) {
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

    if (rows.length === 0) allPaid = false;

    return { applied, remaining, allPaid, invoices };
}

function computeInvoicePaidInfo(invoice) {
    if (!invoice) return { isPaid: false, paidAt: null };
    const target = parseFloat(invoice.valor_total || 0);
    const pago = parseFloat(invoice.valor_pago || 0);
    const paidAt = invoice.data_pagamento || null;
    const isPaid = pago >= target - 0.005 && Boolean(paidAt);
    return { isPaid, paidAt };
}

/** ─── Fórmulas de Encargos (Fonte Única) ──────────────────────────────── */

const MULTA_RATE = 0.02;
const JUROS_MORA_DAILY = 0.000333;
const JUROS_REM_DAILY = 0.00513;
const IOF_ADICIONAL_RATE = 0.0038;
const IOF_DIARIO_DAILY = 0.000082;

function calcMulta(principal) {
    return round2(principal * MULTA_RATE);
}

function calcJurosMora(principal, days) {
    return round2(principal * JUROS_MORA_DAILY * days);
}

function calcJurosRemuneratorios(principal, days) {
    return round2(principal * JUROS_REM_DAILY * days);
}

function calcIofAdicional(principal) {
    return round2(principal * IOF_ADICIONAL_RATE);
}

function calcIofDiario(principal, days) {
    return round2(principal * IOF_DIARIO_DAILY * days);
}

function calcIof(principal, days) {
    return round2(calcIofAdicional(principal) + calcIofDiario(principal, days));
}

function calcAllCharges(principal, days) {
    const multa = calcMulta(principal);
    const jurosMora = calcJurosMora(principal, days);
    const jurosRemuneratorios = calcJurosRemuneratorios(principal, days);
    const iofAdicional = calcIofAdicional(principal);
    const iofDiario = calcIofDiario(principal, days);
    const iof = calcIof(principal, days);
    const total = round2(multa + jurosMora + jurosRemuneratorios + iof);
    return { multa, jurosMora, jurosRemuneratorios, iofAdicional, iofDiario, iof, total };
}

export {
    round2,
    INVOICE_GROSS_FIELDS,
    computeInvoiceGross,
    computeInvoiceOwed,
    computeInvoicePaidInfo,
    planDistribution,
    MULTA_RATE,
    JUROS_MORA_DAILY,
    JUROS_REM_DAILY,
    IOF_ADICIONAL_RATE,
    IOF_DIARIO_DAILY,
    calcMulta,
    calcJurosMora,
    calcJurosRemuneratorios,
    calcIofAdicional,
    calcIofDiario,
    calcIof,
    calcAllCharges,
};
