'use strict';

/**
 * Lógica pura de assinaturas (cobrança recorrente).
 * Persistência fica em repositories/subscriptionsRepo.js; aqui só regras/datas.
 */

const FREQUENCIES = ['monthly', 'yearly'];
const PAYMENT_METHODS = ['debit', 'credit'];

function isValidFrequency(f) { return FREQUENCIES.includes(f); }
function isValidPaymentMethod(m) { return PAYMENT_METHODS.includes(m); }

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

/**
 * Próxima data de cobrança a partir de uma data base.
 * @param {'monthly'|'yearly'} frequency
 * @param {Date|string} [from]
 * @returns {Date}
 */
function computeNextBillingDate(frequency, from = new Date()) {
    const base = new Date(from);
    const next = new Date(base);
    if (frequency === 'yearly') next.setFullYear(base.getFullYear() + 1);
    else next.setMonth(base.getMonth() + 1); // monthly (padrão)
    return next;
}

/**
 * A assinatura está vencida e deve ser cobrada agora?
 * Idempotência diária: se já foi cobrada hoje (last_billing_date no mesmo dia),
 * não cobra de novo mesmo que o cron rode várias vezes.
 * @param {{ status?: string, next_billing_date?: string|Date, last_billing_date?: string|Date }} sub
 * @param {Date} [now]
 */
function isSubscriptionDue(sub, now = new Date()) {
    if (!sub || sub.status !== 'active') return false;
    const next = new Date(sub.next_billing_date);
    if (isNaN(next.getTime())) return false;
    if (sub.last_billing_date) {
        const last = new Date(sub.last_billing_date);
        if (!isNaN(last.getTime()) && sameDay(last, now)) return false;
    }
    return now.getTime() >= next.getTime();
}

/**
 * Valida o payload de criação de assinatura. Retorna lista de erros (vazia = ok).
 */
function validateSubscriptionPayload(p) {
    const errors = [];
    if (!p || typeof p !== 'object') return ['Payload inválido.'];
    if (!p.name || typeof p.name !== 'string' || !p.name.trim()) errors.push('Nome obrigatório.');
    if (typeof p.amount !== 'number' || !(p.amount > 0)) errors.push('Valor deve ser maior que zero.');
    if (!isValidFrequency(p.frequency)) errors.push('Frequência inválida (monthly|yearly).');
    if (!isValidPaymentMethod(p.payment_method)) errors.push('Forma de pagamento inválida (debit|credit).');
    return errors;
}

module.exports = {
    FREQUENCIES,
    PAYMENT_METHODS,
    isValidFrequency,
    isValidPaymentMethod,
    sameDay,
    computeNextBillingDate,
    isSubscriptionDue,
    validateSubscriptionPayload,
};
