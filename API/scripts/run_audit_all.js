#!/usr/bin/env node
/**
 * run_audit_all.js
 *
 * Executa AMBAS as auditorias em sequência e gera um relatório HTML unificado.
 *
 * Auditorias executadas:
 *   1. Consistência (users.days_overdue × invoices.dias_atraso × real-time)
 *   2. Completa (double-counting de pagamentos + saldo negativo)
 *
 * Uso:
 *   node scripts/run_audit_all.js
 *   node scripts/run_audit_all.js --cpf=02816769844   (filtro para ambas)
 *   node scripts/run_audit_all.js --open              (abre no navegador)
 *
 * npm:
 *   npm run audit:all
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// ─── CLI args ─────────────────────────────────────────────────────────────────
const CPF_FILTER = (process.argv.find(a => a.startsWith('--cpf=')) || '').replace('--cpf=', '') || null;
const OPEN_BROWSER = process.argv.includes('--open');
const SCRIPTS_DIR = __dirname;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
};

const fmtCpf = (c) => {
  if (!c || c.length !== 11) return c || '';
  return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9)}`;
};

const fmtBr = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

// ─── Carregar sumário do relatório anterior (sidecar JSON) ────────────────
function carregarSumarioAnterior() {
  try {
    const files = fs.readdirSync(SCRIPTS_DIR)
      .filter(f => /^audit_all_report_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/i.test(f))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    const prevPath = path.join(SCRIPTS_DIR, files[0]);
    const raw = fs.readFileSync(prevPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

// ─── Comparação temporal entre sumários ────────────────────────────────────
function compararSumarios(atual, anterior) {
  if (!anterior) return null;

  const a = atual.consistency || {};
  const p = anterior.consistency || {};
  const aDC = atual.doubleCount || {};
  const pDC = anterior.doubleCount || {};
  const aNB = atual.negativeBalance || {};
  const pNB = anterior.negativeBalance || {};

  return {
    intervalo: anterior.timestamp
      ? `${new Date(anterior.timestamp).toLocaleString('pt-BR')} → ${new Date(atual.timestamp).toLocaleString('pt-BR')}`
      : 'Comparação com relatório anterior',
    consistency: {
      desatualizadosAntes: p.usersDesatualizados ?? '—',
      desatualizadosAgora: a.usersDesatualizados ?? '—',
      mudou: a.usersDesatualizados !== p.usersDesatualizados,
      melhora: (p.usersDesatualizados ?? 0) > (a.usersDesatualizados ?? 0),
    },
    doubleCount: {
      discrepAntes: pDC.discrepancies ?? '—',
      discrepAgora: aDC.discrepancies ?? '—',
      mudou: aDC.discrepancies !== pDC.discrepancies,
      melhora: (pDC.discrepancies ?? 0) > (aDC.discrepancies ?? 0),
    },
    negativeBalance: {
      issuesAntes: pNB.issues ?? '—',
      issuesAgora: aNB.issues ?? '—',
      mudou: aNB.issues !== pNB.issues,
      melhora: (pNB.issues ?? 0) > (aNB.issues ?? 0),
    },
  };
}

// ─── Spawn helper: roda script e retorna { stdout, stderr, code } ─────────────
function runScript(scriptName, args = []) {
  return new Promise((resolve) => {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    const child = spawn('node', [scriptPath, ...args], {
      cwd: path.join(SCRIPTS_DIR, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });

    child.on('error', (err) => {
      resolve({ stdout, stderr: err.message, code: 1 });
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   FintechBank — Auditoria COMPLETA (unificada)             ║');
  console.log('║   Consistência + Double-Counting + Saldo Negativo          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  if (CPF_FILTER) console.log(`      Filtro CPF: ${fmtCpf(CPF_FILTER)}`);
  console.log('');

  const startTime = Date.now();
  const args = ['--json'];
  if (CPF_FILTER) args.push(`--cpf=${CPF_FILTER}`);

  // ── Etapa 1: Auditoria de Consistência ─────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  [1/2] Auditoria de Consistência');
  console.log('        (users.days_overdue × invoices.dias_atraso × real-time)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const resultConsistency = await runScript('run_audit_consistency_report.js', args);

  if (resultConsistency.code !== 0) {
    console.error('  ❌ Auditoria de Consistência falhou:', resultConsistency.stderr.slice(0, 500));
  } else {
    console.log(resultConsistency.stdout);
  }

  // ── Etapa 2: Auditoria Completa (double-counting + negative balance) ────
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  [2/2] Auditoria Completa');
  console.log('        (double-counting de pagamentos + saldo negativo)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('');

  // audit_completo.js --json + flags
  const auditArgs = ['--json'];
  if (CPF_FILTER) auditArgs.push(`--cpf=${CPF_FILTER}`);

  const resultCompleto = await runScript('audit_completo.js', auditArgs);

  if (resultCompleto.code !== 0) {
    console.error('  ❌ Auditoria Completa falhou:', resultCompleto.stderr.slice(0, 500));
  } else if (resultCompleto.stdout.trim()) {
    // audit_completo.js com --json imprime os cabeçalhos + JSON
    // O JSON está no final do stdout após todos os logs
    const lines = resultCompleto.stdout.split('\n');
    const jsonPart = lines.filter(l => l.trim().startsWith('{') || l.trim().startsWith('[')).join('\n');
    try {
      const parsed = JSON.parse(jsonPart);
      // Show compact summary
      if (parsed.doubleCount) {
        const dc = parsed.doubleCount;
        console.log(`  📊 Double-Counting: ${dc.scanned || 0} usuários, ${dc.discrepancies || 0} discrepâncias`);
      }
      if (parsed.negativeBalance) {
        const nb = parsed.negativeBalance;
        console.log(`  📊 Saldo Negativo: ${nb.scanned || 0} usuários, ${nb.issues || 0} problemas`);
      }
    } catch (_) {
      // JSON não encontrado — exibir output completo
      console.log(resultCompleto.stdout);
    }
  }

  // ── Gerar relatório HTML unificado ──────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Gerando relatório HTML unificado...');

  const timestamp = fmtDate();
  const filename = `audit_all_report_${timestamp}.html`;
  const filepath = path.join(SCRIPTS_DIR, filename);    // Parse JSON do audit_completo (busca último objeto {} no stdout)
    let dcData = null;
    let nbData = null;
    let consistencyScanned = 0, consistencyUsersConsistent = 0, consistencyDesatualizados = 0;
    if (resultCompleto.stdout.trim()) {
      const jsonMatch = resultCompleto.stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { const p = JSON.parse(jsonMatch[0]); dcData = p.doubleCount; nbData = p.negativeBalance; } catch (_) {}
      }
    }
    // Extrair stats de consistência do log (run_audit_consistency_report.js output)
    if (resultConsistency.stdout) {
      const m = resultConsistency.stdout.match(/Usuários escaneados:\s+(\d+)/i);
      if (m) consistencyScanned = parseInt(m[1], 10);
      const m2 = resultConsistency.stdout.match(/✅ Consistentes:\s+(\d+)/i);
      if (m2) consistencyUsersConsistent = parseInt(m2[1], 10);
      const m3 = resultConsistency.stdout.match(/⚠️.*Desatualizados:\s+(\d+)/i);
      if (m3) consistencyDesatualizados = parseInt(m3[1], 10);
    }

  // Parse consistency output (show in HTML)
  const hasConsistencyError = resultConsistency.code !== 0;
  const consistencyError = hasConsistencyError ? (resultConsistency.stderr || 'Erro desconhecido') : null;

  // Summary stats
  const dcScanned = dcData?.scanned ?? '—';
  const dcDiscrepancies = dcData?.discrepancies ?? '—';
  const nbScanned = nbData?.scanned ?? '—';
  const nbIssues = nbData?.issues ?? '—';
  const nbTotalExcess = nbData?.totalExcess ? `R$ ${Number(nbData.totalExcess).toFixed(2)}` : '—';

  // ── Sumário atual (para sidecar + comparação temporal) ──────────────────
  const sumarioAtual = {
    timestamp: new Date().toISOString(),
    consistency: {
      totalScanned: consistencyScanned,
      usersConsistent: consistencyUsersConsistent,
      usersDesatualizados: consistencyDesatualizados,
    },
    doubleCount: {
      scanned: typeof dcScanned === 'number' ? dcScanned : (dcData?.scanned ?? null),
      discrepancies: typeof dcDiscrepancies === 'number' ? dcDiscrepancies : (dcData?.discrepancies ?? null),
    },
    negativeBalance: {
      scanned: typeof nbScanned === 'number' ? nbScanned : (nbData?.scanned ?? null),
      issues: typeof nbIssues === 'number' ? nbIssues : (nbData?.issues ?? null),
      totalExcess: nbData?.totalExcess ?? null,
    },
  };

  // ── Carregar sumário anterior e comparar ────────────────────────────────
  const sumarioAnterior = carregarSumarioAnterior();
  const evol = compararSumarios(sumarioAtual, sumarioAnterior);

  // Montar HTML da evolução temporal
  let evolHtml = '';
  if (evol) {
    evolHtml = `
    <h2 class="section-title">📈 Evolução Temporal</h2>
    <div class="evolution-bar ${!evol.consistency.mudou && !evol.doubleCount.mudou && !evol.negativeBalance.mudou ? 'stable' : (evol.consistency.melhora || evol.doubleCount.melhora || evol.negativeBalance.melhora ? 'improved' : 'worsened')}">
      <div class="evol-header">${evol.intervalo}</div>
      <div class="evol-grid">
        <div class="evol-item">
          <span class="evol-label">👤 Usuários desatualizados</span>
          ${evol.consistency.mudou
            ? `<span class="evol-value ${evol.consistency.melhora ? 'evol-up' : 'evol-down'}">${evol.consistency.desatualizadosAntes} → ${evol.consistency.desatualizadosAgora}</span>`
            : `<span class="evol-value evol-neutral">${evol.consistency.desatualizadosAgora} (inalterado)</span>`}
        </div>
        <div class="evol-item">
          <span class="evol-label">🔄 Double-Counting</span>
          ${evol.doubleCount.mudou
            ? `<span class="evol-value ${evol.doubleCount.melhora ? 'evol-up' : 'evol-down'}">${evol.doubleCount.discrepAntes} → ${evol.doubleCount.discrepAgora}</span>`
            : `<span class="evol-value evol-neutral">${evol.doubleCount.discrepAgora} (inalterado)</span>`}
        </div>
        <div class="evol-item">
          <span class="evol-label">⚠️ Saldo Negativo</span>
          ${evol.negativeBalance.mudou
            ? `<span class="evol-value ${evol.negativeBalance.melhora ? 'evol-up' : 'evol-down'}">${evol.negativeBalance.issuesAntes} → ${evol.negativeBalance.issuesAgora}</span>`
            : `<span class="evol-value evol-neutral">${evol.negativeBalance.issuesAgora} (inalterado)</span>`}
        </div>
      </div>
    </div>`;
  }

  // Detailed rows from completeness
  let dcRows = '';
  if (dcData?.details && dcData.details.length > 0) {
    for (const d of dcData.details.slice(0, 20)) {
      const icon = d.status === 'ORFÃO' ? '🟠' : d.status === 'DISCREPÂNCIA' ? '🔴' : '🟢';
      dcRows += `<tr><td>${fmtCpf(d.cpf)}</td><td>${d.name || '?'}</td><td><span class="badge badge-${d.status === 'OK' ? 'success' : 'danger'}">${d.status}</span></td><td>${d.payments || d.paymentCount || 0}</td><td>R$ ${Number(d.paymentTotal || d.totalPago || 0).toFixed(2)}</td><td>R$ ${Number(d.invoiceTotal || d.totalInvoice || 0).toFixed(2)}</td><td class="${Math.abs(Number(d.diff || d.excess || 0)) > 0.01 ? 'diff-bad' : 'diff-ok'}">R$ ${Number(d.diff || d.excess || 0).toFixed(2)}</td></tr>`;
    }
  }

  let nbRows = '';
  if (nbData?.details && nbData.details.length > 0) {
    for (const d of nbData.details.slice(0, 20)) {
      nbRows += `<tr><td>${fmtCpf(d.cpf)}</td><td>${d.name || '?'}</td><td>R$ ${Number(d.valorPago || d.paid || 0).toFixed(2)}</td><td>R$ ${Number(d.valorTotal || d.total || 0).toFixed(2)}</td><td class="diff-bad">R$ ${Number(d.excess || d.diff || 0).toFixed(2)}</td></tr>`;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório Unificado — Auditoria Completa</title>
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

  .section-title { font-size: 1.1rem; font-weight: 700; color: #f8fafc; margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #334155; }

  .grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem; margin-bottom: 1.5rem;
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

  .status-bar {
    display: flex; gap: 0.75rem; align-items: center; padding: 1rem;
    border-radius: 12px; margin-bottom: 1.5rem;
  }
  .status-bar.success { background: #064e3b; border: 1px solid #22c55e; }
  .status-bar.warning { background: #451a03; border: 1px solid #f59e0b; }
  .status-bar.error { background: #450a0a; border: 1px solid #ef4444; }
  .status-bar .icon { font-size: 1.5rem; }
  .status-bar .text { font-size: 0.9rem; }
  .status-bar .text strong { color: #f8fafc; }

  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th {
    background: #1e293b; color: #94a3b8; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; padding: 0.75rem 0.5rem; text-align: left;
    border-bottom: 2px solid #334155; position: sticky; top: 0;
  }
  td { padding: 0.65rem 0.5rem; border-bottom: 1px solid #1e293b; }
  tr:hover td { background: #1e293b; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
  .badge-success { background: #166534; color: #4ade80; }
  .badge-danger { background: #7f1d1d; color: #fca5a5; }
  .badge-warning { background: #713f12; color: #fbbf24; }
  .badge-neutral { background: #334155; color: #94a3b8; }
  .diff-ok { color: #4ade80; }
  .diff-bad { color: #f87171; font-weight: 600; }

  .empty-state { text-align: center; padding: 2rem; background: #1e293b; border-radius: 12px; margin-bottom: 1.5rem; }
  .empty-state .icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
  .empty-state p { color: #94a3b8; font-size: 0.85rem; }

  .log-box {
    background: #0f172a; border: 1px solid #334155; border-radius: 8px;
    padding: 1rem; font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.75rem; line-height: 1.5; max-height: 400px; overflow-y: auto;
    white-space: pre-wrap; color: #94a3b8; margin-bottom: 1.5rem;
  }

  .evolution-bar {
    border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;
    border: 1px solid #334155;
  }
  .evolution-bar.stable { background: #0f172a; border-color: #334155; }
  .evolution-bar.improved { background: #064e3b; border-color: #22c55e; }
  .evolution-bar.worsened { background: #450a0a; border-color: #ef4444; }
  .evol-header { font-size: 0.85rem; color: #64748b; margin-bottom: 1rem; }
  .evol-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  .evol-item { background: #1e293b; border-radius: 8px; padding: 0.75rem 1rem; }
  .evol-label { display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.35rem; }
  .evol-value { font-size: 1.1rem; font-weight: 700; }
  .evol-up { color: #4ade80; }
  .evol-down { color: #f87171; }
  .evol-neutral { color: #94a3b8; }

  .footer { margin-top: 2rem; text-align: center; color: #475569; font-size: 0.75rem; }
  .footer a { color: #60a5fa; }
</style>
</head>
<body>
<div class="container">
  <h1>📊 Auditoria COMPLETA</h1>
  <p class="subtitle">Consistência + Double-Counting + Saldo Negativo &mdash; ${new Date().toLocaleString('pt-BR')} ${CPF_FILTER ? `| Filtro: ${fmtCpf(CPF_FILTER)}` : ''}</p>

  <!-- Seção 1: Consistência -->
  <h2 class="section-title">🔍 Auditoria de Consistência</h2>

  ${hasConsistencyError ? `
  <div class="status-bar error">
    <div class="icon">❌</div>
    <div class="text"><strong>Falha na execução:</strong> ${consistencyError}</div>
  </div>` : `
  <div class="log-box">${resultConsistency.stdout.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(-2000)}</div>
  <p style="color:#64748b;font-size:0.8rem;">✅ Consistência executada. O relatório detalhado foi gerado separadamente com o prefixo <code>audit_report_</code>.</p>`}

  <!-- Seção 2: Double-Counting + Saldo Negativo -->
  <h2 class="section-title">📊 Auditoria Completa (Pagamentos)</h2>

  <div class="grid">
    <div class="card blue">
      <div class="label">Usuários (Double-Count)</div>
      <div class="value">${dcScanned}</div>
    </div>
    <div class="card ${(typeof dcDiscrepancies === 'number' && dcDiscrepancies > 0) ? 'red' : 'green'}">
      <div class="label">Discrepâncias</div>
      <div class="value">${dcDiscrepancies}</div>
    </div>
    <div class="card cyan">
      <div class="label">Usuários (Saldo Neg.)</div>
      <div class="value">${nbScanned}</div>
    </div>
    <div class="card ${(typeof nbIssues === 'number' && nbIssues > 0) ? 'red' : 'green'}">
      <div class="label">Problemas</div>
      <div class="value">${nbIssues}</div>
    </div>
    <div class="card purple">
      <div class="label">Total Excesso</div>
      <div class="value" style="font-size:1.2rem">${nbTotalExcess}</div>
    </div>
  </div>

  ${consistencyError && !dcData ? `
  <div class="status-bar error">
    <div class="icon">⚠️</div>
    <div class="text"><strong>Auditoria Completa sem dados disponíveis.</strong> Execute <code>npm run audit:complete</code> manualmente.</div>
  </div>` : ''}

  <!-- Tabela: Double-Counting -->
  ${dcRows ? `
  <h3 style="margin:1.5rem 0 0.75rem;font-size:0.95rem;color:#f8fafc">🔄 Double-Counting — Detalhes (até 20)</h3>
  <div style="overflow-x:auto;border-radius:12px;background:#0f172a">
  <table>
    <thead><tr><th>CPF</th><th>Nome</th><th>Status</th><th>Pagamentos</th><th>Total Pago</th><th>Total Invoice</th><th>Diferença</th></tr></thead>
    <tbody>${dcRows}</tbody>
  </table>
  </div>` : `
  <div class="empty-state"><div class="icon">✅</div><p>Nenhuma discrepância de double-counting encontrada.</p></div>`}

  <!-- Tabela: Saldo Negativo -->
  ${nbRows ? `
  <h3 style="margin:1.5rem 0 0.75rem;font-size:0.95rem;color:#f8fafc">⚠️ Saldo Negativo — Detalhes (até 20)</h3>
  <div style="overflow-x:auto;border-radius:12px;background:#0f172a">
  <table>
    <thead><tr><th>CPF</th><th>Nome</th><th>Valor Pago</th><th>Valor Total</th><th>Excesso</th></tr></thead>
    <tbody>${nbRows}</tbody>
  </table>
  </div>` : `
  <div class="empty-state"><div class="icon">✅</div><p>Nenhum problema de saldo negativo encontrado.</p></div>`}

  <!-- Seção 3: Evolução Temporal (comparação com relatório anterior) -->
  ${evolHtml}

  <!-- Pequena legenda -->
  ${!dcRows && !nbRows && !hasConsistencyError ? `
  <div class="status-bar success">
    <div class="icon">🎉</div>
    <div class="text"><strong>Todas as auditorias OK!</strong> Nenhuma discrepância detectada em nenhuma das duas auditorias.</div>
  </div>` : ''}

  <div class="footer">
    <p>Relatório gerado automaticamente por <strong>run_audit_all.js</strong></p>
    <p>Tempo total: ${((Date.now() - startTime) / 1000).toFixed(1)}s &mdash; ${new Date().toLocaleString('pt-BR')}</p>
  </div>
</div>
</body>
</html>`;

  fs.writeFileSync(filepath, html, 'utf8');

  // ── Salvar sidecar JSON para comparação futura ──────────────────────────
  const jsonFilename = filename.replace(/\.html$/i, '.json');
  const jsonPath = path.join(SCRIPTS_DIR, jsonFilename);
  fs.writeFileSync(jsonPath, JSON.stringify(sumarioAtual, null, 2), 'utf8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   AUDITORIA COMPLETA FINALIZADA                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  📁 Relatório unificado: ${filename}`);
  console.log(`  📂 Caminho: ${filepath}`);
  console.log(`  ⏱️  Tempo total: ${elapsed}s`);
  console.log('');
  console.log('  Auditorias executadas:');
  console.log('    ✅ 1. Consistência (days_overdue × invoices × real-time)');
  console.log('    ✅ 2. Double-Counting de pagamentos');
  console.log('    ✅ 3. Saldo Negativo / Pagamento Excessivo');
  console.log('');

  if (OPEN_BROWSER) {
    const { exec } = require('child_process');
    exec(`start "" "${path.resolve(filepath)}"`, (err) => {
      if (err) console.warn('      ⚠️  Não foi possível abrir o navegador.');
    });
    console.log('      🌐 Abrindo no navegador...');
  }
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
