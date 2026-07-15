// Testa login + ativação com conta Gilvan (11111111111 / 12345678)
const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function testActivation(cpf, password, cvv, expiry, label) {
  console.log(`\n${'='.repeat(55)}`);
  console.log(`TESTE: ${label}`);
  console.log(`CPF: ${cpf} | CVV: ${cvv} | Validade: ${expiry}`);
  console.log('='.repeat(55));

  const login = await req('POST', '/auth/login', { cpf, password });
  if (login.status !== 200 || !login.body.token) {
    console.log('❌ Login FALHOU:', login.status, login.body.message);
    return;
  }
  const token = login.body.token;
  console.log('✅ Login OK');

  const profile = await req('GET', '/auth/profile', null, token);
  const cc = profile.body.user?.creditCard;
  console.log(`\n📋 Estado ANTES da ativação:`);
  console.log(`   deliveryStatus : ${cc?.deliveryStatus}`);
  console.log(`   isActivated    : ${cc?.isActivated}`);
  console.log(`   profileMessage : ${profile.body.user?.profileMessage}`);

  console.log(`\n🔑 Enviando POST /cards/physical/activate com {cvv:"${cvv}", expiry:"${expiry}"}...`);
  const activate = await req('POST', '/cards/physical/activate', { cvv, expiry }, token);
  console.log(`   HTTP Status  : ${activate.status}`);
  console.log(`   success      : ${activate.body.success}`);
  console.log(`   message      : ${activate.body.message}`);

  if (activate.status === 200) {
    const profile2 = await req('GET', '/auth/profile', null, token);
    const cc2 = profile2.body.user?.creditCard;
    console.log(`\n✅ APÓS ATIVAÇÃO:`);
    console.log(`   deliveryStatus : ${cc2?.deliveryStatus}`);
    console.log(`   isActivated    : ${cc2?.isActivated}`);
  }
}

async function main() {
  // Teste 1: Conta Gilvan (senha conhecida)
  await testActivation('11111111111', '12345678', '111', '06/31', 'Gilvan Sousa');
  
  // Teste 2: Conta Sheila (senha conhecida)
  await testActivation('22222222222', '12345678', '222', '06/31', 'Sheila Sousa');

  console.log('\n\n📌 RESULTADO DO DIAGNÓSTICO:');
  console.log('Se os testes acima passaram, a API de ativação está funcionando corretamente.');
  console.log('O problema com Wade (12464865954) é apenas a SENHA — ela é diferente de 12345678.');
  console.log('\n💡 SOLUÇÃO: Resetar senha do Wade para 12345678 via script de migração.');
}

main().catch(e => console.error('Erro fatal:', e.message));
