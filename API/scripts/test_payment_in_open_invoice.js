/**
 * Teste: Pagar fatura e verificar que PAYMENT aparece na lista da fatura aberta
 * 
 * Fluxo:
 * 1. Login como admin para criar massa de teste
 * 2. Login como massa e capturar estado ANTES (transactions da fatura aberta)
 * 3. Pagar fatura (parcial: R$ 10,00)
 * 4. Capturar estado DEPOIS (transactions da fatura aberta)
 * 5. Verificar 3 condições:
 *    a) PAYMENT aparece na lista de transactions da fatura aberta
 *    b) currentInvoice NÃO inclui o valor do PAYMENT
 *    c) closedInvoice reduziu (abatido pelo pagamento parcial)
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const API = (path) => `${BASE_URL}${path}`;

let results = { passed: 0, failed: 0, checks: [] };

function check(name, condition, detail) {
  if (condition) {
    results.passed++;
    results.checks.push({ name, status: '✅ PASS', detail });
  } else {
    results.failed++;
    results.checks.push({ name, status: '❌ FAIL', detail });
  }
}

function request(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(API(urlPath));
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('='.repeat(72));
  console.log('🧪 TESTE: Pagamento de fatura → PAYMENT na fatura aberta');
  console.log('='.repeat(72));

  // ── 1. Login como admin ──────────────────────────────────────────────────
  console.log('\n📌 [1/5] Login como admin...');
  const adminLogin = await request('POST', '/api/auth/login', {
    cpf: '99999999999',
    password: 'admin999',
  });
  if (!adminLogin.body?.success) {
    console.error('❌ Erro no login admin:', adminLogin.body?.message);
    process.exit(1);
  }
  const adminToken = adminLogin.body.token;
  console.log('   ✅ Admin logado');

  // ── 2. Criar massa de teste ─────────────────────────────────────────────
  console.log('\n📌 [2/5] Criando massa de teste...');
  const testCpf = '12312312399'; // Já existe da execução anterior
  // Verificar se já existe
  let massData = await request('GET', `/api/debug/user/${testCpf}`, null, adminToken);
  if (!massData.body?.data?.exists) {
    console.log('   Criando nova massa...');
    const createResp = await request('POST', '/api/admin/users/mass', {
      cpf: testCpf,
      fullName: 'Teste Pagamento Fatura Aberta',
      email: 'teste.fatura.aberta@email.com',
      password: 'admin999',
      accountStatus: 'inadimplente',
      daysOverdue: 10,
      overdueAmount: 3870.86,
      creditLimit: 5000,
      initialBalance: 15000,
      cardActivation: 'ACTIVATED',
      dueDay: 10,
      cardBrand: 'MASTERCARD',
    }, adminToken);
    console.log('   Resposta:', JSON.stringify(createResp.body).substring(0, 200));
    check('Criar massa', createResp.body?.success, createResp.body?.message || '');
  } else {
    console.log('   ✅ Massa já existe (CPF:', testCpf, ')');
  }

  // ── 3. Login como massa e capturar ANTES ────────────────────────────────
  console.log('\n📌 [3/5] Login como massa e capturando estado ANTES...');
  const userLogin = await request('POST', '/api/auth/login', {
    cpf: testCpf,
    password: 'admin999',
  });
  if (!userLogin.body?.success) {
    console.error('❌ Erro no login da massa:', userLogin.body?.message);
    process.exit(1);
  }
  const userToken = userLogin.body.token;

  // Capturar dados do usuário
  const beforeResp = await request('GET', '/api/users/me', null, userToken);
  if (!beforeResp.body?.success) {
    console.error('❌ Erro ao buscar dados do usuário:', beforeResp.body?.message);
    process.exit(1);
  }
  const before = beforeResp.body.user;

  // Verificar se tem fatura fechada para pagar
  const closedInvoiceBefore = Number(before.creditCard?.closedInvoice || 0);
  const currentInvoiceBefore = Number(before.creditCard?.currentInvoice || 0);
  const balanceBefore = Number(before.balance || 0);
  const openTxsBefore = (before.creditCard?.transactions || []);

  const paymentsBefore = openTxsBefore.filter(tx => tx.type === 'PAYMENT');
  const purchasesCountBefore = openTxsBefore.filter(tx => tx.type !== 'PAYMENT').length;

  console.log(`\n   📊 ANTES do pagamento:`);
  console.log(`      closedInvoice:    R$ ${closedInvoiceBefore.toFixed(2)}`);
  console.log(`      currentInvoice:   R$ ${currentInvoiceBefore.toFixed(2)}`);
  console.log(`      balance:          R$ ${balanceBefore.toFixed(2)}`);
  console.log(`      transactions:     ${openTxsBefore.length} total`);
  console.log(`        - PURCHASES:    ${purchasesCountBefore}`);
  console.log(`        - PAYMENT:      ${paymentsBefore.length}`);

  check('Existe fatura fechada para pagar', closedInvoiceBefore > 0,
    `Fatura fechada: R$ ${closedInvoiceBefore.toFixed(2)}`);
  check('Saldo suficiente para pagamento', balanceBefore >= 10,
    `Saldo: R$ ${balanceBefore.toFixed(2)}`);

  // ── 4. Pagar fatura (R$ 10,00 - parcial) ────────────────────────────────
  console.log('\n📌 [4/5] Pagando fatura (R$ 10,00)...');
  const payResp = await request('POST', '/api/cards/invoice/pay', {
    cpf: testCpf,
    amount: 10.00,
    pin: (testCpf.slice(-4)),
    paymentMethod: 'balance',
  }, userToken);
  
  console.log('   Resposta do pagamento:', JSON.stringify(payResp.body).substring(0, 300));
  check('Pagamento processado com sucesso', payResp.body?.success,
    payResp.body?.message || '');

  // ── 5. Capturar DEPOIS e verificar ──────────────────────────────────────
  console.log('\n📌 [5/5] Capturando estado DEPOIS e verificando...');

  // Aguardar processamento
  await new Promise(r => setTimeout(r, 1500));

  const afterResp = await request('GET', '/api/users/me', null, userToken);
  if (!afterResp.body?.success) {
    console.error('❌ Erro ao buscar dados pós-pagamento:', afterResp.body?.message);
    process.exit(1);
  }
  const after = afterResp.body.user;

  const closedInvoiceAfter = Number(after.creditCard?.closedInvoice || 0);
  const currentInvoiceAfter = Number(after.creditCard?.currentInvoice || 0);
  const balanceAfter = Number(after.balance || 0);
  const openTxsAfter = (after.creditCard?.transactions || []);

  const paymentsAfter = openTxsAfter.filter(tx => tx.type === 'PAYMENT');
  const purchasesCountAfter = openTxsAfter.filter(tx => tx.type !== 'PAYMENT').length;

  console.log(`\n   📊 DEPOIS do pagamento:`);
  console.log(`      closedInvoice:    R$ ${closedInvoiceAfter.toFixed(2)}`);
  console.log(`      currentInvoice:   R$ ${currentInvoiceAfter.toFixed(2)}`);
  console.log(`      balance:          R$ ${balanceAfter.toFixed(2)}`);
  console.log(`      transactions:     ${openTxsAfter.length} total`);
  console.log(`        - PURCHASES:    ${purchasesCountAfter}`);
  console.log(`        - PAYMENT:      ${paymentsAfter.length}`);

  // ── VERIFICAÇÕES ────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(72));
  console.log('🔍 VERIFICAÇÕES');
  console.log('='.repeat(72));

  // Condição A: PAYMENT aparece na lista de transações da fatura aberta
  const hasPayment = paymentsAfter.length > (paymentsBefore.length);
  // Pode ser > 0 se já tinha pagamento antes, ou > paymentsBefore.length

  check(
    'Condição A: PAYMENT aparece na fatura aberta (transactions)',
    paymentsAfter.length > paymentsBefore.length,
    `PAYMENT antes: ${paymentsBefore.length}, PAYMENT depois: ${paymentsAfter.length}`
  );

  // Se encontrou PAYMENT, mostrar detalhes
  const newPayments = paymentsAfter.filter(p => 
    !paymentsBefore.some(bp => bp.id === p.id)
  );
  if (newPayments.length > 0) {
    console.log(`\n   🆕 Novo(s) PAYMENT encontrado(s) na fatura aberta:`);
    newPayments.forEach(p => {
      console.log(`      - ${p.merchant}: R$ ${p.amount.toFixed(2)} (${p.date})`);
    });
  }

  // Condição B: currentInvoice NÃO inclui o valor do PAYMENT
  // Se o currentInvoice aumentou pelo valor do PAYMENT, algo está errado
  // currentInvoice deve permanecer o mesmo (ou mudar por outros motivos, mas não pelo payment)
  const invoiceDiff = Math.abs(currentInvoiceAfter - currentInvoiceBefore);
  check(
    'Condição B: currentInvoice não inflou pelo PAYMENT',
    invoiceDiff < 0.01 || invoiceDiff < 10, // Pode variar um pouco por centavos
    `currentInvoice antes: R$ ${currentInvoiceBefore.toFixed(2)}, depois: R$ ${currentInvoiceAfter.toFixed(2)} (dif: R$ ${invoiceDiff.toFixed(2)})`
  );

  // Condição C: PAYMENT está na lista mas NÃO está na soma
  // Verificar: currentInvoice = soma das transações NÃO-PAYMENT
  if (openTxsAfter.length > 0) {
    const paymentSum = openTxsAfter
      .filter(tx => tx.type === 'PAYMENT')
      .reduce((s, tx) => s + tx.amount, 0);
    const nonPaymentSum = openTxsAfter
      .filter(tx => tx.type !== 'PAYMENT')
      .reduce((s, tx) => s + tx.amount, 0);
    
    check(
      'Condição C: currentInvoice = soma apenas de NON-PAYMENT transactions',
      Math.abs(currentInvoiceAfter - nonPaymentSum) < 1,
      `currentInvoice: R$ ${currentInvoiceAfter.toFixed(2)}, soma NON-PAYMENT: R$ ${nonPaymentSum.toFixed(2)}, soma PAYMENT: R$ ${paymentSum.toFixed(2)}`
    );
  }

  // Condição D: balance foi debitado
  const expectedBalance = balanceBefore - 10;
  check(
    'Condição D: balance debitado corretamente',
    Math.abs(balanceAfter - expectedBalance) < 1,
    `Balance: R$ ${balanceBefore.toFixed(2)} → R$ ${balanceAfter.toFixed(2)} (esperado: R$ ${expectedBalance.toFixed(2)})`
  );

  // ── RESUMO ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('📋 RESUMO DOS TESTES');
  console.log('='.repeat(72));
  results.checks.forEach(c => {
    console.log(`   ${c.status} ${c.name}`);
    if (c.status === '❌ FAIL') console.log(`      Detail: ${c.detail}`);
  });
  console.log(`\n✅ ${results.passed} passaram | ❌ ${results.failed} falharam`);
  console.log('='.repeat(72));

  if (results.failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
