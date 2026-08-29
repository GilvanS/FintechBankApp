/**
 * Funcoes de calculo de fatura (portado de WEB/utils/invoiceMath.js).
 *
 * Fonte unica do valor bruto de uma fatura e da distribuicao de um pagamento entre
 * faturas fechadas em aberto. As implementacoes sao identicas as de
 * API/utils/invoiceMath.js e WEB/utils/invoiceMath.js (fonte unica).
 * Mantenha as tres sincronizadas ao alterar formulas de calculo.
 */

export interface InvoiceRow {
    id?: string;
    due_date?: string;
    valor_total?: number | string;
    valor_pago?: number | string;
    saldo_anterior?: number | string;
    valor_iof?: number | string;
    valor_multa?: number | string;
    valor_juros_remuneratorios?: number | string;
    valor_juros_mora?: number | string;
    data_pagamento?: string | null;
    [key: string]: unknown;
}

export interface DistributionEntry {
    id?: string;
    due_date?: string;
    gross: number;
    target: number;
    currentPago: number;
    appliedAmount: number;
    newValorPago: number;
    isFullyPaid: boolean;
}

export interface DistributionPlan {
    applied: number;
    remaining: number;
    allPaid: boolean;
    invoices: DistributionEntry[];
}

export interface ChargeBreakdown {
    multa: number;
    jurosMora: number;
    jurosRemuneratorios: number;
    iofAdicional: number;
    iofDiario: number;
    iof: number;
    total: number;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const INVOICE_GROSS_FIELDS = [
    'valor_total',
    'saldo_anterior',
    'valor_iof',
    'valor_multa',
    'valor_juros_remuneratorios',
    'valor_juros_mora',
] as const;

export function computeInvoiceGross(invoice: InvoiceRow | null | undefined): number {
    if (!invoice) return 0;
    return INVOICE_GROSS_FIELDS.reduce(
        (sum, field) => sum + parseFloat(String(invoice[field] ?? 0)),
        0
    );
}

export function computeInvoiceOwed(invoice: InvoiceRow | null | undefined): number {
    if (!invoice) return 0;
    const target = round2(parseFloat(String(invoice.valor_total ?? 0)));
    return Math.max(0, round2(target - parseFloat(String(invoice.valor_pago ?? 0))));
}

export function planDistribution(
    invoiceRows: InvoiceRow[] | null | undefined,
    payAmount: number
): DistributionPlan {
    const rows = Array.isArray(invoiceRows) ? invoiceRows : [];
    let remaining = round2(Number(payAmount) > 0 ? Number(payAmount) : 0);
    let applied = 0;
    let allPaid = true;
    const invoices: DistributionEntry[] = [];

    for (const inv of rows) {
        const gross = round2(computeInvoiceGross(inv));
        const currentPago = parseFloat(String(inv.valor_pago ?? 0));
        const target = round2(parseFloat(String(inv.valor_total ?? 0)));
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

export function computeInvoicePaidInfo(
    invoice: InvoiceRow | null | undefined
): { isPaid: boolean; paidAt: string | null } {
    if (!invoice) return { isPaid: false, paidAt: null };
    const target = parseFloat(String(invoice.valor_total ?? 0));
    const pago = parseFloat(String(invoice.valor_pago ?? 0));
    const paidAt = invoice.data_pagamento ?? null;
    const isPaid = pago >= target - 0.005 && Boolean(paidAt);
    return { isPaid, paidAt };
}

/* --- Formulas de Encargos (Fonte Unica) --- */

export const MULTA_RATE = 0.02;
export const JUROS_MORA_DAILY = 0.000333;
export const JUROS_REM_DAILY = 0.00513;
export const IOF_ADICIONAL_RATE = 0.0038;
export const IOF_DIARIO_DAILY = 0.000082;

export function calcMulta(principal: number): number {
    return round2(principal * MULTA_RATE);
}

export function calcJurosMora(principal: number, days: number): number {
    return round2(principal * JUROS_MORA_DAILY * days);
}

export function calcJurosRemuneratorios(principal: number, days: number): number {
    return round2(principal * JUROS_REM_DAILY * days);
}

export function calcIofAdicional(principal: number): number {
    return round2(principal * IOF_ADICIONAL_RATE);
}

export function calcIofDiario(principal: number, days: number): number {
    return round2(principal * IOF_DIARIO_DAILY * days);
}

export function calcIof(principal: number, days: number): number {
    return round2(calcIofAdicional(principal) + calcIofDiario(principal, days));
}

export function calcAllCharges(principal: number, days: number): ChargeBreakdown {
    const multa = calcMulta(principal);
    const jurosMora = calcJurosMora(principal, days);
    const jurosRemuneratorios = calcJurosRemuneratorios(principal, days);
    const iofAdicional = calcIofAdicional(principal);
    const iofDiario = calcIofDiario(principal, days);
    const iof = calcIof(principal, days);
    const total = round2(multa + jurosMora + jurosRemuneratorios + iof);
    return { multa, jurosMora, jurosRemuneratorios, iofAdicional, iofDiario, iof, total };
}