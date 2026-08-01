require('dotenv').config();
const fetch = require('node-fetch');

(async () => {
  try {
    const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcGYiOiI5OTk5OTk5OTk5OSIsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AZmludGVjaGJhbmsuY29tIiwiaWF0IjoxNzg0OTg5OTgxLCJleHAiOjE3ODUwMTg3ODF9.RxfXaCTOtVAp2n0ydSroyg2XoJp_JTQue1ViwuI3Yj0'; // token do admin 99999999999
    const cpf = '33333333333';
    const url = `http://localhost:3001/api/admin/users/${cpf}`;

    console.log('[scratch_fetch_user_admin] Buscando dados do usuário via admin...');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('[scratch_fetch_user_admin] Resultado:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('[scratch_fetch_user_admin] Erro:', e);
  } finally {
    process.exit(0);
  }
})();