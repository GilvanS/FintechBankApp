require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

(async () => {
  try {
    const cpf = '33333333333';
    const token = jwt.sign({ cpf, role: 'user', email: 'daniel@example.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    for (const type of ['aberta', 'fechada']) {
      const url = `http://localhost:3001/api/credit/invoices/summary/${type}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      console.log(`\n=== SUMMARY ${type.toUpperCase()} ===`);
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    console.error('Erro:', e);
  } finally {
    process.exit(0);
  }
})();