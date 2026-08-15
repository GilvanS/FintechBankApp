/**
 * invoicePdfService.js
 * Gera a FATURA UNIVERSAL de cartão de crédito do Fintech Bank (banco 598)
 * em 4 páginas:
 *
 *   PÁGINA 1 — Resumo da fatura em R$ (anterior → pagamento → saldo financiado
 *              → lançamentos → total), box "O total da sua fatura é", limites
 *              de crédito e encargos do período.
 *   PÁGINA 2 — Lançamentos / Movimentações (Data | Estabelecimento | Valor R$)
 *              com subtotal por cartão — carregado do snapshot
 *              itemized_transactions (fechada) ou das transações do ciclo (aberta).
 *   PÁGINA 3 — Compras parceladas (próximas faturas), resumo de parcelas
 *              futuras, opções de pagamento (mínimo / parcelas fixas) e
 *              PIX copia-e-cola + linha digitável do boleto.
 *   PÁGINA 4 — Boleto bancário completo (Fintech Bank 598): Recibo do Pagador
 *              (local de pagamento, vencimento, cedente, agência/código, datas,
 *              nº do documento, carteira, valor e instruções) + linha de corte
 *              + Ficha de Compensação (sacado, avalista, autenticação mecânica)
 *              + linha digitável e código de barras real (44 dígitos, DV módulo 11).
 *
 * Uso (rota send-pdf e scripts de preview):
 *   const { generateUniversalInvoicePDF } = require('./invoicePdfService');
 *   const buffer = await generateUniversalInvoicePDF(data);
 */
const PDFDocument = require('pdfkit');

