/**
 * Teste Unitário - Lógica de Assinaturas (datas de cobrança, elegibilidade, validação)
 */
const {
    computeNextBillingDate,
    isSubscriptionDue,
    validateSubscriptionPayload,
    isValidFrequency,
    isValidPaymentMethod,
} = require('../utils/subscriptions');

describe('subscriptions - computeNextBillingDate', () => {
    test('monthly avança 1 mês', () => {
        const next = computeNextBillingDate('monthly', new Date('2026-01-15T00:00:00Z'));
        expect(next.getUTCMonth()).toBe(1); // fevereiro (0-based)
    });
    test('yearly avança 1 ano', () => {
        const from = new Date('2026-03-10T00:00:00Z');
        const next = computeNextBillingDate('yearly', from);
        expect(next.getFullYear()).toBe(from.getFullYear() + 1);
    });
    test('frequência desconhecida cai no comportamento mensal', () => {
        const next = computeNextBillingDate('weekly', new Date('2026-01-15T00:00:00Z'));
        expect(next.getUTCMonth()).toBe(1);
    });
});

describe('subscriptions - isSubscriptionDue', () => {
    const now = new Date('2026-07-19T12:00:00Z');
    test('vencida e ativa → deve cobrar', () => {
        const sub = { status: 'active', next_billing_date: '2026-07-18T00:00:00Z' };
        expect(isSubscriptionDue(sub, now)).toBe(true);
    });
    test('futura → não cobra', () => {
        const sub = { status: 'active', next_billing_date: '2026-08-01T00:00:00Z' };
        expect(isSubscriptionDue(sub, now)).toBe(false);
    });
    test('cancelada → nunca cobra', () => {
        const sub = { status: 'cancelled', next_billing_date: '2026-07-01T00:00:00Z' };
        expect(isSubscriptionDue(sub, now)).toBe(false);
    });
    test('idempotência: já cobrada hoje → não cobra de novo', () => {
        const sub = {
            status: 'active',
            next_billing_date: '2026-07-18T00:00:00Z',
            last_billing_date: '2026-07-19T03:00:00Z',
        };
        expect(isSubscriptionDue(sub, now)).toBe(false);
    });
    test('cobrada ontem → cobra hoje se vencida', () => {
        const sub = {
            status: 'active',
            next_billing_date: '2026-07-19T00:00:00Z',
            last_billing_date: '2026-07-18T03:00:00Z',
        };
        expect(isSubscriptionDue(sub, now)).toBe(true);
    });
    test('next_billing_date inválida → não cobra', () => {
        expect(isSubscriptionDue({ status: 'active', next_billing_date: 'xxx' }, now)).toBe(false);
    });
});

describe('subscriptions - validação', () => {
    test('payload válido não tem erros', () => {
        expect(validateSubscriptionPayload({ name: 'Netflix', amount: 55.9, frequency: 'monthly', payment_method: 'credit' })).toEqual([]);
    });
    test('amount <= 0 é rejeitado', () => {
        const errs = validateSubscriptionPayload({ name: 'X', amount: 0, frequency: 'monthly', payment_method: 'credit' });
        expect(errs.length).toBeGreaterThan(0);
    });
    test('frequency e payment_method fora da whitelist são rejeitados', () => {
        const errs = validateSubscriptionPayload({ name: 'X', amount: 10, frequency: 'weekly', payment_method: 'pix' });
        expect(errs).toEqual(expect.arrayContaining([
            expect.stringContaining('Frequência'),
            expect.stringContaining('Forma de pagamento'),
        ]));
    });
    test('helpers de whitelist', () => {
        expect(isValidFrequency('yearly')).toBe(true);
        expect(isValidFrequency('daily')).toBe(false);
        expect(isValidPaymentMethod('debit')).toBe(true);
        expect(isValidPaymentMethod('boleto')).toBe(false);
    });
});
