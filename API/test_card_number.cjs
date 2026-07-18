// Testa geração de número de cartão na ativação
const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3001, path: `/api${path}`, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('\n=== TESTE: Geração de Número de Cartão ===\n');

  // Login com Wade (CPF: 12464865954 / senha: admin999)
  // Wade JÁ ativou o cartão, então vamos usar outra massa que ainda não ativou
  // Vamos testar com Jean Sousa (33333333333 / 12345678)
  
  console.log('1. Login com Jean Sousa (33333333333)...');
  const login = await req('POST', '/auth/login', { cpf: '33333333333', password: '12345678' });
  if (!login.body.token) { console.log('❌ Login falhou:', login.body); return; }
  const token = login.body.token;
  console.log('   ✅ Login OK\n');

  // Ativar cartão (CVV = 333, Validade = 06/31)
  console.log('2. Ativando cartão com CVV=333, Validade=06/31...');
  const activate = await req('POST', '/cards/physical/activate', { cvv: '333', expiry: '06/31' }, token);
  console.log(`   Status: ${activate.status}`);
  if (activate.body.success) {
    console.log('   ✅ ATIVAÇÃO OK!');
    console.log('   Número gerado :', activate.body.card?.number);
    console.log('   Validade       :', activate.body.card?.expiry);
    console.log('   CVV            :', activate.body.card?.cvv);
    console.log('   PIN            :', activate.body.card?.pin);
    console.log('   Bandeira       :', activate.body.card?.brand);
  } else {
    console.log('   ❌ Erro:', activate.body.message);
  }

  // Listar cartões
  console.log('\n3. Listando cartões do usuário...');
  const myCards = await req('GET', '/cards/my-cards', null, token);
  console.log(`   Status: ${myCards.status}`);
  if (myCards.body.cards) {
    myCards.body.cards.forEach((c, i) => {
      console.log(`\n   Cartão #${i+1}:`);
      console.log(`   Número  : ${c.number}`);
      console.log(`   Mascarado: ${c.numberMasked}`);
      console.log(`   Tipo    : ${c.type}`);
      console.log(`   Validade: ${c.expiry}`);
      console.log(`   CVV     : ${c.cvv}`);
      console.log(`   PIN     : ${c.pin}`);
    });
  }

  // Gerar cartão virtual
  console.log('\n4. Gerando cartão virtual...');
  const virtual = await req('POST', '/cards/virtual/generate', { nickname: 'Meu Cartão Online' }, token);
  console.log(`   Status: ${virtual.status}`);
  if (virtual.body.success) {
    console.log('   ✅ VIRTUAL OK!');
    console.log('   Número    :', virtual.body.card?.number);
    console.log('   Mascarado :', virtual.body.card?.numberMasked);
    console.log('   CVV       :', virtual.body.card?.cvv);
    console.log('   Nickname  :', virtual.body.card?.nickname);
  } else {
    console.log('   ❌ Erro:', virtual.body.message);
  }

  console.log('\n=== FIM ===\n');
}

main().catch(e => console.error('Erro:', e.message));