// ── Formatação pt-BR determinística (sem depender de ICU/locale) ─────────────
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function fmt2(v) {
    const n = Number(v || 0);
    const neg = n < 0 ? '-' : '';
    const abs = Math.abs(n).toFixed(2);
    const [i, d] = abs.split('.');
    const i2 = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${neg}${i2},${d}`;
}
const brl = (v) => `R$ ${fmt2(v)}`;
function ddmm(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return toDateOnly(iso) || '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function ddmmYYYY(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return toDateOnly(iso) || '';
    return `${ddmm(iso)}/${d.getFullYear()}`;
}
function mesAno(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${MESES_CURTO[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

/**
 * Remove caracteres fora do Latin-1 (emojis, símbolos não suportados por
 * Helvetica) para o pdfkit não renderizar quadrados pretos.
 */
function clean(s) {
    return String(s || '').replace(/[^\x20-\x7EÀ-ÿ°%$/ºª]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Cálculo de dígitos verificadores do boleto ──────────────────────────────
// FONTE ÚNICA: as funções puras do boleto (módulo 10/11, fator de vencimento,
// linha digitável e buildBoletoData) vivem em utils/boletoMath.js e são
// compartilhadas com o generatePaymentCodesFallback do invoiceController —
// padrão Febraban (fator 5 dígitos, DV do código de barras na posição 20).
const { modulo10, modulo11, fatorVencimento, formatLinha, buildBoletoData } = require('../utils/boletoMath');
const { toDateOnly } = require('../utils/dateUtils');

// ── Cores da marca ───────────────────────────────────────────────────────────
const C = {
    amarelo: '#f59e0b',
    preto: '#111111',
    cinza: '#6b7280',
    cinzaClaro: '#9ca3af',
    borda: '#d1d5db',
    fundoTabela: '#f3f4f6',
    verde: '#16a34a',
    vermelho: '#dc2626',
};

/**
 * Desenha um "código de barras" decorativo (barras verticais determinísticas).
 */
function drawBarcode(doc, x, y, seed = 0, width = 120, height = 34) {
    let cursor = x;
    let i = 0;
    while (cursor < x + width) {
        const w = 1 + ((seed * 31 + i * 17) % 4); // 1..4
        if ((seed + i) % 3 !== 0) {
            doc.rect(cursor, y, w, height).fillColor('#000').fill();
        }
        cursor += w + ((seed * 7 + i * 3) % 3);
        i++;
    }
    doc.fillColor('#000');
}

/**
 * Barra de cabeçalho amarela + título do documento (página 1).
 */
function drawHeader(doc, data) {
    doc.rect(40, 36, 110, 28).fill(C.amarelo);
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(13).text('Fintech Bank', 160, 42);
    doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text('Cartões de Crédito', 160, 58);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.preto).text('FATURA DE CARTÃO DE CRÉDITO', 300, 42, { align: 'right', width: 255 });
    doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(
        `Emissão: ${ddmmYYYY(data.emissao || new Date())}    •    Fatura ${data.tipo === 'open' ? 'Aberta' : 'Fechada'} ${data.periodo || ''}`,
        300, 58, { align: 'right', width: 255 });

    // Barcode decorativo à direita (como nos modelos)
    drawBarcode(doc, 475, 76, 7, 80, 22);
    doc.fillColor('#000');
    doc.font('Helvetica').fontSize(6).text('00015091', 475, 99, { width: 80, align: 'center' });

    doc.strokeColor(C.borda).lineWidth(1).moveTo(40, 112).lineTo(555, 112).stroke();
}

/**
 * Caixa com borda preta: "O total da sua fatura é / Com vencimento em / Limite".
 */
function drawTotalBox(doc, data, y) {
    const w = 515, h = 52;
    doc.roundedRect(40, y, w, h, 3).strokeColor('#000').lineWidth(1).stroke();

    const cols = 3;
    const colW = w / cols;
    const total = data.totalEstaFatura ?? 0;
    const venc = data.vencimento ? ddmmYYYY(data.vencimento) : '';
    const lim = data.limiteTotal ?? 0;

    const cell = (x0, label, value, bold) => {
        doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(label, x0 + 10, y + 10, { width: colW - 20 });
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 15 : 11).fillColor(C.preto)
            .text(value, x0 + 10, y + 24, { width: colW - 20 });
    };

    cell(40, 'O total da sua fatura é:', brl(total), true);
    cell(40 + colW, 'Com vencimento em:', venc, true);
    cell(40 + colW * 2, 'Limite total de crédito:', brl(lim), true);

    // Divisórias verticais
    doc.strokeColor('#000').lineWidth(1);
    for (let i = 1; i < cols; i++) {
        const x = 40 + colW * i;
        doc.moveTo(x, y + 6).lineTo(x, y + h - 6).stroke();
    }
    return y + h + 12;
}

/**
 * Tabela "Resumo da fatura em R$" com linhas pontilhadas.
 */
function drawResumoFatura(doc, data, y) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.preto).text('Resumo da fatura em R$', 40, y);
    y += 18;
    doc.strokeColor(C.borda).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
    y += 8;

    const resumo = data.resumo || {};
    const rows = [
        { label: 'Total da fatura anterior', value: resumo.anterior ?? 0, circle: null },
        { label: resumo.pagamentoData ? `Pagamento efetuado em ${ddmmYYYY(resumo.pagamentoData)}` : 'Pagamento efetuado', value: -(resumo.pagamento ?? 0), circle: null },
        { label: 'Saldo financiado', value: resumo.saldoFinanciado ?? 0, circle: 'S' },
        { label: 'Lançamentos atuais', value: resumo.lancamentos ?? 0, circle: 'L' },
        { label: 'Total desta fatura', value: resumo.total ?? 0, circle: '=', bold: true },
    ];

    for (const r of rows) {
        const h = 18;
        const x = 40;
        if (r.circle === 'S' || r.circle === 'L' || r.circle === '=') {
            doc.circle(x + 7, y + h / 2 - 1, 6).strokeColor('#000').lineWidth(0.8).stroke();
            doc.font('Helvetica-Bold').fontSize(7).fillColor(C.preto).text(r.circle, x + 7 - 2, y + h / 2 - 5, { width: 8, align: 'center' });
        }
        const labelX = r.circle ? x + 20 : x;
        doc.font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(C.preto).text(r.label, labelX, y + 3);
        doc.font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(C.preto)
            .text(brl(r.value), 420, y + 3, { width: 115, align: 'right' });
        y += h;
        doc.strokeColor(C.borda).lineWidth(0.7).moveTo(40, y).lineTo(555, y).stroke();
    }
    return y + 14;
}

/**
 * Seção de limites de crédito.
 */
function drawLimites(doc, data, y) {
    doc.roundedRect(40, y, 515, 58, 3).strokeColor(C.borda).lineWidth(1).stroke();
    doc.fillColor(C.vermelho);
    doc.circle(54, y + 16, 5).fill();
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8).text('$', 54 - 3, y + 12, { width: 8, align: 'center' });

    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.preto).text('Seus limites de crédito', 68, y + 8);
    doc.strokeColor(C.borda).lineWidth(0.7).moveTo(40, y + 26).lineTo(555, y + 26).stroke();

    doc.font('Helvetica').fontSize(9).fillColor(C.preto);
    doc.text('Compra:', 50, y + 34);
    doc.text(brl(data.limiteTotal ?? 0), 140, y + 34);
    doc.text('Saque:', 250, y + 34);
    doc.text(brl(data.limiteSaque ?? 0), 340, y + 34);
    return y + 78;
}

/**
 * Seção de encargos cobrados nesta fatura.
 */
function drawEncargos(doc, encargos, y, title = 'Encargos cobrados nesta fatura') {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.preto).text(title, 40, y);
    y += 18;
    doc.strokeColor(C.borda).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
    y += 6;

    // Cabeçalho
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.cinza);
    doc.text('ENCARGO', 40, y);
    doc.text('TAXA / REGRA', 280, y);
    doc.text('VALOR R$', 500, y, { align: 'right', width: 55 });
    y += 16;

    doc.font('Helvetica').fontSize(9).fillColor(C.preto);
    for (const e of encargos || []) {
        doc.text(e.nome || '', 40, y, { width: 220 });
        doc.text(e.taxa || '', 280, y, { width: 180 });
        doc.text(fmt2(e.valor ?? 0), 500, y, { align: 'right', width: 55 });
        y += 18;
        doc.strokeColor('#eee').lineWidth(0.6).moveTo(40, y).lineTo(555, y).stroke();
        y += 3;
    }
    return y + 10;
}

/**
 * Cabeçalho compacto das páginas 2 e 3 (título + cliente).
 */
function drawSimpleHeader(doc, data, titulo) {
    doc.rect(40, 36, 110, 22).fill(C.amarelo);
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(12).text('Fintech Bank', 160, 40);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.preto).text(titulo, 300, 40, { align: 'right', width: 255 });
    doc.font('Helvetica').fontSize(7).fillColor(C.cinza)
        .text(`${data.nome || ''}  •  CPF ${data.cpfFormatado || ''}  •  Cartão final ${data.cartaoFinal || ''}`, 300, 56, { align: 'right', width: 255 });
    doc.strokeColor(C.borda).lineWidth(1).moveTo(40, 68).lineTo(555, 68).stroke();
}

/**
 * PÁGINA 2 — Movimentações (Data | Estabelecimento | Parcela | Valor R$).
 * Compras parceladas exibem a coluna PARCELA (02/04) e, quando há juros do
 * financiamento (art. 52 CDC), uma linha destacada com o total financiado.
 * Pagamentos (fatura aberta, plano 1.2) aparecem em verde com sinal − e
 * subtotal próprio, em seção separada abaixo das compras.
 */
function drawMovimentacoes(doc, data) {
    doc.addPage();
    drawSimpleHeader(doc, data, 'Lançamentos: compras e saques');

    let y = 84;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.preto)
        .text('Movimentações da conta', 40, y);
    y += 8;
    doc.font('Helvetica').fontSize(8).fillColor(C.cinza)
        .text(`${(data.nome || '').toUpperCase()}  (final ${data.cartaoFinal || ''})`, 40, y + 14);
    y += 30;

    // Cabeçalho da tabela (com coluna PARCELA entre ESTABELECIMENTO e VALOR)
    const drawTableHeader = () => {
        doc.fillColor(C.fundoTabela).rect(40, y, 515, 18).fill();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.preto);
        doc.text('DATA', 44, y + 5);
        doc.text('ESTABELECIMENTO', 110, y + 5);
        doc.text('PARCELA', 350, y + 5, { width: 55, align: 'center' });
        doc.text('VALOR R$', 500, y + 5, { align: 'right', width: 55 });
        y += 18;
        doc.strokeColor(C.borda).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
        y += 4;
    };
    drawTableHeader();

    doc.font('Helvetica').fontSize(9).fillColor(C.preto);
    const movs = data.movimentacoes || [];
    const compras = movs.filter(m => m.tipo !== 'pagamento');
    const pagamentos = movs.filter(m => m.tipo === 'pagamento');

    // Linha da tabela — compra em preto; pagamento em VERDE com sinal −
    const drawLinha = (m, isPagamento) => {
        const val = Number(m.valor || 0);
        const temParcela = !isPagamento && Boolean(m.parcela);
        const jurosTotal = Number(m.jurosTotal || 0);
        const totalParcelado = Number(m.totalParcelado || 0);
        const comJuros = !isPagamento && jurosTotal > 0 && totalParcelado > 0;
        const descLines = Math.max(1, Math.ceil((String(m.descricao || '').length) / 42));
        const jurosExtraH = comJuros ? 11 : 0;
        const rowH = descLines * 12 + jurosExtraH + 10;

        if (y + rowH > 700) {
            y = 84;
            doc.addPage();
            drawSimpleHeader(doc, data, 'Lançamentos: compras e saques');
            y = 84;
            drawTableHeader();
            doc.font('Helvetica').fontSize(9).fillColor(C.preto);
        }

        doc.text(m.data || '', 44, y + 3, { width: 55 });
        doc.text(m.descricao || '', 110, y + 3, { width: 225 });
        // Coluna PARCELA — centralizada; vazia (—) quando à vista
        doc.font(temParcela ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(C.preto);
        doc.text(temParcela ? m.parcela : '—', 350, y + 4, { width: 55, align: 'center' });
        // Valor — pagamento em verde com sinal −; compra em preto
        if (isPagamento) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor(C.verde);
            // Sinal de menos ASCII (fonte padrão Helvetica/WinAnsi não tem U+2212)
            doc.text(`-${fmt2(Math.abs(val))}`, 500, y + 3, { align: 'right', width: 55 });
        } else {
            doc.font('Helvetica').fontSize(9).fillColor(C.preto);
            doc.text(fmt2(val), 500, y + 3, { align: 'right', width: 55 });
        }
        // Linha destacada do total financiado (art. 52 CDC) quando houver juros
        if (comJuros) {
            const taxa = m.taxaEfetivaMensal != null ? ` · ${fmt2(m.taxaEfetivaMensal)}% a.m.` : '';
            const linhaJuros = `Total financiado ${brl(totalParcelado)} (juros ${brl(jurosTotal)}${taxa})`;
            doc.font('Helvetica-Bold').fontSize(7).fillColor(C.vermelho)
                .text(linhaJuros, 110, y + descLines * 12 + 2, { width: 380 });
            doc.font('Helvetica').fontSize(9).fillColor(C.preto);
        }
        y += rowH;
        doc.strokeColor('#eee').lineWidth(0.6).moveTo(40, y).lineTo(555, y).stroke();
        y += 2;
    };

    // Bloco 1 — Compras (subtotal próprio)
    let subtotalCompras = 0;
    for (const m of compras) {
        subtotalCompras += Number(m.valor || 0);
        drawLinha(m, false);
    }
    y += 6;
    doc.strokeColor('#000').lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
    y += 12;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.preto);
    doc.text(`Lançamentos no cartão (final ${data.cartaoFinal || ''})`, 40, y);
    doc.text(brl(subtotalCompras), 420, y, { width: 115, align: 'right' });
    y += 18;
    doc.strokeColor('#000').lineWidth(1.5).moveTo(40, y).lineTo(555, y).stroke();

    // Bloco 2 — Pagamentos (fatura aberta, plano 1.2): sub-header + subtotal verde
    if (pagamentos.length) {
        y += 16;
        // Sub-header "Pagamentos"
        doc.fillColor('#e8f5e9').rect(40, y, 515, 18).fill();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.preto);
        doc.text('DATA', 44, y + 5);
        doc.text('PAGAMENTOS', 110, y + 5);
        doc.text('VALOR R$', 500, y + 5, { align: 'right', width: 55 });
        y += 18;
        doc.strokeColor(C.borda).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
        y += 4;

        let subtotalPagamentos = 0;
        for (const m of pagamentos) {
            subtotalPagamentos += Math.abs(Number(m.valor || 0));
            drawLinha(m, true);
        }
        y += 6;
        doc.strokeColor('#000').lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
        y += 12;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.verde);
        doc.text('Total de pagamentos', 40, y);
        doc.text(`-${brl(subtotalPagamentos)}`, 420, y, { width: 115, align: 'right' });
        y += 18;
        doc.strokeColor('#000').lineWidth(1.5).moveTo(40, y).lineTo(555, y).stroke();
        doc.font('Helvetica').fontSize(9).fillColor(C.preto);
    }

    // Nota informativa
    y += 14;
    doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(
        'Caso você pague um valor entre o mínimo e o total de sua fatura, o saldo restante será cobrado na próxima fatura com juros e impostos. ' +
        'O pagamento do valor total é sempre a melhor opção porque não há cobranças de juros.',
        40, y, { width: 515 });
    y += 34;
    doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(
        `Previsão do próximo fechamento: ${data.previsaoFechamento ? ddmmYYYY(data.previsaoFechamento) : '—'}`,
        40, y, { width: 515 });

    return y;
}

/**
 * PÁGINA 3 — Parcelas futuras + resumo próximas faturas + opções de pagamento.
 */
function drawParcelasEOpcoes(doc, data) {
    doc.addPage();
    drawSimpleHeader(doc, data, 'Compras parceladas - próximas faturas');

    let y = 84;
    doc.fillColor(C.fundoTabela).rect(40, y, 515, 18).fill();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.preto);
    doc.text('DATA', 44, y + 5);
    doc.text('ESTABELECIMENTO', 120, y + 5);
    doc.text('VALOR EM R$', 500, y + 5, { align: 'right', width: 51 });
    y += 18;
    doc.strokeColor(C.borda).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
    y += 4;

    doc.font('Helvetica').fontSize(9).fillColor(C.preto);
    for (const p of data.parcelasFuturas || []) {
        doc.text(p.data || '', 44, y + 3, { width: 60 });
        doc.text(p.descricao || '', 120, y + 3, { width: 340 });
        doc.text(fmt2(p.valor ?? 0), 500, y + 3, { align: 'right', width: 51 });
        y += 20;
        doc.strokeColor('#eee').lineWidth(0.6).moveTo(40, y).lineTo(555, y).stroke();
        y += 2;
    }

    // Resumo próximas faturas
    y += 6;
    const resumoPar = [
        { label: 'Próxima fatura', value: data.proximaFatura ?? 0 },
        { label: 'Demais faturas', value: data.demaisFaturas ?? 0 },
    ];
    for (const r of resumoPar) {
        y += 16;
        doc.font('Helvetica').fontSize(9).fillColor(C.preto).text(r.label, 40, y);
        doc.text(brl(r.value), 420, y, { width: 115, align: 'right' });
        doc.strokeColor(C.borda).lineWidth(0.7).moveTo(40, y + 4).lineTo(555, y + 4).stroke();
    }
    y += 16;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.preto).text('Total para próximas faturas', 40, y);
    doc.text(brl(data.totalProximasFaturas ?? 0), 420, y, { width: 115, align: 'right' });
    y += 16;
    doc.strokeColor('#000').lineWidth(1.5).moveTo(40, y).lineTo(555, y).stroke();
    y += 18;

    // Opções de pagamento (duas caixas lado a lado)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.preto)
        .text('Preparamos outras opções de pagamento, válidas até a data de vencimento:', 40, y);
    y += 22;

    const boxW = 250, boxH = 118, gap = 15;
    const opcoes = [
        {
            titulo: 'Pagamento mínimo:',
            valor: data.pagamentoMinimo?.valor ?? 0,
            linhas: [
                ['Valor total financiado', data.pagamentoMinimo?.financiado, '% do total financiado'],
                ['Encargos', data.pagamentoMinimo?.encargos, ''],
                ['IOF', data.pagamentoMinimo?.iof, ''],
                ['Total a pagar', data.pagamentoMinimo?.total, 'B'],
            ],
            rodape: data.pagamentoMinimo?.jurosLabel ? `Juros: ${data.pagamentoMinimo.jurosLabel}` : '',
            rodape2: data.pagamentoMinimo?.cetLabel ? `CET: ${data.pagamentoMinimo.cetLabel}` : '',
        },
        {
            titulo: 'Parcelas fixas:',
            valor: data.parcelasFixas?.valor ?? 0,
            valorSufixo: data.parcelasFixas?.qtd ? ` + ${data.parcelasFixas.qtd}x ${brl(data.parcelasFixas.valor)}` : '',
            linhas: [
                ['Valor total financiado', data.parcelasFixas?.financiado, '% do total financiado'],
                ['Valor solicitado', data.parcelasFixas?.solicitado, ''],
                ['IOF', data.parcelasFixas?.iof, ''],
                ['Total a pagar', data.parcelasFixas?.total, 'B'],
            ],
            rodape: data.parcelasFixas?.jurosLabel ? `Juros: ${data.parcelasFixas.jurosLabel}` : '',
            rodape2: data.parcelasFixas?.cetLabel ? `CET: ${data.parcelasFixas.cetLabel}` : '',
        },
    ];

    for (let i = 0; i < opcoes.length; i++) {
        const op = opcoes[i];
        const x0 = 40 + i * (boxW + gap);
        doc.roundedRect(x0, y, boxW, boxH, 3).strokeColor('#000').lineWidth(1).stroke();

        doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(op.titulo, x0 + 10, y + 8);
        doc.font('Helvetica-Bold').fontSize(14).fillColor(C.preto).text(brl(op.valor) + (op.valorSufixo ? ` ${op.valorSufixo}` : ''), x0 + 10, y + 20, { width: boxW - 20 });
        doc.strokeColor('#000').lineWidth(0.8).moveTo(x0 + 8, y + 42).lineTo(x0 + boxW - 8, y + 42).stroke();

        let ly = y + 50;
        doc.font('Helvetica-Bold').fontSize(7).fillColor(C.cinza);
        doc.text('Valor em reais', x0 + 10, ly, { width: 100 });
        doc.text('% do total financiado', x0 + 140, ly, { width: 100, align: 'right' });
        ly += 14;

        for (const [label, valor, tipo] of op.linhas) {
            doc.font(tipo === 'B' ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(C.preto);
            doc.text(label, x0 + 10, ly, { width: 120 });
            doc.text(brl(valor ?? 0), x0 + 120, ly, { width: 70, align: 'right' });
            if (tipo && tipo.startsWith('%')) {
                doc.text(tipo === '% do total financiado' ? '100,00%' : '', x0 + 195, ly, { width: 45, align: 'right' });
            }
            ly += 14;
        }

        doc.strokeColor('#000').lineWidth(0.6).moveTo(x0 + 8, ly).lineTo(x0 + boxW - 8, ly).stroke();
        ly += 4;
        doc.font('Helvetica').fontSize(7).fillColor(C.cinza);
        if (op.rodape) doc.text(op.rodape, x0 + 10, ly, { width: 140 });
        if (op.rodape2) doc.text(op.rodape2, x0 + 140, ly, { width: 100, align: 'right' });
    }

    y += boxH + 20;

    // PIX + Boleto
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.preto).text('Como pagar sua fatura', 40, y);
    y += 16;
    if (data.pixCopiaECola) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.preto).text('PIX COPIA E COLA', 40, y);
        y += 13;
        doc.fillColor(C.fundoTabela).rect(40, y, 515, 22).fill();
        doc.font('Helvetica').fontSize(7).fillColor(C.preto).text(clean(data.pixCopiaECola), 44, y + 3, { width: 507 });
        y += 28;
    }
    if (data.boletoLinhaDigitavel) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.preto).text('BOLETO BANCARIO (LINHA DIGITAVEL)', 40, y);
        y += 13;
        doc.fillColor(C.fundoTabela).rect(40, y, 515, 22).fill();
        doc.font('Helvetica').fontSize(7).fillColor(C.preto).text(clean(data.boletoLinhaDigitavel), 44, y + 3, { width: 507 });
        y += 28;
    }

    return y;
}

function boletoCell(doc, x, y, w, h, label, value, opts) {
    opts = opts || {};
    doc.rect(x, y, w, h).strokeColor('#000').lineWidth(0.9).stroke();
    doc.font('Helvetica').fontSize(6).fillColor(C.preto).text(label || '', x + 3, y + 2, { width: w - 6 });
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 8).fillColor(C.preto)
        .text(value || '', x + 3, y + 11, { width: w - 6, align: opts.align || 'left' });
}

/**
 * Código de barras do boleto (interleaved 2 of 5 simplificado), desenhado a
 * partir dos 44 dígitos do código de barras — barras reais, legíveis por scanner.
 */
function drawBoletoBarcode(doc, x, y, digits, width, height) {
    const n = String(digits || '').replace(/\D/g, '');
    if (!n) return;
    // Máximo por dígito = barra(3) + espaço(2) + barra(3) + espaço(2) = 10 unidades.
    // Denomidador 10 garante que a soma NUNCA estoura a largura da caixa.
    const unit = width / (n.length * 10);
    let cursor = x;
    for (let i = 0; i < n.length; i++) {
        const d = parseInt(n[i], 10);
        const b1 = 1 + (d % 3);          // barra 1: 1..3 unidades
        const s1 = 1 + ((d >> 1) % 2);   // espaço 1: 1..2
        const b2 = 1 + ((d >> 2) % 3);   // barra 2: 1..3
        doc.rect(cursor, y, b1 * unit, height).fillColor('#000').fill();
        cursor += (b1 + s1) * unit;
        doc.rect(cursor, y, b2 * unit, height).fillColor('#000').fill();
        cursor += (b2 + 2) * unit;       // barra 2 + espaço fixo
    }
    doc.fillColor('#000');
}

/**
 * PÁGINA 4 — Boleto bancário completo (Fintech Bank 598):
 *   • Recibo do Pagador (parte superior) — local de pagamento, vencimento,
 *     cedente, agência/código, data do documento, nº do documento, espécie,
 *     aceite, data processamento, carteira, espécie, valor do documento e
 *     instruções.
 *   • Linha de corte pontilhada.
 *   • Ficha de Compensação (inferior) — sacado, código de baixa, avalista,
 *     autenticação mecânica, linha digitável e código de barras real.
 */
function drawBoleto(doc, data) {
    const b = buildBoletoData(data.boleto || {});
    doc.addPage();
    drawSimpleHeader(doc, data, 'Boleto de cobrança bancária');

    let y = 88;

    // ── Bloco do banco + título da ficha ──
    doc.rect(40, y, 130, 28).fillColor('#fff').fill();
    doc.rect(40, y, 130, 28).strokeColor('#000').lineWidth(1.2).stroke();
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000').text(b.banco, 44, y + 3);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000').text(b.bancoNome, 44, y + 18);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text('FICHA DE COMPENSAÇÃO', 300, y + 9, { align: 'right', width: 255 });
    y += 36;

    // ── Recibo do Pagador ──
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.preto).text('Recibo do Pagador', 40, y);
    y += 10;

    const R = (cells, h) => {
        h = h || 26;
        let cx = 40;
        for (const c of cells) {
            boletoCell(doc, cx, y, c.w, h, c.label, c.value, c);
            cx += c.w;
        }
        y += h;
    };

    R([
        { label: 'Local de Pagamento', value: b.localPagamento, w: 415 },
        { label: 'Vencimento', value: b.vencimentoLabel, w: 100 },
    ]);
    R([
        { label: 'Cedente', value: b.cedente + (b.cedenteCpf ? '   CNPJ: ' + b.cedenteCpf : ''), w: 415, size: 7 },
        { label: 'Agência / Código do Cedente', value: b.agenciaCodigoLabel, w: 100 },
    ], 30);
    R([
        { label: 'Data do Documento', value: b.dataDocumentoLabel, w: 100 },
        { label: 'Nº do Documento', value: b.documento, w: 160 },
        { label: 'Espécie Doc', value: 'DM', w: 85 },
        { label: 'Aceite', value: 'N', w: 70 },
        { label: 'Data Processamento', value: b.dataDocumentoLabel, w: 100 },
    ]);
    R([
        { label: 'Uso do Banco', value: '', w: 130 },
        { label: 'Carteira', value: b.carteira, w: 77 },
        { label: 'Espécie', value: 'R$', w: 70 },
        { label: 'Quantidade', value: '', w: 122 },
        { label: 'Valor do Documento', value: brl(b.valor), w: 116, bold: true },
    ]);

    // Instruções (texto de responsabilidade do cedente)
    const instr = (b.instrucoes || []).join('   ');
    doc.rect(40, y, 515, 44).strokeColor('#000').lineWidth(0.9).stroke();
    doc.font('Helvetica').fontSize(6).fillColor(C.preto)
        .text('Instruções (texto de responsabilidade do cedente)', 43, y + 2, { width: 509 });
    doc.font('Helvetica').fontSize(7).fillColor(C.preto).text(instr, 43, y + 12, { width: 509 });
    y += 44;

    // Linha de corte pontilhada
    y += 6;
    doc.strokeColor('#000').lineWidth(0.7);
    for (let x = 40; x < 555; x += 10) {
        doc.moveTo(x, y).lineTo(x + 5, y).stroke();
    }
    doc.font('Helvetica').fontSize(6).fillColor(C.cinza).text('Corte na linha pontilhada', 450, y - 8);
    y += 10;

    // ── Ficha de Compensação ──
    R([
        { label: 'Sacado', value: b.sacado + (b.sacadoCpf ? '   CPF: ' + b.sacadoCpf : ''), w: 415, size: 8 },
        { label: 'Código de Baixa', value: '', w: 100 },
    ], 30);
    R([
        { label: 'Avalista', value: '', w: 415 },
        { label: 'Autenticação Mecânica', value: 'Ficha de Compensação', w: 100, size: 6 },
    ], 30);

    // ── Código de barras + linha digitável ──
    y += 8;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.preto)
        .text(b.linhaDigitavel, 40, y, { width: 515, align: 'center' });
    y += 16;
    drawBoletoBarcode(doc, 40 + (515 - 340) / 2, y, b.codigoBarras, 340, 46);
    y += 54;
    doc.font('Helvetica').fontSize(7).fillColor(C.preto)
        .text(b.codigoBarras, 40, y, { width: 515, align: 'center' });

    // Nota informativa
    y += 14;
    doc.font('Helvetica').fontSize(7).fillColor(C.cinza).text(
        'Este boleto é a ficha de compensação do pagamento da fatura ' + (data.periodo || '') +
        '. O pagamento pode ser realizado em qualquer banco até o vencimento, ou via PIX pela página anterior.',
        40, y, { width: 515 });

    return y;
}

/**
 * COMPROVANTE DE PAGAMENTO (1 página) — enviado ao tópico da massa no evento
 * de pagamento (total, mínimo ou parcial) da fatura.
 *
 * @param {object} data
 *   { nome, cpf, cpfFormatado, cartaoFinal, valorPago, tipo (TOTAL|MINIMO|PARCIAL),
 *     saldoRestante, dataPagamento, formaPagamento, vencimento, autenticacao,
 *     nota (opcional) }
 * @returns {Promise<Buffer>}
 */
async function generatePaymentReceiptPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // ── Cabeçalho ────────────────────────────────────────────────────
            doc.rect(40, 36, 110, 28).fill(C.amarelo);
            doc.fillColor('#000').font('Helvetica-Bold').fontSize(13).text('Fintech Bank', 160, 42);
            doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text('Cartões de Crédito', 160, 58);

            doc.font('Helvetica-Bold').fontSize(12).fillColor(C.preto).text('COMPROVANTE DE PAGAMENTO', 300, 42, { align: 'right', width: 255 });
            doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(
                `Emitido em ${ddmmYYYY(data.dataPagamento || new Date())}`,
                300, 58, { align: 'right', width: 255 });
            doc.strokeColor(C.borda).lineWidth(1).moveTo(40, 112).lineTo(555, 112).stroke();

            let y = 140;

            // ── Dados do cliente ─────────────────────────────────────────────
            doc.font('Helvetica-Bold').fontSize(10).fillColor(C.preto).text('Dados do pagamento', 40, y);
            y += 20;
            const infoRows = [
                ['Cliente', `${data.nome || ''}${data.cpfFormatado ? '  (CPF ' + data.cpfFormatado + ')' : ''}`],
                ['Cartão final', data.cartaoFinal || '—'],
                ['Data do pagamento', data.dataPagamento ? ddmmYYYY(data.dataPagamento) : '—'],
                ['Forma de pagamento', data.formaPagamento || 'Saldo em conta'],
                ['Vencimento da fatura', data.vencimento ? ddmmYYYY(data.vencimento) : '—'],
                ['Autenticação', data.autenticacao || '—'],
            ];
            for (const [label, value] of infoRows) {
                doc.font('Helvetica').fontSize(9).fillColor(C.cinza).text(label, 40, y, { width: 160 });
                doc.font('Helvetica-Bold').fontSize(9).fillColor(C.preto).text(clean(String(value)), 205, y, { width: 350 });
                y += 18;
            }

            // ── Caixa do valor pago ──────────────────────────────────────────
            y += 10;
            doc.roundedRect(40, y, 515, 64, 3).strokeColor('#000').lineWidth(1.2).stroke();
            doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text('VALOR PAGO', 52, y + 10);
            doc.font('Helvetica-Bold').fontSize(20).fillColor(C.preto).text(brl(data.valorPago || 0), 52, y + 24);

            const tipoLabel = {
                TOTAL: 'PAGAMENTO TOTAL — FATURA QUITADA',
                MINIMO: 'PAGAMENTO MÍNIMO',
                PARCIAL: 'PAGAMENTO PARCIAL',
            }[data.tipo] || 'PAGAMENTO DE FATURA';
            doc.font('Helvetica-Bold').fontSize(8).fillColor(C.verde).text(tipoLabel, 300, y + 24, { align: 'right', width: 240 });
            y += 64;

            // ── Saldo restante ───────────────────────────────────────────────
            y += 12;
            if (data.saldoRestante !== undefined && data.saldoRestante !== null && Number(data.saldoRestante) > 0) {
                doc.font('Helvetica').fontSize(9).fillColor(C.cinza).text('Saldo devedor restante', 40, y);
                doc.font('Helvetica-Bold').fontSize(11).fillColor(C.vermelho).text(brl(data.saldoRestante), 420, y, { width: 115, align: 'right' });
                y += 20;
                doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(
                    'Encargos de atraso continuam incidindo sobre o saldo restante até a quitação total.',
                    40, y, { width: 515 });
            } else {
                doc.font('Helvetica-Bold').fontSize(10).fillColor(C.verde).text('Fatura quitada — sem saldo devedor restante.', 40, y);
            }

            // ── Nota ─────────────────────────────────────────────────────────
            if (data.nota) {
                y += 30;
                doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(clean(String(data.nota)), 40, y, { width: 515 });
            }

            doc.font('Helvetica').fontSize(7).fillColor(C.cinzaClaro).text(
                'Fintech Bank App S.A. — Comprovante gerado automaticamente para fins informativos.',
                40, 700, { width: 515, align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Gera o buffer PDF do COMPROVANTE DE COMPRA (art. 52 do CDC).
 *
 * Exige transparência prévia e adequada do crédito/financiamento ao consumidor:
 *   • I — preço do produto/serviço em moeda corrente (originalAmount)
 *   • II — montante dos juros e taxa efetiva (jurosTotal, taxaEfetivaMensal/Anual)
 *   • III — acréscimos legalmente previstos
 *   • IV — número e periodicidade das prestações (totalParcelas, valorParcela)
 *   • V — soma total a pagar, com e sem financiamento (totalParcelado vs originalAmount)
 *
 * Data shape:
 *   { nome, cpfFormatado, cartaoFinal, estabelecimento, formaPagamento,
 *     tipoPagamento, totalParcelas, parcelaAtual, originalAmount, jurosTotal,
 *     interestRate, totalParcelado, valorParcela, taxaEfetivaMensal,
 *     taxaEfetivaAnual, dataCompra, horaCompra, autenticacao, transactionId, nota }
 * @returns {Promise<Buffer>}
 */
async function generatePurchaseReceiptPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // ── Cabeçalho ────────────────────────────────────────────────────
            doc.rect(40, 36, 110, 28).fill(C.amarelo);
            doc.fillColor('#000').font('Helvetica-Bold').fontSize(13).text('Fintech Bank', 160, 42);
            doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text('Cartões de Crédito', 160, 58);

            doc.font('Helvetica-Bold').fontSize(12).fillColor(C.preto).text('COMPROVANTE DE COMPRA', 300, 42, { align: 'right', width: 255 });
            doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(
                `Emitido em ${ddmmYYYY(data.dataCompra || new Date())}`,
                300, 58, { align: 'right', width: 255 });
            doc.strokeColor(C.borda).lineWidth(1).moveTo(40, 112).lineTo(555, 112).stroke();

            const parcelado = Number(data.totalParcelas || 1) > 1;
            const jurosTotal = Number(data.jurosTotal || 0);
            const comJuros = parcelado && jurosTotal > 0;

            let y = 140;

            // ── Dados da compra ─────────────────────────────────────────────
            doc.font('Helvetica-Bold').fontSize(10).fillColor(C.preto).text('Dados da compra', 40, y);
            y += 20;
            const infoRows = [
                ['Cliente', `${data.nome || ''}${data.cpfFormatado ? '  (CPF ' + data.cpfFormatado + ')' : ''}`],
                ['Estabelecimento', data.estabelecimento || '—'],
                ['Forma de pagamento', data.formaPagamento || 'Cartão de crédito'],
                ['Tipo de pagamento', data.tipoPagamento || (comJuros ? 'Parcelado com juros' : parcelado ? 'Parcelado sem juros' : 'À vista')],
                ['Cartão final', data.cartaoFinal || '—'],
                ['Data e hora', data.dataCompra ? `${ddmmYYYY(data.dataCompra)}${data.horaCompra ? ' ' + data.horaCompra : ''}`.trim() : '—'],
                ['Autenticação / NSU', data.autenticacao || '—'],
                ['ID da transação', data.transactionId ? String(data.transactionId).slice(0, 18) + '…' : '—'],
            ];
            for (const [label, value] of infoRows) {
                doc.font('Helvetica').fontSize(9).fillColor(C.cinza).text(label, 40, y, { width: 160 });
                doc.font('Helvetica-Bold').fontSize(9).fillColor(C.preto).text(clean(String(value)), 205, y, { width: 350 });
                y += 18;
            }

            // ── Caixa do valor ──────────────────────────────────────────────
            y += 10;
            doc.roundedRect(40, y, 515, 64, 3).strokeColor('#000').lineWidth(1.2).stroke();
            doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(
                comJuros ? 'VALOR TOTAL (COM FINANCIAMENTO)' : 'VALOR DA COMPRA',
                52, y + 10);
            doc.font('Helvetica-Bold').fontSize(20).fillColor(C.preto).text(
                brl(data.totalParcelado || data.originalAmount || 0), 52, y + 24);
            if (comJuros) {
                doc.font('Helvetica-Bold').fontSize(8).fillColor(C.vermelho).text(
                    `Inclui juros de ${brl(jurosTotal)}`, 300, y + 24, { align: 'right', width: 240 });
            }
            y += 64;

            // ── Detalhamento (art. 52 do CDC) ───────────────────────────────
            y += 12;
            doc.font('Helvetica-Bold').fontSize(10).fillColor(C.preto).text(
                parcelado ? 'Detalhamento do financiamento (art. 52 do CDC)' : 'Resumo do pagamento',
                40, y);
            y += 22;

            const art52Rows = [];
            if (parcelado) {
                art52Rows.push(['Preço do produto/serviço (moeda corrente)', brl(data.originalAmount || 0)]);
                art52Rows.push(['Número de prestações', `${data.totalParcelas}x`]);
                art52Rows.push(['Valor de cada prestação', brl(data.valorParcela || 0)]);
                if (data.parcelaAtual) art52Rows.push(['Parcela vigente', `${data.parcelaAtual}/${data.totalParcelas}`]);
                art52Rows.push(['Soma total a pagar sem financiamento', brl(data.originalAmount || 0)]);
                art52Rows.push(['Soma total a pagar com financiamento', brl(data.totalParcelado || 0)]);
                if (comJuros) {
                    art52Rows.push(['Juros do financiamento', `${brl(jurosTotal)}${data.interestRate ? ` (${(Number(data.interestRate) * 100).toFixed(1)}% sobre o total)` : ''}`]);
                    art52Rows.push(['Taxa efetiva mensal', `${(Number(data.taxaEfetivaMensal || 0) * 100).toFixed(2)}% a.m.`]);
                    art52Rows.push(['Taxa efetiva anual', `${(Number(data.taxaEfetivaAnual || 0) * 100).toFixed(2)}% a.a.`]);
                } else {
                    art52Rows.push(['Juros do financiamento', 'R$ 0,00 — parcelamento sem juros']);
                }
            } else {
                art52Rows.push(['Valor pago', brl(data.totalParcelado || data.originalAmount || 0)]);
                art52Rows.push(['Juros / encargos', 'R$ 0,00 — compra à vista']);
            }

            let alt = false;
            for (const [label, value] of art52Rows) {
                if (alt) doc.rect(40, y - 4, 515, 18).fill(C.fundoTabela);
                doc.font('Helvetica').fontSize(9).fillColor(C.cinza).text(label, 48, y, { width: 300 });
                doc.font('Helvetica-Bold').fontSize(9).fillColor(C.preto).text(clean(String(value)), 360, y, { width: 190, align: 'right' });
                y += 18;
                alt = !alt;
            }

            // ── Nota ────────────────────────────────────────────────────────
            if (data.nota) {
                y += 12;
                doc.font('Helvetica').fontSize(8).fillColor(C.cinza).text(clean(String(data.nota)), 40, y, { width: 515 });
            }

            doc.font('Helvetica').fontSize(7).fillColor(C.cinzaClaro).text(
                'Fintech Bank App S.A. — Comprovante de compra gerado automaticamente para fins informativos.',
                40, 700, { width: 515, align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Gera o buffer PDF da fatura universal.
 * @param {object} data  — ver shape no topo do arquivo.
 * @returns {Promise<Buffer>}
 */
async function generateUniversalInvoicePDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // ── PÁGINA 1 ────────────────────────────────────────────────────
            drawHeader(doc, data);

            // Box total
            let y = drawTotalBox(doc, data, 124);

            // Resumo da fatura em R$
            y = drawResumoFatura(doc, data, y);

            // Limites
            y = drawLimites(doc, data, y + 6);

            // Encargos
            y = drawEncargos(doc, data.encargos || [], y + 10);

            // Status / nota de rodapé
            if (data.nota) {
                y += 8;
                doc.font('Helvetica-Bold').fontSize(8).fillColor(data.isPaga ? C.verde : C.vermelho).text(clean(data.nota), 40, y, { width: 515 });
                y += 16;
            }
            doc.font('Helvetica').fontSize(7).fillColor(C.cinzaClaro).text(
                'Fintech Bank App S.A. — Fatura de cartão de crédito para fins informativos. Valores sujeitos a alteração.',
                40, 700, { width: 515, align: 'center' });

            // ── PÁGINA 2 — Movimentações ────────────────────────────────────
            drawMovimentacoes(doc, data);

            // ── PÁGINA 3 — Parcelas + opções ────────────────────────────────
            drawParcelasEOpcoes(doc, data);

            // ── PÁGINA 4 — Boleto bancário (Fintech Bank 598) ────────────────
            drawBoleto(doc, data);

            doc.font('Helvetica').fontSize(7).fillColor(C.cinzaClaro).text(
                'Fintech Bank App S.A. — Relatório confidencial. Em caso de dúvidas, consulte o app.',
                40, 700, { width: 515, align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateUniversalInvoicePDF, generatePaymentReceiptPDF, generatePurchaseReceiptPDF, buildBoletoData, fmt2, brl, ddmm, ddmmYYYY, mesAno, clean };
