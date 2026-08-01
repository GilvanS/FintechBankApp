#!/usr/bin/env node
/**
 * generate_pdf_report.cjs
 * Gera relatório profissional com logo e layout bancário do Painel de Massas em Atraso.
 *
 * Uso:
 *   node scripts/generate_pdf_report.cjs                    ← lê do JSON salvo
 *   node scripts/generate_pdf_report.cjs --live              ← busca dados da API
 *   node scripts/generate_pdf_report.cjs --live --cpf=123    ← massa específica
 *
 * Saída:
 *   API/scripts/relatorio_massas_YYYY-MM-DD.html
 *   (abrir no navegador, Ctrl+P → "Salvar como PDF", orientação paisagem)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// ── Config ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const USE_LIVE = args.includes('--live');
const FILTER_CPF = args.find(a => a.startsWith('--cpf='))?.split('=')[1] || null;
const ADMIN_TOKEN = args.find(a => a.startsWith('--token='))?.split('=')[1] || null;

const BRAND = {
    primary:    '#1a1a2e',
    secondary:  '#16213e',
    accent:     '#00ff9d',
    accent2:    '#A2FF00',
    gold:       '#FFD700',
    dark:       '#0f0f23',
    text:       '#1a1a2e',
    muted:      '#6c757d',
    light:      '#f8f9fa',
    border:     '#dee2e6',
    danger:     '#e74c3c',
    success:    '#27ae60',
    warning:    '#f39c12',
    info:       '#2980b9',
};

// ── 1. Obter dados ────────────────────────────────────────────────────
async function fetchDashboard(cpfFilter) {
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json' };
        if (ADMIN_TOKEN) headers['Authorization'] = 'Bearer ' + ADMIN_TOKEN;

        const opts = {
            hostname: 'localhost', port: 3001,
            path: '/api/admin/overdue-masses-dashboard',
            method: 'GET',
            headers,
            timeout: 15000,
        };
        const req = http.request(opts, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve(json.success ? json : null);
                } catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.end();
    });
}

async function main() {
    let dash;

    if (USE_LIVE) {
        console.log('🔵 Buscando dados da API...');
        dash = await fetchDashboard(FILTER_CPF);
        if (!dash) {
            console.error('❌ API não respondeu. Certifique-se de que o servidor está rodando.');
            process.exit(1);
        }
        console.log(`✅ Dados carregados: ${dash.stats?.totalUsers || 0} usuários`);
    } else {
        const dataPath = path.join(__dirname, 'dashboard_data.json');
        if (!fs.existsSync(dataPath)) {
            console.error('❌ dashboard_data.json não encontrado. Use --live ou crie o JSON.');
            process.exit(1);
        }
        dash = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }

    const { stats, overdueMasses = [], regularizedReport = [] } = dash;

    // ── Helpers (ICU-safe, sem depender de Node.js Intl) ────────────────
    const pad = (n) => String(n).padStart(2, '0');
    const fmtDateBR = (d) => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
    const fmtTimeBR = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const fmtDateTimeBR = (d) => {
        const dt = new Date(d);
        return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    };
    const fmtMonthYearBR = (d) => {
        const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
        return `${meses[d.getMonth()]} de ${d.getFullYear()}`;
    };
    const fmt = v => (v || 0).toFixed(2).replace('.', ',');
    const fmtCPF = cpf => {
        if (!cpf || cpf.length !== 11) return cpf || '';
        return `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`;
    };
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // ── Filtrar por CPF se solicitado ──
    const filteredMasses = FILTER_CPF
        ? overdueMasses.filter(m => m.cpf === FILTER_CPF)
        : overdueMasses;

    const hoje = fmtDateBR(new Date());
    const horario = fmtTimeBR(new Date());
    const mesAno = fmtMonthYearBR(new Date());

    // ── 2. Ordenar ─────────────────────────────────────────────────────
    const sorted = [...filteredMasses].sort((a, b) => {
        const sA = (a.paymentSummary || {}).statusMinimo || 'SEM_PAG';
        const sB = (b.paymentSummary || {}).statusMinimo || 'SEM_PAG';
        const ordem = { ABAIXO: 0, ACIMA: 1, SEM_PAG: 2 };
        const diff = (ordem[sA] ?? 3) - (ordem[sB] ?? 3);
        if (diff !== 0) return diff;
        return (b.daysOverdue || 0) - (a.daysOverdue || 0);
    });

    // ── Contagens ─────────────────────────────────────────────────────
    const abaixo = sorted.filter(m => (m.paymentSummary || {}).statusMinimo === 'ABAIXO');
    const acima = sorted.filter(m => (m.paymentSummary || {}).statusMinimo === 'ACIMA');
    const semPag = sorted.filter(m => (m.paymentSummary || {}).statusMinimo === 'SEM_PAG' || !m.paymentSummary);

    // ── 3. Gerar HTML ──────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório de Inadimplência — Volt Bank ${hoje}</title>
<style>
    @page {
        margin: 10mm 8mm;
        size: A4 landscape;
        @bottom-center {
            content: "Volt Bank S.A. — CNPJ 00.000.000/0001-91 — Página " counter(page) " de " counter(pages);
            font-size: 7px;
            color: #999;
            font-family: 'Segoe UI', Arial, sans-serif;
        }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        color: ${BRAND.text};
        background: #f4f5f7;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    /* ═══ HEADER BANCÁRIO ═══ */
    .bank-header {
        background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.secondary} 50%, ${BRAND.dark} 100%);
        color: #fff;
        padding: 20px 28px;
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
        overflow: hidden;
    }
    .bank-header::after {
        content: '';
        position: absolute;
        top: -50%;
        right: -10%;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(0,255,157,0.08) 0%, transparent 70%);
        border-radius: 50%;
    }
    .bank-header .logo-area {
        display: flex;
        align-items: center;
        gap: 16px;
        z-index: 1;
    }
    .bank-header .logo-svg {
        width: 48px;
        height: 48px;
    }
    .bank-header .logo-text h1 {
        font-size: 22px;
        font-weight: 900;
        letter-spacing: 2px;
        text-transform: uppercase;
        line-height: 1.1;
    }
    .bank-header .logo-text h1 span {
        color: ${BRAND.accent};
    }
    .bank-header .logo-text .tagline {
        font-size: 10px;
        opacity: 0.6;
        letter-spacing: 3px;
        text-transform: uppercase;
        font-weight: 300;
    }
    .bank-header .header-right {
        text-align: right;
        z-index: 1;
        line-height: 1.5;
    }
    .bank-header .header-right .title {
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 1px;
    }
    .bank-header .header-right .subtitle {
        font-size: 10px;
        opacity: 0.6;
    }
    .bank-header .header-right .date {
        font-size: 9px;
        opacity: 0.5;
        margin-top: 4px;
    }

    /* ═══ ACENTO VERDE ═══ */
    .accent-bar {
        height: 4px;
        background: linear-gradient(90deg, ${BRAND.accent}, ${BRAND.accent2}, ${BRAND.gold});
    }

    /* ═══ CONTEÚDO ═══ */
    .content {
        padding: 16px 20px 20px;
        background: #fff;
    }

    /* ═══ KPI CARDS BANCÁRIOS ═══ */
    .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 16px;
    }
    .kpi-card {
        background: #fff;
        border-radius: 10px;
        padding: 12px 14px;
        border: 1px solid ${BRAND.border};
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        display: flex;
        align-items: center;
        gap: 12px;
        transition: box-shadow 0.2s;
    }
    .kpi-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .kpi-card .icon-box {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
    }
    .kpi-card .info { flex: 1; }
    .kpi-card .info .label {
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: ${BRAND.muted};
        margin-bottom: 2px;
    }
    .kpi-card .info .value {
        font-size: 18px;
        font-weight: 900;
        line-height: 1.1;
    }
    .kpi-card .info .sub {
        font-size: 9px;
        opacity: 0.6;
        margin-top: 1px;
    }
    .icon-danger { background: #fde8e8; color: ${BRAND.danger}; }
    .icon-success { background: #e8f8f0; color: ${BRAND.success}; }
    .icon-warning { background: #fef3e2; color: ${BRAND.warning}; }
    .icon-info { background: #e1f0fa; color: ${BRAND.info}; }
    .value-danger { color: ${BRAND.danger}; }
    .value-success { color: ${BRAND.success}; }
    .value-warning { color: ${BRAND.warning}; }
    .value-info { color: ${BRAND.info}; }

    /* ═══ RESUMO CATEGORIAS ═══ */
    .summary-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 14px;
    }
    .summary-card {
        padding: 8px 12px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 11px;
        border: 1px solid;
    }
    .summary-card .count {
        font-size: 22px;
        font-weight: 900;
        min-width: 36px;
        text-align: center;
    }
    .summary-card .desc { line-height: 1.3; }
    .summary-card .desc strong { font-size: 11px; }
    .summary-card .desc small { font-size: 9px; opacity: 0.7; display: block; }
    .sc-critico { background: #fde8e8; border-color: #f5c6cb; color: #721c24; }
    .sc-ok { background: #e8f8f0; border-color: #c3e6cb; color: #155724; }
    .sc-sem { background: #f8f9fa; border-color: #dee2e6; color: #495057; }
    .sc-reg { background: #e1f0fa; border-color: #b8daff; color: #004085; }

    /* ═══ SEÇÃO ═══ */
    .section-title {
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 8px 0 6px;
        border-bottom: 2px solid ${BRAND.primary};
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .section-title .count-badge {
        background: ${BRAND.primary};
        color: #fff;
        font-size: 9px;
        padding: 1px 8px;
        border-radius: 10px;
        font-weight: 700;
    }

    /* ═══ TABELA ═══ */
    .table-wrap {
        border: 1px solid ${BRAND.border};
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 14px;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 8.5px;
    }
    thead th {
        background: ${BRAND.primary};
        color: #fff;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 7px 6px;
        text-align: left;
        font-size: 7px;
        white-space: nowrap;
    }
    thead th.num { text-align: right; }
    thead th.center { text-align: center; }
    tbody td {
        padding: 5px 6px;
        border-bottom: 1px solid #eee;
        vertical-align: middle;
    }
    tbody tr:nth-child(even) td { background: #fafbfc; }
    tbody tr:hover td { background: #f0f4f8; }
    tbody tr.reg td { opacity: 0.5; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.center { text-align: center; }
    td.mono { font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace; font-size: 8px; }
    td.strong { font-weight: 800; }
    td.green { color: ${BRAND.success}; font-weight: 700; }
    td.amber { color: #e67e22; font-weight: 700; }
    td.muted { color: #999; }
    td.red { color: ${BRAND.danger}; font-weight: 700; }

    .badge {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 3px;
        font-size: 7px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
    .badge-reg { background: #d4edda; color: #155724; }
    .badge-inad { background: #fde8e8; color: #721c24; }
    .badge-ok { background: #d4edda; color: #155724; }
    .badge-warn { background: #fff3cd; color: #856404; }
    .badge-na { background: #e9ecef; color: #495057; }
    .badge-total { background: #d4edda; color: #155724; }
    .badge-min { background: #fff3cd; color: #856404; }
    .badge-parc { background: #e1f0fa; color: #004085; }

    /* ═══ PAYMENT HISTORY ─── */
    .payment-dots {
        display: flex;
        gap: 2px;
        align-items: center;
        justify-content: center;
    }
    .payment-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
    }
    .dot-total { background: ${BRAND.success}; }
    .dot-min { background: ${BRAND.warning}; }
    .dot-parc { background: ${BRAND.info}; }

    /* ═══ FILTRO CPF ═══ */
    .filter-badge {
        display: inline-block;
        background: ${BRAND.accent};
        color: ${BRAND.primary};
        font-size: 9px;
        font-weight: 800;
        padding: 2px 10px;
        border-radius: 4px;
        margin-left: 8px;
        letter-spacing: 0.5px;
    }

    /* ═══ REGULARIZED TABLE ═══ */
    .reg-table { font-size: 8px; }
    .reg-table td { padding: 4px 8px; }

    /* ═══ PAYMENT HISTORY DETAIL ═══ */
    .payment-history-bar {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .ph-bar {
        height: 4px;
        border-radius: 2px;
        flex: 1;
        background: #eee;
        overflow: hidden;
    }
    .ph-bar-fill {
        height: 100%;
        border-radius: 2px;
        background: linear-gradient(90deg, ${BRAND.accent}, ${BRAND.accent2});
    }

    /* ═══ FOOTER ═══ */
    .bank-footer {
        background: ${BRAND.primary};
        color: rgba(255,255,255,0.5);
        padding: 10px 20px;
        font-size: 7px;
        display: flex;
        justify-content: space-between;
        border-radius: 0 0 12px 12px;
        line-height: 1.6;
    }
    .bank-footer strong { color: rgba(255,255,255,0.8); }

    @media print {
        body { background: #fff; }
        .bank-header { border-radius: 0; }
        .bank-footer { border-radius: 0; }
        .kpi-card { break-inside: avoid; box-shadow: none; }
        .table-wrap { break-inside: auto; }
        tr { break-inside: avoid; }
    }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- HEADER BANCÁRIO -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="bank-header">
    <div class="logo-area">
        <svg class="logo-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Fundo -->
            <rect width="48" height="48" rx="10" fill="#00ff9d" opacity="0.15"/>
            <!-- Símbolo do raio -->
            <path d="M26 8L14 26h8l-2 14L32 22h-8l2-14z" fill="#00ff9d"/>
            <!-- Detalhe interno -->
            <path d="M24 12L16 24h6l-1.5 9L30 19h-6l1.5-7z" fill="#fff" opacity="0.3"/>
            <!-- Brilho canto -->
            <circle cx="14" cy="14" r="3" fill="#fff" opacity="0.15"/>
        </svg>
        <div class="logo-text">
            <h1>Volt <span>Bank</span></h1>
            <div class="tagline">Soluções Financeiras Inteligentes</div>
        </div>
    </div>
    <div class="header-right">
        <div class="title">RELATÓRIO DE INADIMPLÊNCIA</div>
        <div class="subtitle">Painel de Massas em Atraso — Gerencial</div>
        <div class="date">${hoje} às ${horario} · ${FILTER_CPF ? `Filtro CPF: ${esc(FILTER_CPF)}` : `${stats.totalUsers} usuários`}</div>
    </div>
</div>
<div class="accent-bar"></div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- CONTEÚDO -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="content">

<!-- KPI CARDS -->
<div class="kpi-grid">
    <div class="kpi-card">
        <div class="icon-box icon-danger">📋</div>
        <div class="info">
            <div class="label">Em Atraso</div>
            <div class="value value-danger">${stats.overdueCount || 0} <span style="font-size:12px;font-weight:400;color:#999;">/ ${stats.totalUsers || 1}</span></div>
            <div class="sub">Taxa: ${stats.overdueRatePercentage || 0}%</div>
        </div>
    </div>
    <div class="kpi-card">
        <div class="icon-box icon-warning">⏱️</div>
        <div class="info">
            <div class="label">Média de Atraso</div>
            <div class="value value-warning">${stats.avgDaysOverdue || 0} <span style="font-size:12px;font-weight:400;">dias</span></div>
            <div class="sub">Acima do vencimento</div>
        </div>
    </div>
    <div class="kpi-card">
        <div class="icon-box icon-success">💰</div>
        <div class="info">
            <div class="label">Montante Inadimplente</div>
            <div class="value value-success">R$ ${fmt(stats.totalOverdueAmount || 0)}</div>
            <div class="sub">Faturas + Encargos</div>
        </div>
    </div>
    <div class="kpi-card">
        <div class="icon-box icon-info">✅</div>
        <div class="info">
            <div class="label">Regularizadas (24h)</div>
            <div class="value value-info">${stats.regularizedCount || 0}</div>
            <div class="sub">Pagaram nos últimos 24h</div>
        </div>
    </div>
</div>

<!-- RESUMO CATEGORIAS -->
<div class="summary-row">
    <div class="summary-card sc-critico">
        <div class="count" style="color:${BRAND.danger};">${abaixo.length}</div>
        <div class="desc">
            <strong>⚠️ Abaixo do Mínimo</strong>
            <small>Pagaram < 10% da fatura</small>
        </div>
    </div>
    <div class="summary-card sc-ok">
        <div class="count" style="color:${BRAND.success};">${acima.length}</div>
        <div class="desc">
            <strong>✅ Acima do Mínimo</strong>
            <small>Pagaram ≥ 10% da fatura</small>
        </div>
    </div>
    <div class="summary-card sc-sem">
        <div class="count" style="color:#495057;">${semPag.length}</div>
        <div class="desc">
            <strong>— Sem Pagamento</strong>
            <small>Não pagaram nada</small>
        </div>
    </div>
    <div class="summary-card sc-reg">
        <div class="count" style="color:#004085;">${regularizedReport.length}</div>
        <div class="desc">
            <strong>✅ Regularizadas</strong>
            <small>Quitaram nas últimas 24h</small>
        </div>
    </div>
</div>

<!-- TABELA PRINCIPAL -->
${sorted.length > 0 ? `
<div class="section-title">
    📊 Detalhamento de Massas
    <span class="count-badge">${sorted.length} registro(s)</span>
    ${FILTER_CPF ? `<span class="filter-badge">CPF: ${fmtCPF(FILTER_CPF)}</span>` : ''}
</div>
<div class="table-wrap">
<table>
<thead>
<tr>
    <th width="90">CPF</th>
    <th>Nome / Massa</th>
    <th width="70">Status</th>
    <th class="num" width="75">Valor Original</th>
    <th class="num" width="50">Dias</th>
    <th class="num" width="72">Encargos</th>
    <th class="num" width="80">Total Quitação</th>
    <th class="num" width="75">Total Pago</th>
    <th class="num" width="55">%</th>
    <th class="num" width="75">Saldo Rest.</th>
    <th class="center" width="65">Status Min.</th>
    <th class="center" width="50">Pagto.</th>
</tr>
</thead>
<tbody>
${sorted.map(m => {
    const ps = m.paymentSummary || {};
    const enc = m.encargos || {};
    const isReg = m.accountStatus === 'regularizada';
    const statusLabel = ps.statusMinimo === 'ACIMA' ? 'Acima' : ps.statusMinimo === 'ABAIXO' ? 'Abaixo' : 'Sem Pag.';
    const statusClass = ps.statusMinimo === 'ACIMA' ? 'badge-ok' : ps.statusMinimo === 'ABAIXO' ? 'badge-warn' : 'badge-na';
    const pct = m.faturaFechada > 0 ? Math.round((ps.totalPago || 0) / m.faturaFechada * 100) : 0;
    const pctClass = pct >= 100 ? 'green' : pct >= 10 ? 'amber' : 'muted';

    // Payment history dots (max 3)
    const history = m.paymentHistory || [];
    const dots = history.slice(0, 5).map(p => {
        const dotClass = p.paymentType === 'TOTAL' ? 'dot-total' : p.paymentType === 'MINIMO' ? 'dot-min' : (p.paymentType === 'PARCIAL' ? 'dot-parc' : 'dot-parc');
        return `<span class="payment-dot ${dotClass}" title="R$ ${fmt(p.amount)} — ${p.paymentType}"></span>`;
    }).join('');
    const extraDots = history.length > 5 ? `<span style="font-size:7px;color:#999;margin-left:2px;">+${history.length-5}</span>` : '';

    return `<tr class="${isReg ? 'reg' : ''}">
        <td class="mono">${fmtCPF(m.cpf)}</td>
        <td><strong>${esc(m.fullName || '')}</strong></td>
        <td>${isReg ? '<span class="badge badge-reg">REGULARIZADA</span>' : '<span class="badge badge-inad">INADIMPLENTE</span>'}</td>
        <td class="num mono">R$ ${fmt(m.faturaFechada || 0)}</td>
        <td class="num center ${isReg ? 'muted' : 'red'}">${m.daysOverdue || 0}d</td>
        <td class="num ${isReg ? 'muted' : 'amber'}">R$ ${fmt(enc.totalEncargos || 0)}</td>
        <td class="num strong">R$ ${fmt(m.totalQuitacao || 0)}</td>
        <td class="num ${ps.totalPago > 0 ? 'green' : 'muted'}">R$ ${fmt(ps.totalPago || 0)}</td>
        <td class="num ${pctClass}">${pct}%</td>
        <td class="num ${ps.saldoRestante > 0 ? 'amber' : 'muted'}">R$ ${fmt(ps.saldoRestante || 0)}</td>
        <td class="center"><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td class="center">
            ${history.length > 0 ? `<div class="payment-dots">${dots}${extraDots}</div>` : '<span class="muted">—</span>'}
        </td>
    </tr>`;
}).join('\n')}</tbody>
</table>
</div>
` : '<div style="padding:30px;text-align:center;color:#999;font-size:13px;border:1px solid #dee2e6;border-radius:8px;">Nenhuma massa em atraso encontrada.</div>'}

<!-- REGULARIZADAS -->
${regularizedReport.length > 0 ? `
<div class="section-title">
    ✅ Massas Regularizadas nas Últimas 24h
    <span class="count-badge">${regularizedReport.length} registro(s)</span>
</div>
<div class="table-wrap">
<table class="reg-table">
<thead>
<tr>
    <th>CPF</th>
    <th>Nome</th>
    <th class="num">Dívida Original</th>
    <th class="num">Valor Pago</th>
    <th class="num">%</th>
    <th class="center">Tipo</th>
    <th class="center">Há</th>
    <th>Regularizado em</th>
    <th class="center">Vencido há</th>
</tr>
</thead>
<tbody>
${regularizedReport.map(r => {
    const tipoLabel = r.paymentType === 'TOTAL' ? 'Total' : r.paymentType === 'MINIMO' ? 'Mínimo' : 'Parcial';
    const tipoClass = r.paymentType === 'TOTAL' ? 'badge-total' : r.paymentType === 'MINIMO' ? 'badge-min' : 'badge-parc';
    const hoursAgo = r.hoursAgo < 1 ? '<1h' : r.hoursAgo + 'h';
    const paidAt = r.paidAt ? fmtDateTimeBR(r.paidAt) : '—';
    const pct = r.valorTotal > 0 ? Math.round(r.valorPago / r.valorTotal * 100) : 0;

    let hoursLabel = '';
    if (r.hoursToPay !== null) {
        if (r.hoursToPay > 0) {
            const days = Math.floor(r.hoursToPay / 24);
            const h = r.hoursToPay % 24;
            hoursLabel = days > 0 ? `${days}d ${h}h` : `${h}h`;
        } else {
            hoursLabel = '0h (ant.)';
        }
    } else {
        hoursLabel = '—';
    }

    return `<tr>
        <td class="mono">${fmtCPF(r.cpf)}</td>
        <td><strong>${esc(r.fullName)}</strong></td>
        <td class="num mono">R$ ${fmt(r.valorTotal)}</td>
        <td class="num green mono">R$ ${fmt(r.valorPago)}</td>
        <td class="num">${pct}%</td>
        <td class="center"><span class="badge ${tipoClass}">${tipoLabel}</span></td>
        <td class="center">${hoursAgo}</td>
        <td class="mono" style="font-size:7.5px;">${paidAt}</td>
        <td class="center">${r.hoursToPay !== null && r.hoursToPay > 0 ? `<span class="badge badge-warn">${hoursLabel}</span>` : hoursLabel}</td>
    </tr>`;
}).join('\n')}
</tbody>
</table>
</div>
` : ''}

<!-- RESUMO DOS PAGAMENTOS -->
${(() => {
    const allPayments = [];
    for (const m of sorted) {
        const hist = m.paymentHistory || [];
        for (const p of hist) {
            allPayments.push({ ...p, cpf: m.cpf, fullName: m.fullName });
        }
    }
    if (allPayments.length === 0) return '';

    const totalPagoGeral = allPayments.reduce((s, p) => s + p.amount, 0);
    const porTipo = { TOTAL: 0, MINIMO: 0, PARCIAL: 0 };
    allPayments.forEach(p => { porTipo[p.paymentType] = (porTipo[p.paymentType] || 0) + p.amount; });

    return `
<div class="section-title">
    💳 Resumo de Pagamentos Realizados
    <span class="count-badge">${allPayments.length} pagamento(s) · R$ ${fmt(totalPagoGeral)}</span>
</div>
<div class="summary-row">
    <div class="summary-card sc-ok">
        <div class="count" style="color:${BRAND.success};">${porTipo.TOTAL > 0 ? 'R$ '+fmt(porTipo.TOTAL) : 0}</div>
        <div class="desc">
            <strong>🔵 Pagamentos Totais</strong>
            <small>${allPayments.filter(p => p.paymentType === 'TOTAL').length} ocorrência(s)</small>
        </div>
    </div>
    <div class="summary-card sc-critico">
        <div class="count" style="color:${BRAND.warning};">${porTipo.MINIMO > 0 ? 'R$ '+fmt(porTipo.MINIMO) : 0}</div>
        <div class="desc">
            <strong>🟡 Pagamentos Mínimos</strong>
            <small>${allPayments.filter(p => p.paymentType === 'MINIMO').length} ocorrência(s)</small>
        </div>
    </div>
    <div class="summary-card sc-sem">
        <div class="count" style="color:${BRAND.info};">${porTipo.PARCIAL > 0 ? 'R$ '+fmt(porTipo.PARCIAL) : 0}</div>
        <div class="desc">
            <strong>🔵 Pagamentos Parciais</strong>
            <small>${allPayments.filter(p => p.paymentType === 'PARCIAL').length} ocorrência(s)</small>
        </div>
    </div>
    <div class="summary-card sc-reg">
        <div class="count" style="color:#004085;">${allPayments.length}</div>
        <div class="desc">
            <strong>📊 Total de Transações</strong>
            <small>${new Set(allPayments.map(p => p.cpf)).size} massa(s) com pagamento</small>
        </div>
    </div>
</div>`;
})()}

</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- FOOTER -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="bank-footer">
    <div>
        <strong>Volt Bank S.A.</strong> · CNPJ 00.000.000/0001-91<br>
        Av. Paulista, 1000 · São Paulo · SP · Brasil
    </div>
    <div style="text-align:right;">
        <strong>Relatório Gerencial de Inadimplência</strong><br>
        Gerado em ${hoje} às ${horario} · ${stats.totalUsers} usuários · ${stats.overdueCount} em atraso
    </div>
</div>

</body>
</html>`;

    // ── 4. Salvar HTML ─────────────────────────────────────────────────
    const dateStr = new Date().toISOString().slice(0, 10);
    const outPath = path.join(__dirname, `relatorio_massas_${dateStr}.html`);
    fs.writeFileSync(outPath, html, 'utf-8');

    console.log(`\n✅ Relatório gerado: ${outPath}`);
    console.log(`   📊 ${sorted.length} massa(s) em atraso`);
    console.log(`   ⚠️  ${abaixo.length} crítica(s) (abaixo do mínimo)`);
    console.log(`   ✅ ${acima.length} acima do mínimo`);
    console.log(`   — ${semPag.length} sem pagamento`);
    console.log(`   ✅ ${regularizedReport.length} regularizada(s) (24h)`);
    if (FILTER_CPF) console.log(`   🔍 Filtro: CPF ${FILTER_CPF}`);
    console.log(`   📋  Dados gerados com ${USE_LIVE ? 'API ao vivo' : 'JSON salvo'}`);
    if (USE_LIVE && !ADMIN_TOKEN) console.log('   ⚠️  Token admin não fornecido — rota pode retornar 403. Use --token=...');
    console.log(`\n   ▶  Abra no navegador e use Ctrl+P → "Salvar como PDF"`);
    console.log(`   📐  Orientação: Paisagem · Tamanho: A4 · Margens: Mínimas\n`);
}

main().catch(err => { console.error('Erro:', err); process.exit(1); });
