#!/usr/bin/env node
/**
 * run_audit_consistency_report.js
 *
 * Script standalone que:
 * 1. Conecta ao banco de dados
 * 2. Executa a auditoria de consistência (users.days_overdue × invoices.dias_atraso
 *    × real-time hoje)
 * 3. Gera um relatório HTML auto-contido em scripts/audit_report_*.html
 * 4. Exibe resumo no console
 *
 * Uso:
 *   node scripts/run_audit_consistency_report.js
 *   node scripts/run_audit_consistency_report.js --cpf=02816769844
 *   node scripts/run_audit_consistency_report.js --open   (abre no navegador)
 *   node scripts/run_audit_consistency_report.js --csv    (também gera CSV)
 *   node scripts/run_audit_consistency_report.js --csv --open
 *
 * npm:
 *   npm run audit:consistency
 *   npm run audit:report
 *   npm run audit:csv
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { esc } = require('../repositories/context');

// ─── CLI args ─────────────────────────────────────────────────────────────────
const FILTER_CPF = (process.argv.find(a => a.startsWith('--cpf=')) || '').replace('--cpf=', '').replace(/\D/g, '') || null;
const OPEN_BROWSER = process.argv.includes('--open');
const GENERATE_CSV = process.argv.includes('--csv');
const LIMIT = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
};

const fmtBr = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const fmtCpf = (c) => {
  if (!c || c.length !== 11) return c || '';
  return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9)}`;
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   FintechBank — Auditoria de Consistência                  ║');
  console.log('║   Relatório HTML automático                                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // ── 1. Conectar ──────────────────────────────────────────────────────────────
  console.log('[1/4] Conectando ao banco de dados...');
  const db = DatabaseFactory.create();
  await db.connect();
  const fq = t => db.fq(t);
  console.log('      ✅ Conectado.');

  try {
    // ── 2. Executar auditoria ──────────────────────────────────────────────────
    console.log('[2/4] Executando auditoria de consistência...');

    const sql = `
      SELECT u.cpf, u.full_name, u.account_status,
             COALESCE(u.days_overdue, 0) AS user_days_overdue,
             i.id AS invoice_id, i.due_date,
             COALESCE(i.dias_atraso, 0) AS invoice_dias_atraso,
             GREATEST(0, (CURRENT_DATE - i.due_date::date)) AS real_time_days
      FROM ${fq('users')} u
      JOIN ${fq('invoices')} i ON i.cpf = u.cpf
      WHERE i.status = 'FECHADA'
        AND i.data_pagamento IS NULL
        AND i.due_date < CURRENT_TIMESTAMP
        ${FILTER_CPF ? `AND u.cpf = ${esc(FILTER_CPF)}` : ''}
      ORDER BY u.full_name ASC
      LIMIT ${LIMIT}
    `;
    const rows = await db.executeQuery(sql);

    // ── 3. Processar resultados ────────────────────────────────────────────────
    console.log(`      ✅ ${rows.length} registro(s) retornado(s).`);
    console.log('[3/4] Processando dados...');

    const consistencyResults = [];
    const uniqueCpfs = new Set();
    const cpfComIssue = new Set();
    let invoiceOk = 0, invoiceDiff = 0;

    for (const r of rows || []) {
      uniqueCpfs.add(r.cpf);
      const ud = parseInt(r.user_days_overdue || 0);
      const rt = parseInt(r.real_time_days || 0);
      const invD = parseInt(r.invoice_dias_atraso || 0);
      const diffUser = ud - rt;
      const diffInvoice = invD - rt;

      const userConsistent = Math.abs(diffUser) <= 1;
      const invoiceConsistent = Math.abs(diffInvoice) <= 0;

      if (!userConsistent) cpfComIssue.add(r.cpf);
      if (invoiceConsistent) invoiceOk++;
      else invoiceDiff++;

      if (!userConsistent || !invoiceConsistent) {
        consistencyResults.push({
          cpf: r.cpf,
          name: r.full_name,
          status: r.account_status,
          dueDate: r.due_date,
          userDaysOverdue: ud,
          invoiceDiasAtraso: invD,
          realTimeDays: rt,
          diffUser,
          diffInvoice
        });
      }
    }

    const totalScanned = uniqueCpfs.size;
    const usersConsistent = uniqueCpfs.size - cpfComIssue.size;
    const usersDesatualizados = cpfComIssue.size;
    const totalInvoices = invoiceOk + invoiceDiff;

    // ── 4. Gerar relatório HTML ────────────────────────────────────────────────
    console.log('[4/4] Gerando relatório' + (GENERATE_CSV ? ' HTML + CSV...' : ' HTML...'));

    const timestamp = fmtDate();
    const filename = `audit_report_${timestamp}.html`;
    const filepath = path.join(__dirname, filename);

    // Estatísticas para o dashboard
    const pctUserConsistent = totalScanned > 0 ? Math.round((usersConsistent / totalScanned) * 100) : 0;
    const pctInvoiceConsistent = totalInvoices > 0 ? Math.round((invoiceOk / totalInvoices) * 100) : 0;

    // Tabela de detalhes
    let detailsRows = '';
    if (consistencyResults.length > 0) {
      for (const d of consistencyResults) {
        const userBad = Math.abs(d.diffUser) > 1;
        const invBad = Math.abs(d.diffInvoice) > 0;
        detailsRows += `
          <tr>
            <td class="cpf">${fmtCpf(d.cpf)}</td>
            <td>${d.name || '—'}</td>
            <td><span class="badge badge-${d.status === 'inadimplente' ? 'danger' : 'success'}">${d.status || 'adimplente'}</span></td>
            <td>${fmtBr(d.dueDate)}</td>
            <td class="${userBad ? 'diff-bad' : 'diff-ok'}">${d.userDaysOverdue}</td>
            <td class="${invBad ? 'diff-bad' : 'diff-ok'}">${d.invoiceDiasAtraso}</td>
            <td>${d.realTimeDays}</td>
            <td class="${userBad ? 'diff-bad' : 'diff-ok'}">${d.diffUser > 0 ? '+' : ''}${d.diffUser}</td>
            <td class="${invBad ? 'diff-bad' : 'diff-ok'}">${d.diffInvoice > 0 ? '+' : ''}${d.diffInvoice}</td>
          </tr>`;
      }
    } else {
      detailsRows = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#6b7280">✅ Nenhuma discrepância encontrada — todos os dados estão consistentes.</td></tr>`;
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório de Auditoria — Consistência</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a; color: #e2e8f0; padding: 2rem; min-height: 100vh;
  }
  .container { max-width: 1200px; margin: 0 auto; }
  h1 {
    font-size: 1.5rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.25rem;
    display: flex; align-items: center; gap: 0.75rem;
  }
  h1 span { background: #334155; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.7rem; font-weight: 500; color: #94a3b8; }
  .subtitle { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
  .grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem; margin-bottom: 2rem;
  }
  .card {
    background: #1e293b; border-radius: 12px; padding: 1.25rem;
    border-top: 3px solid #334155;
  }
  .card .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.5rem; }
  .card .value { font-size: 1.75rem; font-weight: 700; }
  .card.green { border-top-color: #22c55e; } .card.green .value { color: #4ade80; }
  .card.red { border-top-color: #ef4444; } .card.red .value { color: #f87171; }
  .card.amber { border-top-color: #f59e0b; } .card.amber .value { color: #fbbf24; }
  .card.blue { border-top-color: #3b82f6; } .card.blue .value { color: #60a5fa; }
  .card.cyan { border-top-color: #06b6d4; } .card.cyan .value { color: #22d3ee; }
  .card.purple { border-top-color: #a855f7; } .card.purple .value { color: #c084fc; }

  .charts { display: flex; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .chart-box { background: #1e293b; border-radius: 12px; padding: 1.5rem; flex: 1; min-width: 280px; text-align: center; }
  .chart-box h3 { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1rem; }
  .donut-wrap { position: relative; display: inline-block; }
  .donut-wrap svg { display: block; }
  .donut-center {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; pointer-events: none;
  }
  .donut-center .pct { font-size: 2rem; font-weight: 800; color: #f8fafc; }
  .donut-center .pct-label { font-size: 0.7rem; color: #64748b; }

  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th {
    background: #1e293b; color: #94a3b8; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; padding: 0.75rem 0.5rem; text-align: left;
    border-bottom: 2px solid #334155; position: sticky; top: 0;
  }
  td { padding: 0.65rem 0.5rem; border-bottom: 1px solid #1e293b; }
  tr:hover td { background: #1e293b; }
  .cpf { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.75rem; color: #60a5fa; }
  .badge {
    display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px;
    font-size: 0.7rem; font-weight: 600;
  }
  .badge-success { background: #166534; color: #4ade80; }
  .badge-danger { background: #7f1d1d; color: #fca5a5; }
  .badge-neutral { background: #334155; color: #94a3b8; }
  .diff-ok { color: #4ade80; }
  .diff-bad { color: #f87171; font-weight: 600; }

  .empty-state { text-align: center; padding: 3rem; background: #1e293b; border-radius: 12px; }
  .empty-state .icon { font-size: 3rem; margin-bottom: 0.75rem; }
  .empty-state p { color: #94a3b8; font-size: 0.9rem; }

  .footer { margin-top: 2rem; text-align: center; color: #475569; font-size: 0.75rem; }
  .footer a { color: #60a5fa; }
</style>
</head>
<body>
<div class="container">
  <h1>📊 Auditoria de Consistência</h1>
  <p class="subtitle">Gerado em ${new Date().toLocaleString('pt-BR')} ${FILTER_CPF ? `| CPF filtrado: ${fmtCpf(FILTER_CPF)}` : ''}</p>

  <!-- KPIs -->
  <div class="grid">
    <div class="card blue">
      <div class="label">Usuários Escaneados</div>
      <div class="value">${totalScanned}</div>
    </div>
    <div class="card green">
      <div class="label">Consistentes</div>
      <div class="value">${usersConsistent}</div>
    </div>
    <div class="card ${usersDesatualizados > 0 ? 'red' : 'green'}">
      <div class="label">Desatualizados</div>
      <div class="value">${usersDesatualizados}</div>
    </div>
    <div class="card cyan">
      <div class="label">Total Invoices</div>
      <div class="value">${totalInvoices}</div>
    </div>
    <div class="card green">
      <div class="label">Invoices OK</div>
      <div class="value">${invoiceOk}</div>
    </div>
    <div class="card ${invoiceDiff > 0 ? 'amber' : 'green'}">
      <div class="label">Invoices com Diferença</div>
      <div class="value">${invoiceDiff}</div>
    </div>
  </div>

  <!-- Donut Charts -->
  <div class="charts">
    <div class="chart-box">
      <h3>👤 Consistência de Usuários</h3>
      <div class="donut-wrap">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="70" fill="none" stroke="#334155" stroke-width="16"/>
          <circle cx="80" cy="80" r="70" fill="none" stroke="#4ade80" stroke-width="16"
            stroke-dasharray="${2 * Math.PI * 70}" stroke-dashoffset="${2 * Math.PI * 70 * (1 - pctUserConsistent / 100)}"
            stroke-linecap="round" transform="rotate(-90 80 80)" style="transition: stroke-dashoffset 1.2s ease"/>
        </svg>
        <div class="donut-center">
          <div class="pct">${pctUserConsistent}%</div>
          <div class="pct-label">consistentes</div>
        </div>
      </div>
    </div>
    <div class="chart-box">
      <h3>📄 Consistência de Invoices</h3>
      <div class="donut-wrap">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="70" fill="none" stroke="#334155" stroke-width="16"/>
          <circle cx="80" cy="80" r="70" fill="none" stroke="#4ade80" stroke-width="16"
            stroke-dasharray="${2 * Math.PI * 70}" stroke-dashoffset="${2 * Math.PI * 70 * (1 - pctInvoiceConsistent / 100)}"
            stroke-linecap="round" transform="rotate(-90 80 80)" style="transition: stroke-dashoffset 1.2s ease"/>
        </svg>
        <div class="donut-center">
          <div class="pct">${pctInvoiceConsistent}%</div>
          <div class="pct-label">consistentes</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Detalhes -->
  ${consistencyResults.length > 0 ? `
  <h3 style="margin-bottom:0.75rem;font-size:1rem;color:#f8fafc">🔍 Discrepâncias encontradas (${consistencyResults.length})</h3>
  <div style="overflow-x:auto;border-radius:12px;background:#0f172a">
  <table>
    <thead>
      <tr>
        <th>CPF</th><th>Nome</th><th>Status</th><th>Vencimento</th>
        <th>User Days</th><th>Invoice Dias</th><th>Real-Time</th>
        <th>Diff U</th><th>Diff I</th>
      </tr>
    </thead>
    <tbody>${detailsRows}</tbody>
  </table>
  </div>` : `
  <div class="empty-state">
    <div class="icon">✅</div>
    <p>Nenhuma discrepância encontrada!<br>Todos os ${totalScanned} usuários e ${totalInvoices} invoices estão consistentes.</p>
  </div>`}

  <div class="footer">
    <p>Relatório gerado automaticamente por <strong>run_audit_consistency_report.js</strong></p>
    <p>${new Date().toLocaleString('pt-BR')}</p>
  </div>
</div>
</body>
</html>`;

    // Salvar HTML
    const fs = require('fs');
    fs.writeFileSync(filepath, html, 'utf8');
    console.log(`      ✅ HTML salvo: ${filename}`);

    // ── 5. Gerar CSV (se --csv) ────────────────────────────────────────────────
    let csvFilename = null;
    if (GENERATE_CSV) {
      csvFilename = `audit_report_${timestamp}.csv`;
      const csvPath = path.join(__dirname, csvFilename);

      // Escape RFC 4180 para campos com ; " ou \n
      const escCsv = (v) => {
        const s = String(v ?? '');
        return (s.includes(';') || s.includes('"') || s.includes('\n'))
          ? '"' + s.replace(/"/g, '""') + '"'
          : s;
      };

      // Cabeçalho CSV (separador ; para abrir direto no Excel PT-BR)
      const header = 'CPF;Nome;Status;Vencimento;User Days;Invoice Dias;Real-Time;Diff U;Diff I';

      // Linhas: TODOS os registros (não apenas discrepâncias), para análise completa no Excel
      const csvRows = ['\ufeff' + header]; // BOM UTF-8 para Excel reconhecer acentos
      for (const r of rows || []) {
        const cpf = fmtCpf(r.cpf);
        const name = escCsv(r.full_name);
        const status = r.account_status || 'adimplente';
        const due = fmtBr(r.due_date);
        const ud = parseInt(r.user_days_overdue || 0);
        const invD = parseInt(r.invoice_dias_atraso || 0);
        const rt = parseInt(r.real_time_days || 0);
        const diffU = ud - rt;
        const diffI = invD - rt;
        csvRows.push(`${cpf};${name};${status};${due};${ud};${invD};${rt};${diffU};${diffI}`);
      }

      fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
      console.log(`      ✅ CSV salvo: ${csvFilename}`);
    }

    // ── 6. Limpeza de relatórios antigos (>90 dias) ──────────────────────────
    try {
      const allFiles = fs.readdirSync(__dirname);
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 dias em ms
      let cleaned = 0;
      for (const f of allFiles) {
        // Só limpa reports gerados por este script (HTML + CSV)
        if (f.startsWith('audit_report_') && f !== filename && f !== csvFilename) {
          const fp = path.join(__dirname, f);
          const stat = fs.statSync(fp);
          if (stat.mtimeMs < cutoff) {
            fs.unlinkSync(fp);
            cleaned++;
          }
        }
      }
      if (cleaned > 0) {
        console.log(`      🗑️  Limpeza: ${cleaned} relatório(s) antigo(s) removido(s) (>90 dias).`);
      }
    } catch (_) {
      // Falha na limpeza não interrompe o script
    }

    // ── Console Summary ──────────────────────────────────────────────────────
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  📊 RESUMO DA AUDITORIA');
    console.log('');
    console.log(`  Usuários escaneados:    ${totalScanned}`);
    console.log(`  ✅ Consistentes:         ${usersConsistent}`);
    console.log(`  ⚠️  Desatualizados:       ${usersDesatualizados}`);
    console.log(`  📄 Total invoices:       ${totalInvoices}`);
    console.log(`  ✅ Invoices OK:          ${invoiceOk}`);
    console.log(`  ⚠️  Invoices com diff:    ${invoiceDiff}`);
    console.log('');
    if (consistencyResults.length > 0) {
      console.log(`  🔍 ${consistencyResults.length} discrepância(s) encontrada(s):`);
      for (const d of consistencyResults.slice(0, 5)) {
        console.log(`     • ${fmtCpf(d.cpf)} | ${d.name || '?'} | User: ${d.userDaysOverdue}→${d.realTimeDays} (${d.diffUser > 0 ? '+' : ''}${d.diffUser}) | Invoice: ${d.invoiceDiasAtraso}→${d.realTimeDays} (${d.diffInvoice > 0 ? '+' : ''}${d.diffInvoice})`);
      }
      if (consistencyResults.length > 5) {
        console.log(`     ... e mais ${consistencyResults.length - 5} discrepância(s) — veja o HTML.`);
      }
    } else {
      console.log('  ✅ Tudo consistente! Nenhuma discrepância.');
    }
    console.log('');
    console.log(`  📁 HTML: ${filename}`);
    if (csvFilename) console.log(`  📄 CSV:  ${csvFilename}`);
    console.log(`  📂 Pasta: ${__dirname}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // ── Open browser? ──
    if (OPEN_BROWSER) {
      const { exec } = require('child_process');
      const fullPath = path.resolve(filepath);
      exec(`start "" "${fullPath}"`, (err) => {
        if (err) console.warn('      ⚠️  Não foi possível abrir o navegador.');
      });
      console.log('      🌐 Abrindo no navegador...');
    }

  } finally {
    await db.disconnect();
    console.log('      🔌 Conexão encerrada.');
  }
}

main().catch(err => {
  console.error('\n❌ ERRO:', err.message);
  process.exit(1);
});
