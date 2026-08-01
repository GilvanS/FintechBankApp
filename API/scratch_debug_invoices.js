require('dotenv').config();
const PostgresProvider = require('./services/database/PostgresProvider.js');
const usersRepo = require('./repositories/usersRepo.js');
(async () => {
  const config = { schema: process.env.DB_SCHEMA || 'fintech', host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 5432, user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || 'pwd123', database: process.env.DB_NAME || 'fintechbank' };
  const provider = new PostgresProvider(config);
  await provider.connect();
  const cpf = process.argv[2] || '33333333333';
  try {
    if (process.argv[3] === 'regen') {
      const q = (s)=>provider.executeQuery(s);
      const ur = (await q(`SELECT credit_card_total_limit FROM fintech.users WHERE cpf='${cpf}'`))[0];
      const limit = parseFloat(ur.credit_card_total_limit||5000);
      await q(`DELETE FROM fintech.billing_charges WHERE cpf='${cpf}'`);
      await q(`DELETE FROM fintech.installment_plans WHERE cpf='${cpf}'`);
      await q(`DELETE FROM fintech.invoices WHERE cpf='${cpf}'`);
      await q(`DELETE FROM fintech.transactions WHERE cpf='${cpf}' AND type IN ('SHOP_CREDIT','CREDIT','INVOICE_INSTALLMENT','INVOICE_PAYMENT','INVOICE_ANTICIPATION')`);
      await q(`UPDATE fintech.users SET credit_card_available_limit=${limit.toFixed(2)} WHERE cpf='${cpf}'`);
      await usersRepo.seedMassBilling(provider, cpf, { accountStatus:'inadimplente', daysOverdue:9, overdueAmount:3870.86, creditLimit: limit });
      console.log('*** REGEN', cpf, 'done (wiped + seeded) ***\n');
    }
    const u = (await provider.executeQuery(`SELECT cpf, account_status, credit_card_invoice_due_date, credit_card_due_day, credit_card_is_blocked FROM fintech.users WHERE cpf='${cpf}'`))[0];
    console.log('== USER', cpf, '=='); console.log(JSON.stringify(u));
    const inv = await provider.executeQuery(`SELECT id, status, due_date, valor_total, data_pagamento, dias_atraso FROM fintech.invoices WHERE cpf='${cpf}' ORDER BY due_date DESC`);
    console.log('== INVOICES (' + inv.length + ') ==');
    for (const r of inv) console.log('  #'+r.id+' '+r.status+' due='+(r.due_date && new Date(r.due_date).toISOString().slice(0,10))+' total='+r.valor_total+' pago='+(r.data_pagamento?'SIM':'nao')+' atraso='+r.dias_atraso);
    const tx = await provider.executeQuery(`SELECT id, type, amount, description, date FROM fintech.transactions WHERE cpf='${cpf}' AND type IN ('SHOP_CREDIT','CREDIT','INVOICE_INSTALLMENT','INVOICE_PAYMENT','INVOICE_ANTICIPATION') AND (status IS NULL OR status<>'cancelled') ORDER BY date DESC`);
    console.log('== CARD TX (' + tx.length + ') ==');
    for (const r of tx) console.log('  '+new Date(r.date).toISOString().slice(0,10)+' '+r.type.padEnd(20)+' '+String(r.amount).padStart(10)+'  '+(r.description||'').slice(0,40));
    const invoiceDue = u.credit_card_invoice_due_date ? new Date(u.credit_card_invoice_due_date) : null;
    let openDue = invoiceDue ? new Date(invoiceDue) : null; if (openDue) openDue.setUTCHours(23,59,59,999);
    let _closeMs=0,_prevCloseMs=0;
    if (openDue) { const cd=new Date(openDue); cd.setDate(cd.getDate()-7); _closeMs=cd.getTime(); const p=new Date(cd); p.setMonth(p.getMonth()-1); _prevCloseMs=p.getTime(); }
    const closedRow = inv.find(i => i.status==='FECHADA' && !i.data_pagamento && parseFloat(i.valor_total||0)>0);
    if (closedRow) { const cdue=new Date(closedRow.due_date); cdue.setUTCHours(23,59,59,999); const cut=new Date(cdue); cut.setDate(cut.getDate()-7); _prevCloseMs=cut.getTime(); }
    const maxDueTime = openDue ? openDue.getTime() : _closeMs;
    console.log('== WINDOWS ==');
    console.log('  invoiceDue(open) =', openDue && openDue.toISOString());
    console.log('  closedRow.due    =', closedRow && new Date(closedRow.due_date).toISOString());
    console.log('  OPEN window = (' + new Date(_prevCloseMs).toISOString().slice(0,10) + ' , ' + new Date(maxDueTime).toISOString().slice(0,10) + ']');
    const openTx = tx.filter(r => { const d=new Date(r.date).getTime(); return d>_prevCloseMs && d<=maxDueTime && (r.type==='CREDIT'||r.type==='SHOP_CREDIT'||r.type==='INVOICE_INSTALLMENT'); });
    const openSum = openTx.reduce((s,r)=>s+Math.abs(parseFloat(r.amount||0)),0);
    console.log('  OPEN tx count =', openTx.length, ' OPEN sum(currentInvoice) =', openSum.toFixed(2));
    console.log('  closedRow.valor_total =', closedRow && closedRow.valor_total);
  } catch(e){ console.error('ERR', e.message); } finally { process.exit(0); }
})();
