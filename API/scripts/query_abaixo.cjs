const http = require('http');
function api(path, m, body) {
  return new Promise((resolve,reject)=>{
    const opts={hostname:'127.0.0.1',port:3001,path:path,method:m||'GET',headers:{'Content-Type':'application/json'}};
    const req=http.request(opts,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{resolve(JSON.parse(d))}catch(e){resolve({raw:d})}})});
    req.on('error',reject);
    if(body) req.write(JSON.stringify(body));
    req.end();
  });
}
async function main(){
  const login = await api('/api/auth/login','POST',{cpf:'99999999999',password:'admin999'});
  if(!login||!login.token){console.log('LOGIN_FAIL');return;}
  const dash = await api('/api/admin/overdue-masses-dashboard','GET',null);
  if(!dash||!dash.success){console.log('DASH_FAIL');return;}
  const masses = dash.overdueMasses||[];
  const abaixo = masses.filter(m=>{const ps=m.paymentSummary||{};return ps.statusMinimo==='ABAIXO';});
  const acima = masses.filter(m=>{const ps=m.paymentSummary||{};return ps.statusMinimo==='ACIMA';});
  const semPag = masses.filter(m=>{const ps=m.paymentSummary||{};return !ps.statusMinimo||ps.statusMinimo==='SEM_PAG';});
  console.log('');
  console.log('=== PAINEL DE MASSAS - FILTRO POR STATUS MIN. ===');
  console.log(''); console.log('Total massas:', masses.length); console.log('');
  console.log('--- ABAIXO DO MINIMO --- '+String(abaixo.length)+' massa(s)');
  console.log('');
  abaixo.forEach(function(m,i){
    var ps=m.paymentSummary||{}; var fat=m.faturaFechada||0;
    var pct = fat>0 ? Math.round(((ps.totalPago||0)/fat)*10000)/100 : 0;
    var min = Math.round(fat*0.10*100)/100;
    var deficit = Math.round((min-(ps.totalPago||0))*100)/100;
    console.log('  '+(i+1)+'. '+m.fullName+' ('+m.cpf+')');
    console.log('     Fatura: R$ '+fat.toFixed(2)+' | Pago: R$ '+(ps.totalPago||0).toFixed(2)+' | '+pct+'%');
    console.log('     Minimo 10%: R$ '+min.toFixed(2)+' | Deficit: R$ '+deficit.toFixed(2));
    var hist = m.paymentHistory||[];
    if(hist.length>0){
      var ult = hist[hist.length-1];
      console.log('     Ult. pagamento: R$ '+ult.amount.toFixed(2)+' em '+(ult.date||'').split('T')[0]+' ('+ult.paymentType+')');
    }
    console.log('');
  });
  console.log('--- ACIMA DO MINIMO --- '+String(acima.length)+' massa(s)');
  acima.forEach(function(m,i){
    var ps=m.paymentSummary||{}; var fat=m.faturaFechada||0;
    console.log('  '+(i+1)+'. '+m.fullName+' R$ '+(ps.totalPago||0).toFixed(2)+' pago de R$ '+fat.toFixed(2));
  });
  console.log('');
  console.log('--- SEM PAGAMENTO --- '+String(semPag.length)+' massa(s)');
  console.log('');
  console.log('=== CHIPS DISPONIVEIS NO PAINEL ===');
  console.log('  [Todos]    - '+masses.length+' massas (padrao)');
  console.log('  [Abaixo]   - '+String(abaixo.length)+' massas criticas');
  console.log('  [Acima]    - '+String(acima.length)+' massas OK');
  console.log('  [Sem Pag.] - '+String(semPag.length)+' massas sem pagamento');
}
main();
