#!/usr/bin/env node
/**
 * render_massa_pdf_preview.cjs
 * Gera os PDFs da FATURA UNIVERSAL (4 páginas) LOCALMENTE — sem enviar ao Telegram —
 * para uma massa real, usando os dados enriquecidos da API + queries diretas no banco.
 *
 * Replica EXATAMENTE a montagem do pdfData da rota POST /admin/telegram/topics/:cpf/send-pdf
 * (API/index.cjs:3095-3360), mas grava o PDF em disco em vez de chamar sendDocument.
 *
 * Uso:
 *   node scripts/render_massa_pdf_preview.cjs <cpf> [--open] [--closed]
 *   Ex.: node scripts/render_massa_pdf_preview.cjs 12310012300
 *
 * Saída:
 *   .freebuff/pdf-preview/massa_<cpf>_closed.pdf
 *   .freebuff/pdf-preview/massa_<cpf>_open.pdf
 *   .freebuff/pdf-preview/massa_<cpf>_index.html  (viewer para o Preview)
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const { generateUniversalInvoicePDF } = require('../services/invoicePdfService');
const { buildBoletoData } = require('../utils/boletoMath');
const { toDateOnly, toDateBR } = require('../utils/dateUtils');
const {
    calcMulta, calcJurosMora, calcJurosRemuneratorios, calcAllCharges, calcEffectiveRates,
} = require('../utils/invoiceMath');

const OUT_DIR = path.join(__dirname, '..', '..', '.freebuff', 'pdf-preview');
fs.mkdirSync(OUT_DIR, { recursive: true });

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const POOL = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'fintechbank',
});
const SCHEMA = process.env.DB_SCHEMA || 'fintech';

const fmtCpf = (cpf) => {
    const c = String(cpf).replace(/\D/g, '').padStart(11, '0');
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9, 11)}`;
};

async function login(cpf) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, password: process.env.MASSA_PASSWORD || 'admin999' }),
    });
    const j = await res.json();
    if (!j.token) throw new Error(`Login falhou para ${cpf}: ${JSON.stringify(j).slice(0, 200)}`);
    return j.token;
}

async function fetchCreditCard(token, cpf) {
    // Tenta /users/me (o próprio CPF). Se a massa não tiver senha admin999, o admin
    // pode consultar via /admin/users/:cpf — mas /users/me é o que o app usa.
    const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    const user = j.user || j;
    if (!user || !user.creditCard) {
        // Fallback: login como admin e buscar o usuário pelo CPF
        const adm = await login(process.env.ADMIN_CPF || '99999999999');
        const res2 = await fetch(`${API_BASE}/api/admin/users/${cpf}`, {
            headers: { Authorization: `Bearer ${adm}` },
        });
        const j2 = await res2.json();
        const u2 = j2.user || j2;
        return u2.creditCard || {};
    }
    return user.creditCard;
}

async function fetchPlans(cpf) {
    const { rows } = await POOL.query(
        `SELECT p.installment_amount, p.remaining_installments, p.installments, p.next_due_date,
                COALESCE(t.description, p.description) AS description,
                p.original_amount, p.total_with_interest, p.interest_rate
         FROM ${SCHEMA}.installment_plans p
         LEFT JOIN ${SCHEMA}.transactions t ON t.id = p.purchase_tx_id
         WHERE p.cpf = $1 AND LOWER(p.status) = 'active' AND p.remaining_installments > 0
         ORDER BY p.next_due_date ASC`,
        [cpf]
    );
    return rows || [];
}

async function fetchCardFinal(cpf) {
    const { rows } = await POOL.query(
        `SELECT card_number_raw FROM ${SCHEMA}.cards
         WHERE user_cpf = $1 ORDER BY created_at DESC LIMIT 1`,
        [cpf]
    );
    return (rows && rows[0]?.card_number_raw) ? String(rows[0].card_number_raw).slice(-4) : '****';
}

/** FONTE ÚNICA Febraban — mesmo generatePaymentCodesFallback do invoiceController. */
function generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId) {
    const nossoNumero = String(cpf).replace(/\D/g, '').slice(-10);
    const boletoData = buildBoletoData({
        banco: '598', bancoDv: 9, bancoNome: '598 - Fintech Bank App',
        agencia: '0001', conta: '00000001', carteira: '09',
        nossoNumero,
        documento: String(invoiceId).replace(/[^0-9]/g, '').slice(0, 20) || nossoNumero,
        vencimento: dueDate + 'T00:00:00',
        emissao: new Date().toISOString(),
        valor: amount,
        sacado: name, sacadoCpf: cpf,
    });
    const pixKey = 'financeiro@fintechbank.com.br';
    const txid = String(invoiceId).replace(/[-\s]/g, '').slice(0, 25);
    const emv = (tag, value) => `${tag}${String(value.length).padStart(2, '0')}${value}`;
    let crc = 0xFFFF;
    const crcData = [
        emv('00', '01'), emv('01', '12'), emv('26', emv('00', 'BR.GOV.BCB.PIX') + emv('01', pixKey)),
        emv('52', '0000'), emv('53', '986'), emv('54', amount.toFixed(2)), emv('58', 'BR'),
        emv('59', 'Fintech Bank App'.slice(0, 25)), emv('60', 'Sao Paulo'.slice(0, 15)),
        emv('62', emv('05', txid)),
    ].join('') + '6304';
    for (let i = 0; i < crcData.length; i++) {
        crc ^= crcData.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
            else crc = crc << 1;
            crc &= 0xFFFF;
        }
    }
    return {
        pix: { payload: crcData + crc.toString(16).toUpperCase().padStart(4, '0') },
        boleto: { linhaDigitavel: boletoData.linhaDigitavel, codigoBarras: boletoData.codigoBarras },
    };
}

