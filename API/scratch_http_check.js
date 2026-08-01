require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');
const CPF = process.argv[2] || '11111111111';
const token = jwt.sign({ cpf: CPF }, process.env.JWT_SECRET, { expiresIn: '1h' });
function get(path){return new Promise((resolve,reject)=>{const req=http.request({host:'localhost',port:3001,path,method:'GET',headers:{Authorization:'Bearer '+token}},res=>{let s='';res.on('data',d=>s+=d);res.on('end',()=>resolve(s));});req.on('error',reject);req.end();});}
(async()=>{
  const ab = JSON.parse(await get('/api/credit/invoices/summary/aberta'));
  const fe = JSON.parse(await get('/api/credit/invoices/summary/fechada'));
  const u = JSON.parse(await get('/api/users/' + CPF));
  const cc = u.creditCard || (u.user&&u.user.creditCard) || {};
  console.log('ABERTA summary:', JSON.stringify(ab.summary));
  console.log('FECHADA summary:', JSON.stringify(fe.summary));
  console.log('creditCard canon:', JSON.stringify({currentInvoice:cc.currentInvoice,closedInvoice:cc.closedInvoice,daysOverdue:cc.daysOverdue,closedInvoiceTotal:cc.closedInvoiceTotal,currentInvoiceTotal:cc.currentInvoiceTotal,currentInvoiceMinimo:cc.currentInvoiceMinimo,charges:cc.closedInvoiceCharges}));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
