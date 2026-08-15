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
// Exit code 2 se houver discrepâncias (para o Windows Task Scheduler sinalizar
// drift no histórico da tarefa). Opt-in: o run_audit_all.js (semanal) NÃO passa
// esta flag e continua tratando o auditor como read-only (exit 0 com achados).
const FAIL_ON_DISCREPANCIES = process.argv.includes('--fail-on-discrepancies');
// Sem LIMIT: a auditoria confere TODAS as invoices fechadas não pagas da base.
// Um LIMIT por linha truncaria por invoice e poderia excluir a âncora de uma massa
// inteira da checagem (nível A de users deriva dos CPFs das linhas retornadas),
// produzindo uma auditoria silenciosamente incompleta. A base real tem ~150
// invoices — irrelevante para o volume, correto para a completude.

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
  const db = DatabaseFactory.createDatabaseService();
  await db.connect();
  const fq = t => db.fq(t);
  console.log('      ✅ Conectado.');

  try {
    // ── 2. Executar auditoria ──────────────────────────────────────────────────
    console.log('[2/4] Executando auditoria de consistência...');

    // Fonte de verdade HÍBRIDA (mesma do motor e do sync_dias_atraso.cjs): a
    // quitação é a SOMA dos INVOICE_PAYMENT vinculados por transactions.invoice_id
    // (migration 005) com precedência; sem vínculo, cai no valor_pago legado.
    // Sem este LEFT JOIN o auditor divergiria do motor (ex.: fatura com vínculo
    // cobrindo 100% mas valor_pago=0 pareceria quitada só para o motor).
    //
    // A auditoria agora confere DOIS níveis:
    //   A) USERS: days_overdue/account_status devem refletir a ÂNCORA (fatura
    //      fechada não paga mais antiga COM DÍVIDA — mesma seleção do sync, via
    //      selectAnchors). Massa sem âncora (só faturas fantasma/quitadas) deve
    //      estar em 0/adimplente.
    //   B) INVOICES: TODAS as fechadas não pagas, cada uma com a própria regra
    //      (sem dívida → 0; pagamento mínimo → 0; senão real-time individual).
    //      Cobre o caso de borda da 2ª fatura com dívida sob âncora fantasma.
    //
    // Lógica de âncora/pago/dias esperados vem do módulo PURO audit_helpers.cjs
    // (sem dotenv, sem banco — require seguro de qualquer CWD). Require direto
    // do sync_dias_atraso.cjs disparava dotenv.config() sem path no load, que
    // poderia carregar um .env diferente se o auditor rodasse de outro diretório.
    const { selectAnchors, pagoEfetivo, expectedUserStateFor, invoiceExpectedStateFor, ANCHOR_SQL, buildCascadePago } = require('./audit_helpers.cjs');

    // A query reusa o ANCHOR_SQL do módulo puro (mesma do sync e do motor): o
    // SELECT já traz full_name, account_status (coalescido), days_overdue,
    // invoice_dias_atraso, pago/vínculo e real-time — o auditor e o sync
    // selecionam as MESMAS âncoras por construção, sem replace de string.
    const sql = ANCHOR_SQL(fq, FILTER_CPF ? `AND i.cpf = ${esc(FILTER_CPF)}` : '');
    const rows = await db.executeQuery(sql);

    // ── 3. Processar resultados ────────────────────────────────────────────────
    console.log(`      ✅ ${rows.length} registro(s) retornado(s).`);
    console.log('[3/4] Processando dados...');

    // Âncora por massa: réplica exata do sync (fatura mais antiga COM DÍVIDA;
    // fatura quitada/fantasma é pulada ANTES de ocupar o slot do CPF).
    // CASCATA: 1 transação única (valor total, igual ao comprovante) cobre as
    // faturas da massa da mais antiga para a mais nova. O mapa de pago por fatura
    // é derivado — as checagens de nível A e B usam a MESMA regra do motor.
    const cascadePago = buildCascadePago(rows);

    const anchors = selectAnchors(rows, cascadePago);
    const anchorByCpf = new Map(anchors.map(a => [a.cpf, a]));

    const consistencyResults = [];
    const uniqueCpfs = new Set();
    const cpfComIssue = new Set();
    let invoiceOk = 0, invoiceDiff = 0;

    // B) Checagem de TODAS as invoices fechadas não pagas (individual).
    for (const r of rows || []) {
      uniqueCpfs.add(r.cpf);
      const invD = parseInt(r.invoice_dias_atraso || 0);
      // Regra ÚNICA do módulo puro (mesma do sync e do motor): sem dívida ou
      // pagamento mínimo → dias 0; senão real-time individual da fatura.
      const { days: expectedInvoiceDays, semDivida, pagMinimo: pagamentoMinimo } = invoiceExpectedStateFor(r, cascadePago);
      const invoiceConsistent = invD === expectedInvoiceDays;

      if (invoiceConsistent) invoiceOk++;
      else invoiceDiff++;

      if (!invoiceConsistent) {
        cpfComIssue.add(r.cpf);
        consistencyResults.push({
          tipo: 'invoice',
          cpf: r.cpf,
          name: r.full_name,
          status: r.account_status,
          dueDate: r.due_date,
          userDaysOverdue: parseInt(r.days_overdue || 0),
          invoiceDiasAtraso: invD,
          realTimeDays: expectedInvoiceDays,
          expectedInvoiceDays,
          diffUser: null,
          diffInvoice: invD - expectedInvoiceDays,
          pagamentoMinimo,
          semDivida
        });
      }
    }

    // A) Checagem de USERS: days/status devem refletir a âncora; sem âncora
    //    (só faturas fantasma/quitadas), deve estar em 0/adimplente.
    //
    // CRITÉRIO ESTRITO (ud === expectedDays), SEM tolerância de ±1 dia — decisão
    // documentada: o sync_dias_atraso.cjs corrige com comparação estrita
    // (curUserDays !== expUserDays), então o auditor deve reportar EXATAMENTE o
    // que o sync corrigiria. Uma tolerância de 1 dia faria o auditor aprovar uma
    // massa que o sync corrigiria (ferramentas divergentes). O falso positivo
    // possível (massa 1 dia atrás em manhãs pós-boot, antes do catch-up diário do
    // motor) é legítimo: o sync --confirm resolve, e o HTML mostra o diff em
    // vermelho — não é escondido por tolerância.
    for (const cpf of uniqueCpfs) {
      const anchor = anchorByCpf.get(cpf);
      const rowInfo = (rows || []).find(r => r.cpf === cpf);
      const ud = parseInt(rowInfo?.days_overdue || 0);
      const curStatus = rowInfo?.account_status || 'adimplente';

      const { days: expectedDays, status: expectedStatus, flag } = expectedUserStateFor(anchor, cascadePago);

      const userConsistent = ud === expectedDays && curStatus === expectedStatus;
      if (!userConsistent) {
        cpfComIssue.add(cpf);
        consistencyResults.push({
          tipo: 'user',
          cpf,
          name: rowInfo?.full_name || '—',
          status: curStatus,
          dueDate: anchor?.due_date || null,
          userDaysOverdue: ud,
          invoiceDiasAtraso: null,
          realTimeDays: expectedDays,
          expectedUserDays: expectedDays,
          expectedStatus,
          diffUser: ud - expectedDays,
          diffInvoice: null,
          pagamentoMinimo: flag === 'pagamento mínimo',
          semAncora: !anchor,
          flag
        });
      }
    }

    const totalScanned = uniqueCpfs.size;
    const usersConsistent = uniqueCpfs.size - cpfComIssue.size;
    const usersDesatualizados = cpfComIssue.size;
    const totalInvoices = invoiceOk + invoiceDiff;

    // ── 3.5 Anomalias estruturais (estado de massa) ───────────────────────────
    // Varredura extra que o usuário pediu: a auditoria deve AVISAR quando achar
    // uma massa no estado errado (ou parecido) para ANALISAR e CORRIGIR:
    //   A) PAGAMENTO DIVIDIDO: 2+ INVOICE_PAYMENT da MESMA massa no MESMO segundo —
    //      o bug 805/381 em que UM pagamento virava DUAS transações (a web mostrava
    //      dois lançamentos em vez de um, divergindo do comprovante). Correto = 1 tx
    //      com o valor total, distribuição derivada por cascata na leitura.
    //   B) ENCARGOS PÓS-QUITAÇÃO: billing_charges 'pending' cuja invoice_reference
    //      (YYYY-MM) aponta para fatura fechada JÁ QUITADA pela cascata (residual
    //      <= 0.005) — o cron da meia-noite com código sem cascata inseriu encargos
    //      em faturas pagas (regressão 381/805).
    const anomalias = [];
    const cpfFilterSql = FILTER_CPF ? ` AND cpf = '${FILTER_CPF}'` : '';

    // A) Pagamento dividido (mesmo segundo = mesma operação de pagamento)
    const splitRows = await db.executeQuery(`
        SELECT cpf, date_trunc('second', date) AS instante, COUNT(*) AS qtd,
               SUM(ABS(CAST(amount AS DECIMAL(15,2)))) AS total
        FROM ${fq('transactions')}
        WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL${cpfFilterSql}
        GROUP BY cpf, date_trunc('second', date)
        HAVING COUNT(*) > 1
        ORDER BY cpf, instante
    `);
    for (const s of splitRows || []) {
        anomalias.push({
            tipo: 'pagamento_dividido',
            cpf: s.cpf,
            qtd: parseInt(s.qtd, 10),
            total: parseFloat(s.total || 0),
            data: s.instante,
        });
    }

    // Mapa fatura -> residual via cascata (mesma regra do resto do auditor)
    const invResidual = new Map();
    for (const r of rows || []) {
        const total = parseFloat(r.valor_total || 0);
        const pago = pagoEfetivo(r, cascadePago);
        invResidual.set(String(r.invoice_id), Math.max(0, total - pago));
    }

    // B) Encargos 'pending' sobre fatura fechada JÁ QUITADA pela cascata.
    // Só acusa quando a charge foi criada DEPOIS do último pagamento da massa:
    // encargos acumulados ANTES do pagamento (enquanto a fatura estava devida) são
    // legítimos e ficam como histórico/encargos herdados — só o incremento PÓS-
    // quitação é o bug (o cron da meia-noite com código sem cascata inseriu encargos
    // em faturas já pagas — regressão 381/805).
    const chargeRows = await db.executeQuery(`
        SELECT bc.cpf, bc.invoice_reference, bc.charge_type, bc.amount, bc.created_at,
               i.id AS invoice_id, ult.ultimo_pagamento
        FROM ${fq('billing_charges')} bc
        JOIN ${fq('invoices')} i
          ON i.cpf = bc.cpf AND to_char(i.due_date, 'YYYY-MM') = bc.invoice_reference
        LEFT JOIN (
            SELECT cpf, MAX(date) AS ultimo_pagamento
            FROM ${fq('transactions')}
            WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
            GROUP BY cpf
        ) ult ON ult.cpf = bc.cpf
        WHERE bc.status = 'pending'${FILTER_CPF ? ` AND bc.cpf = '${FILTER_CPF}'` : ''}
        ORDER BY bc.cpf, bc.created_at
    `);
    for (const c of chargeRows || []) {
        // Fatura fora do escopo do ANCHOR_SQL (data_pagamento setada / não fechada):
        // legitima — não acusa. Só acusa fatura fechada não paga SEM residual (quitada).
        if (!invResidual.has(String(c.invoice_id))) continue;
        if (invResidual.get(String(c.invoice_id)) > 0.005) continue; // ainda tem dívida
        const criadaEm = new Date(c.created_at).getTime();
        const ultPago = c.ultimo_pagamento ? new Date(c.ultimo_pagamento).getTime() : 0;
        if (!ultPago) continue; // sem pagamento registrado: massa nunca pagou — não é o bug
        if (criadaEm <= ultPago) continue; // encargo anterior ao pagamento = legítimo
        anomalias.push({
            tipo: 'encargo_pos_quitacao',
            cpf: c.cpf,
            chargeType: c.charge_type,
            amount: parseFloat(c.amount || 0),
            invoiceRef: c.invoice_reference,
            data: c.created_at,
        });
    }

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
        const isUser = d.tipo === 'user';
        // Estrito (diff !== 0), alinhado ao critério do nível A — um diff de ±1
        // é discrepância reportada e deve aparecer em vermelho no HTML, não ser
        // mascarado por tolerância antiga de 1 dia.
        const userBad = isUser ? d.diffUser !== 0 : false;
        const invBad = !isUser ? Math.abs(d.diffInvoice) > 0 : false;
        const badgeTipo = isUser
          ? '<span class="badge badge-user">user</span>'
          : '<span class="badge badge-inv">invoice</span>';
        const flag = d.pagamentoMinimo ? ' <span class="badge badge-neutral">pag. mínimo</span>'
          : ((d.semAncora || d.semDivida) ? ' <span class="badge badge-neutral">sem dívida</span>' : '');
        detailsRows += `
          <tr>
            <td class="cpf">${fmtCpf(d.cpf)}</td>
            <td>${d.name || '—'} ${badgeTipo}${flag}</td>
            <td><span class="badge badge-${d.status === 'inadimplente' ? 'danger' : 'success'}">${d.status || 'adimplente'}</span></td>
            <td>${fmtBr(d.dueDate)}</td>
            <td class="${userBad ? 'diff-bad' : 'diff-ok'}">${d.userDaysOverdue ?? '—'}</td>
            <td class="${invBad ? 'diff-bad' : 'diff-ok'}">${d.invoiceDiasAtraso ?? '—'}</td>
            <td>${d.realTimeDays ?? '—'}</td>
            <td class="${userBad ? 'diff-bad' : 'diff-ok'}">${d.diffUser == null ? '—' : (d.diffUser > 0 ? '+' : '') + d.diffUser}</td>
            <td class="${invBad ? 'diff-bad' : 'diff-ok'}">${d.diffInvoice == null ? '—' : (d.diffInvoice > 0 ? '+' : '') + d.diffInvoice}</td>
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
  .badge-user { background: #1e3a5f; color: #60a5fa; }
  .badge-inv { background: #3b1d5f; color: #c084fc; }
  .badge-purple { background: #3b1d5f; color: #e9d5ff; }
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
    <div class="card ${anomalias.length > 0 ? 'purple' : 'green'}">
      <div class="label">Anomalias Estruturais</div>
      <div class="value">${anomalias.length}</div>
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

  <!-- Anomalias Estruturais -->
  ${anomalias.length > 0 ? `
  <h3 style="margin:2rem 0 0.75rem;font-size:1rem;color:#c084fc">⚠️ Anomalias Estruturais (${anomalias.length})</h3>
  <div style="overflow-x:auto;border-radius:12px;background:#0f172a">
  <table>
    <thead>
      <tr>
        <th>CPF</th><th>Tipo</th><th>Detalhe</th><th>Quando</th>
      </tr>
    </thead>
    <tbody>
      ${anomalias.map(a => {
        const t = a.tipo === 'pagamento_dividido'
          ? '<span class="badge badge-danger">pagamento dividido</span>'
          : '<span class="badge badge-purple">encargo pós-quitação</span>';
        const det = a.tipo === 'pagamento_dividido'
          ? `${a.qtd} transações INVOICE_PAYMENT no mesmo instante (total R$ ${a.total.toFixed(2).replace('.', ',')}) — deve ser 1 tx única`
          : `${a.chargeType} R$ ${a.amount.toFixed(2).replace('.', ',')} (ref ${a.invoiceRef}) em fatura JÁ quitada pela cascata`;
        return `<tr><td class="cpf">${fmtCpf(a.cpf)}</td><td>${t}</td><td>${det}</td><td>${fmtBr(a.data)}</td></tr>`;
      }).join('\n')}
    </tbody>
  </table>
  </div>` : ''}

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

      // Linhas: TODOS os registros (não apenas discrepâncias), para análise completa no Excel.
      // Diff calculado contra o DIA ESPERADO — mesma regra do HTML:
      //  - Diff I: semDivida/pagamentoMinimo → 0, senão real-time (evita diff fantasma nas
      //    faturas de R$ 0 e nas 2ªs faturas que seguem a própria regra);
      //  - Diff U: contra os dias da ÂNCORA da massa (ou 0 se a massa não tem âncora),
      //    replicando o nível A — evita acusar -2 na Morgan (fantasma) ou 31 na 2ª fatura
      //    da Flore (que herda os dias da âncora, não da invoice individual).
      const csvRows = ['\ufeff' + header]; // BOM UTF-8 para Excel reconhecer acentos
      for (const r of rows || []) {
        const cpf = fmtCpf(r.cpf);
        const name = escCsv(r.full_name);
        const status = r.account_status || 'adimplente';
        const due = fmtBr(r.due_date);
        const ud = parseInt(r.days_overdue || 0);
        const invD = parseInt(r.invoice_dias_atraso || 0);
        const rt = parseInt(r.real_time_days || 0);
        const { days: expectedInv } = invoiceExpectedStateFor(r, cascadePago);
        const anchor = anchorByCpf.get(r.cpf);
        const expectedUser = expectedUserStateFor(anchor, cascadePago).days;
        const diffU = ud - expectedUser;
        const diffI = invD - expectedInv;
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
    if (anomalias.length > 0) {
      console.log(`  ⚠️  ${anomalias.length} anomalia(s) estrutural(is) — analisar e corrigir:`);
      for (const a of anomalias.slice(0, 10)) {
        if (a.tipo === 'pagamento_dividido') {
          console.log(`     • [pagamento dividido] ${fmtCpf(a.cpf)} | ${a.qtd} txs no mesmo instante (total R$ ${a.total.toFixed(2).replace('.', ',')}) | ${fmtBr(a.data)}`);
        } else {
          console.log(`     • [encargo pós-quitação] ${fmtCpf(a.cpf)} | ${a.chargeType} R$ ${a.amount.toFixed(2).replace('.', ',')} (ref ${a.invoiceRef}) | ${fmtBr(a.data)}`);
        }
      }
      if (anomalias.length > 10) console.log(`     ... e mais ${anomalias.length - 10} anomalia(s) — veja o HTML.`);
      console.log('');
    }
    if (consistencyResults.length > 0) {
      console.log(`  🔍 ${consistencyResults.length} discrepância(s) encontrada(s):`);
      for (const d of consistencyResults.slice(0, 8)) {
        if (d.tipo === 'user') {
          console.log(`     • [user] ${fmtCpf(d.cpf)} | ${d.name || '?'} | User: ${d.userDaysOverdue}→${d.realTimeDays} (${d.diffUser > 0 ? '+' : ''}${d.diffUser}) | esperado: ${d.expectedStatus || d.status}${d.flag ? ` [${d.flag}]` : ''}`);
        } else {
          console.log(`     • [invoice] ${fmtCpf(d.cpf)} | ${d.name || '?'} | Invoice: ${d.invoiceDiasAtraso}→${d.realTimeDays} (${d.diffInvoice > 0 ? '+' : ''}${d.diffInvoice})${d.pagamentoMinimo ? ' [pagamento mínimo]' : d.semDivida ? ' [sem dívida]' : ''}`);
        }
      }
      if (consistencyResults.length > 8) {
        console.log(`     ... e mais ${consistencyResults.length - 8} discrepância(s) — veja o HTML.`);
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

    // Exit code 2 = discrepâncias encontradas (apenas com --fail-on-discrepancies,
    // usado pela tarefa diária AuditConsistencyDaily). process.exitCode em vez de
    // process.exit(2): o fluxo segue para o finally (disconnect único) e o processo
    // encerra com código 2 naturalmente — sem perder o último log no stdout.
    if (FAIL_ON_DISCREPANCIES && (consistencyResults.length > 0 || anomalias.length > 0)) {
      console.log(`      ⚠️  ${consistencyResults.length} discrepância(s) + ${anomalias.length} anomalia(s) estrutural(is) — exit code 2 (--fail-on-discrepancies).`);
      process.exitCode = 2;
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
