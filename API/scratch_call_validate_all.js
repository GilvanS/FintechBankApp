require('dotenv').config();
const fetch = require('node-fetch');

(async () => {
  try {
    const adminToken = process.env.ADMIN_TOKEN || 'admin999'; // token do admin 99999999999
    const url = 'http://localhost:3001/admin/billing/validate-all';

    console.log('[scratch_call_validate_all] Chamando validação de faturamento...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('[scratch_call_validate_all] Resultado:', result);
  } catch (e) {
    console.error('[scratch_call_validate_all] Erro:', e);
  } finally {
    process.exit(0);
  }
})();