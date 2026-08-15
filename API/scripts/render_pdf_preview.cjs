#!/usr/bin/env node
/**
 * render_pdf_preview.cjs
 * Gera os PDFs de visualização (preview) replicando EXATAMENTE o layout da rota
 * POST /admin/telegram/topics/:cpf/send-pdf do API/index.cjs, mais os
 * comprovantes de compra e pagamento (baseados em TransactionReceipt.tsx e
 * PaymentReceipt.tsx).
 *
 * Uso:
 *   node scripts/render_pdf_preview.cjs
 *
 * Saída:
 *   .freebuff/pdf-preview/*.pdf  (5 arquivos)
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const OUT_DIR = path.join(__dirname, '..', '..', '.freebuff', 'pdf-preview');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Dados de referência (massa Chloe 015.653.661-74 — valores reais validados) ──
const DATA = {
    nome: 'Chloe Dubois',
    cpf: '01565366174',
    openAmount: 629.52,            // compras do ciclo aberto
    originalClosedAmount: 3870.86, // valor original da fechada
    isPaid: true,
    paidAt: '2026-08-05T10:30:00.000Z',
    valorPago: 3870.86,
    closedInvoiceResidual: 0,
    overdueDays: 20,
    // Encargos herdados (billing_charges)
    multa: 232.26,
    jurosMora: 64.44,
    jurosRemun: 992.88,
    iof: 60.01,
    totalEncargos: 1349.59,
    totalOpenConsolidated: 1979.11,
    minOpenConsolidated: 1412.54,
};

function fmt(v) { return v.toFixed(2); }

function paidAtLabel(raw) {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw).split('T')[0] || '';
    const _months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return String(d.getDate()).padStart(2, '0') + '/' + (_months[d.getMonth()] || '');
}

const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function dateLong(raw) {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw).split('T')[0] || '';
    return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

// ── Gerador genérico (mesmo desenho do send-pdf) ────────────────────────────
async function makePdf(filename, rows, title, subtitle, extraFooter) {
    const pdfDataBuffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        doc.fillColor('#f59e0b').rect(50, 45, 100, 30).fill();
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(14).text('Fintech Bank', 160, 50);
        doc.fontSize(10).fillColor('#777777').text(`${title}\nGERADO EM: ${new Date().toLocaleString('pt-BR')}`, 400, 50, { align: 'right' });

        doc.moveDown(2);
        doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, 90).lineTo(550, 90).stroke();

        doc.fillColor('#333333').font('Helvetica-Bold').fontSize(12).text('Detalhes do Cliente', 50, 110);
        doc.font('Helvetica').fontSize(10).text(`Nome: ${DATA.nome}`, 50, 130);
        doc.text(`CPF: 015.653.661-74`, 50, 145);
        doc.text(`Fatura: ${subtitle}`, 300, 130);
        doc.text(`Dias em Atraso: ${DATA.overdueDays}d`, 300, 145);

        doc.moveDown(2);

        let y = 180;
        doc.fillColor('#f3f4f6').rect(50, y, 500, 20).fill();
        doc.fillColor('#374151').font('Helvetica-Bold');
        doc.text('CÓDIGO', 60, y + 5);
        doc.text('ITEM / ENCARGO', 140, y + 5);
        doc.text('TAXA / REGRA', 380, y + 5);
        doc.text('VALOR (R$)', 480, y + 5, { align: 'right' });

        y += 20;
        doc.font('Helvetica').fillColor('#1a1a1a');

        for (const r of rows) {
            const itemHeight = doc.heightOfString(r[1], { width: 200 });
            const lineHeight = Math.max(30, itemHeight + 12);
            doc.text(r[0], 60, y + 6);
            doc.text(r[1], 140, y + 6, { width: 200 });
            doc.text(r[2], 350, y + 6);
            doc.text(r[3], 480, y + 6, { align: 'right' });
            y += lineHeight;
            doc.strokeColor('#eee').moveTo(50, y).lineTo(550, y).stroke();
        }

        if (extraFooter) {
            y += 12;
            doc.fontSize(9).fillColor('#4b5563').text(extraFooter, 50, y + 6, { width: 500 });
        }

        doc.fontSize(8).fillColor('#9ca3af').text('Fintech Bank App S.A. — Relatório confidencial para uso exclusivo de backoffice.', 50, 700, { align: 'center' });

        doc.end();
    });
    const file = path.join(OUT_DIR, filename);
    fs.writeFileSync(file, pdfDataBuffer);
    console.log('✅', filename, `(${pdfDataBuffer.length} bytes)`);
}

// ── 1. Fatura Fechada EM ABERTO (não paga) ─────────────────────────────────
async function fechadaEmAberto() {
    const rows = [
        ['FATURA', 'Fatura Fechada Jun/26 (Valor Original no Fechamento)', 'EM ABERTO', fmt(DATA.originalClosedAmount)],
        ['MIN', 'Pagamento Mínimo da Fatura Fechada (sem encargos - 10%)', '', fmt(387.09)],
        ['SALDO', 'Saldo Devedor Restante (após pagamento)', '', fmt(DATA.originalClosedAmount)],
        ['ENCARGOS', 'Encargos do Atraso (herdados pela Fatura Aberta — zerados aqui)', '', '0.00'],
        ['CÓD 3000', 'Taxa de Multa por Atraso (2.0%)', '', '0.00'],
        ['CÓD 2001', 'Juros de Mora (0.0333%/dia)', '', '0.00'],
        ['CÓD 2000', 'Juros Remuneratórios / Financiamento (0.513%/dia)', '', '0.00'],
        ['CÓD 4001', 'IOF Adicional (Fixo - 0.38%)', '', '0.00'],
        ['CÓD 4000', 'IOF Diário (0.0082%/dia)', '', '0.00'],
        ['TOTAL_ENC', 'Valor Total dos Encargos do Atraso (Memória Informativa)', '', '0.00'],
    ];
    await makePdf('fatura_fechada_EM_ABERTO.pdf', rows, 'DIAGNÓSTICO DE FATURA', 'Fatura Fechada Jun/26',
        'Fatura fechada travada — não recebe encargos. Os encargos do atraso (20 dias, R$ 1.349,59) são herdados e exibidos na Fatura Aberta (Fat 3).');
}

// ── 2. Fatura Fechada PAGA ──────────────────────────────────────────────────
async function fechadaPaga() {
    const rows = [
        ['FATURA', 'Fatura Fechada Jun/26 (Valor Original no Fechamento)', 'PAGA ✅', fmt(DATA.originalClosedAmount)],
        ['MIN', 'Pagamento Mínimo da Fatura Fechada (sem encargos - 10%)', '', fmt(387.09)],
        ['SALDO', 'Saldo Devedor Restante (após pagamento)', '', '0.00'],
        ['ENCARGOS', 'Encargos do Atraso (herdados pela Fatura Aberta — zerados aqui)', '', '0.00'],
        ['CÓD 3000', 'Taxa de Multa por Atraso (2.0%)', '', '0.00'],
        ['CÓD 2001', 'Juros de Mora (0.0333%/dia)', '', '0.00'],
        ['CÓD 2000', 'Juros Remuneratórios / Financiamento (0.513%/dia)', '', '0.00'],
        ['CÓD 4001', 'IOF Adicional (Fixo - 0.38%)', '', '0.00'],
        ['CÓD 4000', 'IOF Diário (0.0082%/dia)', '', '0.00'],
        ['TOTAL_ENC', 'Valor Total dos Encargos do Atraso (Memória Informativa)', '', '0.00'],
        ['STATUS', `Fatura quitada em ${String(DATA.paidAt).split('T')[0]}. Encargos de atraso (se houver) foram herdados e consolidados na Fatura Aberta (Fat 3). ✅`, '', ''],
    ];
    await makePdf('fatura_fechada_PAGA.pdf', rows, 'DIAGNÓSTICO DE FATURA', 'Fatura Fechada Jun/26');
}

// ── 3. Fatura Aberta (herança PAGA) ─────────────────────────────────────────
async function abertaPaga() {
    const rows = [
        ['BASE', 'Novas Compras do Mês Corrente (Jul/26)', 'Aberto', fmt(DATA.openAmount)],
        ['MIN', 'Pagamento Mínimo Compras Correntes (10%)', '10.00%', fmt(62.95)],
        ['HERANCA', `Fatura Fechada Anterior PAGA em ${paidAtLabel(DATA.paidAt)} (Jun/26)`, 'Invariável', fmt(DATA.originalClosedAmount)],
        ['CÓD 3000', 'Taxa de Multa por Atraso (Herdada)', '2.00%', fmt(DATA.multa)],
        ['CÓD 2001', 'Juros de Mora (Herdado)', '0.0333%/dia', fmt(DATA.jurosMora)],
        ['CÓD 2000', 'Juros Remuneratórios (Herdado)', '0.513%/dia', fmt(DATA.jurosRemun)],
        ['CÓD 4001', 'IOF Adicional Fixo (Herdado)', '0.38%', fmt(DATA.iof)],
        ['CÓD 4000', 'IOF Diário (Herdado)', '0.0082%/dia', '0.00'],
        ['TOTAL_HER', 'Total Encargos Herdados', `Acumulado (${DATA.overdueDays}d)`, fmt(DATA.totalEncargos)],
        ['TOTAL_CORTE', 'Total Consolidado no Fechamento/Corte', 'Compras + Herança + Encargos', fmt(DATA.totalOpenConsolidated)],
        ['MIN_CORTE', 'Pagamento Mínimo Consolidado no Corte', 'Mínimo + Herança + Encargos', fmt(DATA.minOpenConsolidated)],
    ];
    await makePdf('fatura_aberta_PAGA.pdf', rows, 'DIAGNÓSTICO DE FATURA', 'Fatura Aberta Jul/26');
}

// ── 4. Comprovante de COMPRA (baseado em TransactionReceipt.tsx) ────────────
async function comprovanteCompra() {
    const rows = [
        ['COMPRA', 'Compra no Crédito — FINALIZADA ✅', '', fmt(270.45)],
        ['ORIGEM', 'Nome: Chloe Dubois', '', ''],
        ['', 'Instituição: FintechBank', '', ''],
        ['', 'CPF: ***.653.661-**', '', ''],
        ['DESTINO', 'Nome: Amazon.com.br', '', ''],
        ['', 'Cartão Utilizado: **** **** **** 3344', '', ''],
        ['', 'Valor Total da Compra', '', fmt(270.45)],
        ['', 'Parcelas: 1x de R$ 270,45', '', ''],
        ['ID', 'ID da transação', '', 'amzn_pur_2026jul12_x7k9'],
        ['STATUS', 'Transação concluída', '', ''],
    ];
    await makePdf('comprovante_compra.pdf', rows, 'COMPROVANTE DE COMPRA', 'Compra no Crédito',
        'Comprovante da compra aprovada — o valor será consolidado na fatura aberta. Consulte a fatura para detalhes de parcelamento.');
}

// ── 5. Comprovante de PAGAMENTO (baseado em PaymentReceipt.tsx) ─────────────
async function comprovantePagamento() {
    const rows = [
        ['PAGTO', 'Pagamento de Fatura — CONCLUÍDO ✅', '', fmt(DATA.valorPago)],
        ['CARTÃO', 'FintechBank •••• 3344', '', ''],
        ['DATA', `Data e Hora: ${dateLong(DATA.paidAt)}`, '', ''],
        ['TIPO', 'Pagamento INTEGRAL — QUITADO', '', ''],
        ['STATUS', 'Limite de crédito reestabelecido e conta regularizada', '', ''],
        ['ID', 'ID da transação', '', 'pay_2026aug05_3f9c'],
    ];
    await makePdf('comprovante_pagamento.pdf', rows, 'COMPROVANTE DE PAGAMENTO', 'Pagamento de Fatura',
        'Comprovante de pagamento de fatura — multa e juros de mora foram estacionados no pagamento. Encargos acumulados herdados pela fatura aberta.');
}

(async () => {
    await fechadaEmAberto();
    await fechadaPaga();
    await abertaPaga();
    await comprovanteCompra();
    await comprovantePagamento();
    console.log('\n🎉 5 PDFs gerados em .freebuff/pdf-preview/');
})();
