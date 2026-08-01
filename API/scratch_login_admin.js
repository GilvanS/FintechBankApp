require('dotenv').config();
const fetch = require('node-fetch');

(async () => {
  try {
    const url = 'http://localhost:3001/auth/login';
    const body = {
      cpf: '99999999999',
      password: 'admin999'
    };

    console.log('[scratch_login_admin] Fazendo login do admin...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    if (result.success) {
      console.log('[scratch_login_admin] Login bem-sucedido. Token:', result.token);
    } else {
      console.log('[scratch_login_admin] Falha no login:', result);
    }
  } catch (e) {
    console.error('[scratch_login_admin] Erro:', e);
  } finally {
    process.exit(0);
  }
})();