function buildPdfData({ cpf, cc, user, type, plans, cartaoFinal }) {
    const openAmount = cc.currentInvoice || 0;
    const originalClosedAmount = cc._closedInvoiceValorTotal ?? cc.closedInvoiceAmount ?? cc.closedInvoice ?? 0;
    const closedAmount = cc.closedInvoice ?? 0;
    const isPaid = cc.closedInvoiceIsPaid ?? false;
    const valorPago = cc._closedInvoiceValorPago ?? 0;
    const closedInvoiceResidual = cc.closedInvoiceResidual ?? 0;

    const diffTime = Math.abs(new Date().getTime() - new Date(cc.closedInvoiceDueDate || cc.invoiceDueDate || '2026-07-15').getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const explicitDays = user?.daysOverdue ?? cc.daysOverdue ?? 0;
    const overdueDays = explicitDays > 0 ? explicitDays : (originalClosedAmount > 0 ? Math.max(7, diffDays) : 0);

    const charges = cc.closedInvoiceCharges || {};
    const multa = typeof charges.multa === 'number' ? charges.multa : calcMulta(originalClosedAmount);
    const jurosMora = typeof charges.jurosMora === 'number' ? charges.jurosMora : calcJurosMora(originalClosedAmount, overdueDays);
    const jurosRemun = typeof charges.jurosRemuneratorios === 'number' ? charges.jurosRemuneratorios : calcJurosRemuneratorios(originalClosedAmount, overdueDays);
    const iofTotal = typeof charges.iof === 'number' ? charges.iof : calcAllCharges(originalClosedAmount, overdueDays).iof;
    const totalEncargos = typeof charges.totalEncargos === 'number' ? charges.totalEncargos : calcAllCharges(originalClosedAmount, overdueDays).total;

    const iofFixo = originalClosedAmount > 0 ? Math.round(originalClosedAmount * 0.0038 * 100) / 100 : 0;
    const iofDiario = Math.max(0, iofTotal - iofFixo);
    const totalOpenConsolidated = cc.currentInvoiceTotal ?? 0;
    const minOpenConsolidated = cc.currentInvoiceMinimo ?? 0;
    const minClosedOriginal = Math.round(originalClosedAmount * 0.10 * 100) / 100;
    const minClosedWithCharges = Math.round((minClosedOriginal + totalEncargos) * 100) / 100;

    const closedDueIso = cc.closedInvoiceDueDate || null;
    const openDueIso = cc.invoiceDueDate || null;
    const refDueIso = type === 'open' ? (openDueIso || closedDueIso) : closedDueIso;
    const refDue = refDueIso ? new Date(refDueIso) : null;
    const periodoLabel = (() => {
        if (!refDue || isNaN(refDue.getTime())) return '';
        const _m = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        return `${_m[refDue.getMonth()]}/${String(refDue.getFullYear()).slice(2)}`;
    })();
    let previsaoFechamento = null;
    if (refDue && !isNaN(refDue.getTime())) {
        const p = new Date(refDue);
        p.setDate(p.getDate() - 7);
        previsaoFechamento = p.toISOString();
    }

    // PÁGINA 2 — movimentações reais (mesma regra da rota send-pdf)
    const purchaseTypes = ['CREDIT', 'SHOP_CREDIT', 'INVOICE_INSTALLMENT', 'SUBSCRIPTION'];
    // Plano 1.2: na fatura ABERTA, incluir pagamentos (PAYMENT) com valor NEGATIVO (verde).
    const paymentTypes = ['PAYMENT', 'INVOICE_PAYMENT', 'INVOICE_ANTICIPATION'];
    const source = type === 'closed'
        ? ((cc.closedTransactions && cc.closedTransactions.length > 0) ? cc.closedTransactions : (cc.transactions || []))
        : (cc.transactions || []);
    // Formata a parcela da linha como "02/04" (zero-padded) — mesmo helper da rota send-pdf
    const formatParcela = (tx) => {
        if (!tx) return '';
        let cur = tx.currentInstallment, total = tx.totalInstallments;
        if (tx.installments && typeof tx.installments === 'string') {
            const m = tx.installments.match(/(\d+)\s*\/\s*(\d+)/);
            if (m) { cur = parseInt(m[1], 10); total = parseInt(m[2], 10); }
        }
        if (!cur || !total) return '';
        return `${String(cur).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
    };
    const movimentacoes = source
        .filter(tx => purchaseTypes.includes(tx.type) || (type === 'open' && paymentTypes.includes(tx.type)))
        .map(tx => {
            const isPagamento = paymentTypes.includes(tx.type);
            return {
                data: tx.date ? toDateBR(tx.date) : '',
                descricao: tx.merchant || tx.description || 'Lançamento',
                valor: isPagamento ? -(Math.abs(parseFloat(tx.amount) || 0)) : Math.abs(parseFloat(tx.amount) || 0),
                tipo: isPagamento ? 'pagamento' : 'compra',
                // Parcela (02/04) — do enrich/snapshot; vazio quando à vista.
                parcela: formatParcela(tx),
                // Juros do financiamento (art. 52 CDC) — attachPlanJurosInfo no enrich.
                jurosTotal: Number(tx.jurosTotal) > 0 ? Math.round(Number(tx.jurosTotal) * 100) / 100 : 0,
                originalAmount: tx.originalAmount != null ? Math.round(Number(tx.originalAmount) * 100) / 100 : null,
                totalParcelado: tx.totalParcelado != null ? Math.round(Number(tx.totalParcelado) * 100) / 100 : null,
                taxaEfetivaMensal: tx.taxaEfetivaMensal != null ? (Number(tx.taxaEfetivaMensal) * 100) : null,
            };
        })
        .slice(0, 60);

    // Enriquecer juros da FECHADA (snapshot não persiste juros) — casa com plano
    // ativo de mesma qtd de parcelas + mesmo valor (mesma heurística do send-pdf).
    const _enrichJuros = (tx, plan) => {
        if (!plan) return tx;
        const rate = Number(plan.interest_rate || 0);
        const original = Number(plan.original_amount || 0);
        const totalWI = Number(plan.total_with_interest && plan.total_with_interest > 0 ? plan.total_with_interest : 0) || original;
        if (!(original > 0)) return tx;
        const _ef = calcEffectiveRates(rate, Number(plan.installments) || 1);
        return {
            ...tx,
            jurosTotal: rate > 0 ? Math.round(Math.max(0, totalWI - original) * 100) / 100 : 0,
            originalAmount: Math.round(original * 100) / 100,
            totalParcelado: Math.round(totalWI * 100) / 100,
            taxaEfetivaMensal: _ef.mensal != null ? Math.round(Number(_ef.mensal) * 10000) / 100 : null,
        };
    };
    for (let i = 0; i < movimentacoes.length; i++) {
        const tx = movimentacoes[i];
        if (Number(tx.jurosTotal || 0) > 0 || (tx.totalParcelado != null && Number(tx.totalParcelado) > 0)) continue;
        if (!tx.parcela) continue;
        const _mm = tx.parcela.match(/^(\d+)\/(\d+)$/);
        if (!_mm) continue;
        const _qty = parseInt(_mm[2], 10);
        const _amt = Number(tx.valor || 0);
        const _candidates = (plans || []).filter(p =>
            Number(p.installments) === _qty &&
            Math.abs(Number(p.installment_amount || 0) - _amt) < 0.01
        );
        const _plan = _candidates.find(p => Number(p.interest_rate) > 0) || _candidates[0];
        movimentacoes[i] = _plan ? _enrichJuros(tx, _plan) : tx;
    }

    // Parcelas futuras
    let totalProximas = 0, proximaFatura = 0;
    const dueDay = cc.dueDay || 15;
    const nextDueRef = new Date(cc.closedInvoiceDueDate || cc.invoiceDueDate || Date.now());
    nextDueRef.setMonth(nextDueRef.getMonth() + 1);
    nextDueRef.setDate(dueDay);
    const parcelasFuturas = (plans || []).map(p => {
        const inst = Math.abs(parseFloat(p.installment_amount) || 0);
        totalProximas += inst;
        const pd = p.next_due_date ? new Date(p.next_due_date) : null;
        if (pd && pd <= nextDueRef) proximaFatura += inst;
        const cleanDesc = String(p.description || 'Parcela de compra').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
        const currentInst = p.installments - p.remaining_installments + 1;
        return {
            data: pd ? `${String(pd.getDate()).padStart(2, '0')}/${String(pd.getMonth() + 1).padStart(2, '0')}` : '',
            descricao: `${cleanDesc} (${currentInst}/${p.installments})`,
            valor: inst,
        };
    }).slice(0, 40);

    // Códigos de pagamento
    let pixCopiaECola = '', boletoLinhaDigitavel = '';
    try {
        const codes = generatePaymentCodesFallback(
            cpf, user?.fullName || '', type === 'open' ? totalOpenConsolidated : originalClosedAmount,
            toDateOnly(cc.closedInvoiceDueDate || cc.invoiceDueDate || new Date()), `fatura_${cpf}`
        );
        pixCopiaECola = codes.pix.payload || '';
        boletoLinhaDigitavel = codes.boleto.linhaDigitavel || '';
    } catch (e) {
        console.warn('[preview] Erro ao gerar códigos:', e.message);
    }

    const cpfClean = String(cpf).replace(/\D/g, '');
    return {
        nome: user?.fullName || '',
        cpf,
        cpfFormatado: fmtCpf(cpf),
        cartaoFinal,
        tipo: type === 'open' ? 'open' : 'closed',
        periodo: periodoLabel,
        emissao: new Date().toISOString(),
        vencimento: type === 'open' ? (openDueIso || closedDueIso) : closedDueIso,
        previsaoFechamento,
        limiteTotal: cc.totalLimit || 0,
        limiteDisponivel: cc.availableLimit || 0,
        limiteSaque: 0,
        isPaga: !!isPaid,
        totalEstaFatura: type === 'open' ? totalOpenConsolidated : originalClosedAmount,
        resumo: type === 'open'
            ? {
                anterior: originalClosedAmount,
                pagamento: valorPago,
                pagamentoData: cc.closedInvoicePaidAt || null,
                saldoFinanciado: Math.max(0, closedInvoiceResidual),
                lancamentos: openAmount,
                total: totalOpenConsolidated,
            }
            : {
                anterior: 0,
                pagamento: valorPago,
                pagamentoData: cc.closedInvoicePaidAt || null,
                saldoFinanciado: Math.max(0, originalClosedAmount - valorPago),
                lancamentos: originalClosedAmount,
                total: Math.max(0, originalClosedAmount - valorPago),
            },
        encargos: type === 'open'
            ? [
                { nome: 'Taxa de Multa por Atraso (Herdada)', taxa: '2,00%', valor: multa },
                { nome: 'Juros de Mora (Herdado)', taxa: '0,0333%/dia', valor: jurosMora },
                { nome: 'Juros Remuneratórios (Herdado)', taxa: '0,513%/dia', valor: jurosRemun },
                { nome: 'IOF Adicional Fixo (Herdado)', taxa: '0,38%', valor: iofFixo },
                { nome: 'IOF Diário (Herdado)', taxa: '0,0082%/dia', valor: iofDiario },
            ]
            : [
                { nome: 'Juros do rotativo', taxa: '15,39% a.m.', valor: 0 },
                { nome: 'Juros de mora', taxa: '1,00% a.m. (0,0333%/dia)', valor: 0 },
                { nome: 'Multa por atraso', taxa: '2,00%', valor: 0 },
                { nome: 'IOF de financiamento', taxa: '0,38% + 0,0082% a.d.', valor: 0 },
            ],
        movimentacoes,
        parcelasFuturas,
        proximaFatura: Math.round(proximaFatura * 100) / 100,
        demaisFaturas: Math.round((totalProximas - proximaFatura) * 100) / 100,
        totalProximasFaturas: Math.round(totalProximas * 100) / 100,
        pagamentoMinimo: {
            valor: minClosedOriginal,
            financiado: originalClosedAmount,
            encargos: totalEncargos,
            iof: iofTotal,
            total: minClosedWithCharges,
            jurosLabel: '15,39% a.m. — 453,46% a.a.',
            cetLabel: '15,73% a.m. — 491,21% a.a.',
        },
        parcelasFixas: {
            valor: totalProximas > 0 ? Math.round((totalProximas / 12) * 100) / 100 : 0,
            qtd: totalProximas > 0 ? '12x' : '',
            financiado: Math.round(totalProximas * 100) / 100,
            solicitado: Math.round(totalProximas * 100) / 100,
            iof: 0,
            total: Math.round(totalProximas * 100) / 100,
            jurosLabel: '5,99% a.m. — 102,95% a.a.',
            cetLabel: '6,32% a.m. — 110,71% a.a.',
        },
        pixCopiaECola,
        boletoLinhaDigitavel,
        boleto: {
            banco: '598',
            bancoDv: 9,
            bancoNome: '598 - Fintech Bank App',
            agencia: '0001',
            conta: '00000001',
            carteira: '09',
            nossoNumero: cpfClean.slice(-10),
            documento: cpfClean,
            vencimento: type === 'open' ? (openDueIso || closedDueIso) : closedDueIso,
            emissao: new Date().toISOString(),
            valor: type === 'open' ? totalOpenConsolidated : originalClosedAmount,
            linhaDigitavel: boletoLinhaDigitavel,
            cedente: 'Fintech Bank App S.A.',
            cedenteCpf: '12.345.678/0001-90',
            sacado: user?.fullName || '',
            sacadoCpf: fmtCpf(cpf),
            instrucoes: [
                'Cobrar multa de 2% após o vencimento.',
                'Juros de mora de 0,0333% ao dia após o vencimento.',
                'Este boleto liquida a ' + (type === 'open' ? 'fatura aberta consolidada' : 'fatura fechada') + ' ' + (periodoLabel || '') + '.',
            ],
        },
        nota: type === 'open'
            ? (isPaid
                ? `Fatura Aberta — Total consolidado no corte: R$ ${totalOpenConsolidated.toFixed(2)} (compras + herança + encargos herdados). Fatura fechada anterior PAGA em ${toDateOnly(cc.closedInvoicePaidAt || '')}.`
                : `Fatura Aberta — Total consolidado no corte: R$ ${totalOpenConsolidated.toFixed(2)} (compras + herança + encargos herdados).`)
            : (isPaid
                ? `Fatura QUITADA em ${toDateOnly(cc.closedInvoicePaidAt || '')}. Encargos de atraso herdados e consolidados na Fatura Aberta.`
                : `Fatura EM ABERTO — ${overdueDays} dias de atraso. Encargos do atraso são herdados e consolidados na Fatura Aberta.`),
    };
}

function buildViewer(files, cpf) {
    const cards = files.map((f, i) => `
        <section class="card">
            <div class="card-head">
                <h2>${f.label}</h2>
                <a href="${f.name}" target="_blank" class="btn">Abrir PDF ↗</a>
            </div>
            <embed src="${f.name}#page=2" type="application/pdf" />
        </section>`).join('\n');
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Fatura Universal — Massa ${fmtCpf(cpf)}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f4f6fa; color: #1a2233; padding: 24px; }
    header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .logo { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg,#7c3aed,#06b6d4); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; }
    h1 { font-size: 20px; }
    .sub { color: #64748b; font-size: 13px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(15,23,42,.06); }
    .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .card-head h2 { font-size: 15px; color: #334155; }
    .btn { background: #7c3aed; color: #fff; text-decoration: none; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; }
    .btn:hover { background: #6d28d9; }
    embed { width: 100%; height: 640px; border: 1px solid #e2e8f0; border-radius: 8px; }
    .note { background:#fffbeb; border:1px solid #fde68a; color:#92400e; border-radius:10px; padding:10px 14px; font-size:13px; margin-bottom:20px; }
</style>
</head>
<body>
<header>
    <div class="logo">FB</div>
    <div><h1>Fatura Universal — Massa ${fmtCpf(cpf)}</h1>
    <div class="sub">Gerado localmente via render_massa_pdf_preview.cjs · dados REAIS da API · Página 2 = compras</div></div>
</header>
<div class="note">📄 Embed abre na Página 2 (compras reais). Use "Abrir PDF ↗" para ver as 4 páginas (resumo · compras · parcelas · boleto).</div>
${cards}
</body>
</html>`;
}

async function main() {
    const cpf = (process.argv[2] || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
        console.error('Uso: node scripts/render_massa_pdf_preview.cjs <cpf> [--open] [--closed]');
        process.exit(1);
    }
    const wantOpen = process.argv.includes('--open');
    const wantClosed = process.argv.includes('--closed');
    const types = (wantOpen || wantClosed) ? [] : ['closed', 'open'];
    if (wantClosed) types.push('closed');
    if (wantOpen) types.push('open');

    console.log(`🔎 Massa: ${fmtCpf(cpf)}`);
    const token = await login(cpf);
    console.log('✅ Login OK');
    const cc = await fetchCreditCard(token, cpf);
    const user = (await fetch(`${API_BASE}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())).user || {};

    const plans = await fetchPlans(cpf);
    const cartaoFinal = await fetchCardFinal(cpf);
    console.log(`📊 currentInvoice=${cc.currentInvoice} · currentInvoiceTotal=${cc.currentInvoiceTotal} · closedInvoice=${cc.closedInvoice} · plans=${plans.length}`);

    const files = [];
    for (const type of types) {
        const pdfData = buildPdfData({ cpf, cc, user, type, plans, cartaoFinal });
        const buffer = await generateUniversalInvoicePDF(pdfData);
        const name = `massa_${cpf}_${type}.pdf`;
        fs.writeFileSync(path.join(OUT_DIR, name), buffer);
        files.push({ name, label: type === 'closed' ? 'Fatura Fechada (Pág.2 compras)' : 'Fatura Aberta (Pág.2 compras)' });
        console.log(`✅ Gerado: ${name} (${(buffer.length / 1024).toFixed(0)} KB)`);
    }

    const html = buildViewer(files, cpf);
    fs.writeFileSync(path.join(OUT_DIR, `massa_${cpf}_index.html`), html);
    console.log(`\n📂 Saída: ${OUT_DIR}`);
    console.log(`Viewer: ${path.join(OUT_DIR, `massa_${cpf}_index.html`)}`);
    await POOL.end();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
