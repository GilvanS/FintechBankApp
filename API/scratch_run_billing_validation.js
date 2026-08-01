require('dotenv').config();
const { runBillingValidation } = require('./index.cjs');

(async () => {
  try {
    console.log('[scratch_run_billing_validation] Iniciando validação de faturamento...');
    const result = await runBillingValidation();
    console.log('[scratch_run_billing_validation] Resultado:', result);
  } catch (e) {
    console.error('[scratch_run_billing_validation] Erro:', e);
  } finally {
    process.exit(0);
  }
})();