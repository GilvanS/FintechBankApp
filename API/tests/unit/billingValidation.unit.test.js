const billingValidation = require('../../services/billingValidation');

describe('Task 0 — billingValidation Service', () => {
  test('deve exportar runBillingValidation e syncInvoiceDiasAtraso', () => {
    expect(typeof billingValidation.runBillingValidation).toBe('function');
    expect(typeof billingValidation.syncInvoiceDiasAtraso).toBe('function');
  });
});