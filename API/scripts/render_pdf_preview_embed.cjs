#!/usr/bin/env node
/**
 * render_pdf_preview_embed.cjs
 * Lê os 5 PDFs gerados por render_pdf_preview.cjs, converte para base64 e
 * gera UM único HTML auto-contido (sem arquivos irmãos) que o servidor de
 * preview consegue servir.
 *
 * Saída: .freebuff/pdf-preview/index-embed.html
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '..', '.freebuff', 'pdf-preview');
// ── FATURA UNIVERSAL (novo — Fintech Bank 598, 4 páginas) ──
const UNIVERSAL = [
    { file: 'fatura_universal_FECHADA_EM_ABERTO.pdf', title: '1 · FATURA UNIVERSAL — Fechada EM ABERTO', badge: 'UNIVERSAL • 4 PÁGINAS', cls: 'b-rose', paginas: 'Resumo + Movimentações + Parcelas/Opções + BOLETO' },
    { file: 'fatura_universal_FECHADA_PAGA.pdf', title: '2 · FATURA UNIVERSAL — Fechada PAGA ✅', badge: 'UNIVERSAL • 4 PÁGINAS', cls: 'b-green', paginas: 'Resumo + Movimentações + Parcelas/Opções + BOLETO' },
    { file: 'fatura_universal_ABERTA_PAGA.pdf', title: '3 · FATURA UNIVERSAL — Aberta (herança PAGA)', badge: 'UNIVERSAL • 4 PÁGINAS', cls: 'b-blue', paginas: 'Resumo + Movimentações + Parcelas/Opções + BOLETO' },
];

// ── Layout legado (diagnóstico de 1 página — mantido para comparação) ──
const LEGACY = [
    { file: 'fatura_fechada_EM_ABERTO.pdf', title: '4 · Diagnóstico — Fechada EM ABERTO (legado)', badge: 'LEGADO • 1 PÁGINA', cls: 'b-zinc' },
    { file: 'fatura_fechada_PAGA.pdf', title: '5 · Diagnóstico — Fechada PAGA ✅ (legado)', badge: 'LEGADO • 1 PÁGINA', cls: 'b-zinc' },
    { file: 'fatura_aberta_PAGA.pdf', title: '6 · Diagnóstico — Aberta (legado)', badge: 'LEGADO • 1 PÁGINA', cls: 'b-zinc' },
];

const FILES = [...UNIVERSAL, ...LEGACY];

const cards = FILES.map(f => {
    const b64 = fs.readFileSync(path.join(OUT_DIR, f.file)).toString('base64');
    return `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>${f.title}</h2>
          ${f.paginas ? `<div class="paginas">${f.paginas}</div>` : ''}
        </div>
        <span class="badge ${f.cls}">${f.badge}</span>
      </div>
      <embed class="pdf-frame" src="data:application/pdf;base64,${b64}" type="application/pdf" title="${f.title}">
    </div>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview — PDFs Faturas &amp; Comprovantes</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #111318; color: #e5e7eb; font-family: 'Segoe UI', system-ui, sans-serif; padding: 24px; }
  h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; color: #fff; }
  h1 span { color: #f59e0b; }
  .sub { color: #9ca3af; font-size: 13px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 20px; }
  .card { background: #1a1d24; border: 1px solid #2a2e38; border-radius: 12px; overflow: hidden; }
  .card-head { padding: 12px 16px; border-bottom: 1px solid #2a2e38; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .card-head h2 { font-size: 14px; font-weight: 700; }
  .badge { font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 3px 8px; border-radius: 99px; letter-spacing: .5px; white-space: nowrap; }
  .b-amber { background: #f59e0b22; color: #f59e0b; border: 1px solid #f59e0b55; }
  .b-green { background: #22c55e22; color: #22c55e; border: 1px solid #22c55e55; }
  .b-blue { background: #3b82f622; color: #60a5fa; border: 1px solid #3b82f655; }
  .b-purple { background: #a855f722; color: #c084fc; border: 1px solid #a855f755; }
  .b-rose { background: #f43f5e22; color: #fb7185; border: 1px solid #f43f5e55; }
  .pdf-frame { width: 100%; height: 620px; border: 0; background: #fff; display: block; }
  .note { margin-top: 18px; padding: 12px 16px; background: #1a1d24; border: 1px solid #2a2e38; border-radius: 10px; font-size: 12.5px; color: #9ca3af; line-height: 1.6; }
  .note b { color: #e5e7eb; }
  .b-zinc { background: #71717a22; color: #a1a1aa; border: 1px solid #71717a55; }
  .paginas { font-size: 11px; color: #9ca3af; font-weight: 500; }
  .grid-universal { grid-template-columns: repeat(auto-fit, minmax(520px, 1fr)); }
</style>
</head>
<body>
  <h1>Preview dos PDFs — <span>Fatura Universal × Diagnóstico Legado</span></h1>
  <p class="sub">Nova FATURA UNIVERSAL (4 páginas, Fintech Bank 598: Resumo • Movimentações • Parcelas/Opções • BOLETO BANCÁRIO) gerada pelo <code>invoicePdfService.js</code> — comparada ao layout legado de 1 página. Dados da massa Chloe Dubois (015.653.661-74)</p>

  <div class="grid grid-universal">${cards}
  </div>

  <div class="note">
    <b>Nota:</b> Cards <b>1–3</b> são a nova <b>FATURA UNIVERSAL</b> (4 páginas, Fintech Bank 598) gerada pelo <code>invoicePdfService.js</code> — mesma lógica que a rota <code>send-pdf</code> passará a usar: Pág. 1 resumo + box total + limites + encargos, Pág. 2 movimentações (compras), Pág. 3 parcelas futuras + opções de pagamento + PIX, Pág. 4 <b>boleto bancário completo</b> (Recibo do Pagador + Ficha de Compensação + código de barras real com DV módulo 11). Cards <b>4–6</b> são o layout legado de 1 página, mantidos para comparação. Dados reais da massa Chloe: fechada R$ 3.870,86 PAGA em 05/ago; compras R$ 629,52; encargos herdados R$ 1.349,59; aberta R$ 1.979,11.
  </div>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT_DIR, 'index-embed.html'), html);
console.log('✅ index-embed.html gerado com os 5 PDFs embutidos em base64');
