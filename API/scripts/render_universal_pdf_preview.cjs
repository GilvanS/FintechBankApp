#!/usr/bin/env node
/**
 * render_universal_pdf_preview.cjs
 * Gera os PDFs da FATURA UNIVERSAL (4 páginas, Fintech Bank 598) usando o
 * invoicePdfService.js — mesmo serviço que a rota send-pdf do index.cjs.
 *
 * Uso:
 *   node scripts/render_universal_pdf_preview.cjs
 *
 * Saída:
 *   .freebuff/pdf-preview/fatura_universal_*.pdf  (3 arquivos: fechada ABERTO,
 *   fechada PAGA e aberta PAGA)
 */
const fs = require('fs');
const path = require('path');
const { generateUniversalInvoicePDF } = require('../services/invoicePdfService');
const { buildBoletoData } = require('../utils/boletoMath');

const OUT_DIR = path.join(__dirname, '..', '..', '.freebuff', 'pdf-preview');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Dados de referência (massa Chloe 015.653.661-74 — valores reais validados) ──
const BASE = {
    nome: 'CHLOE DUBOIS',
    cpf: '01565366174',
    cpfFormatado: '015.653.661-74',
    cartaoFinal: '3344',
    emissao: '2026-08-05T10:30:00.000Z',
    vencimento: '2026-07-15T00:00:00.000Z',
    previsaoFechamento: '2026-08-20T00:00:00.000Z',
    limiteTotal: 5000,
    limiteDisponivel: 3020.89,
    limiteSaque: 2000,
    diasAtraso: 20,
};

// Campos comuns do boleto (banco 598 Fintech Bank). A linha digitável é SEMPRE
// computada via buildBoletoData (fonte única, padrão Febraban novo: fator 5 dígitos,
// DV na posição 20, campo livre 24) — idêntica ao gerador Python e à API. Nunca
// hardcoded: o preview antigo travava a linha no layout velho (fator 00000).
// nossoNumero/conta/documento são DERIVADOS do CPF — MESMA regra da rota real
// send-pdf (index.cjs) e do invoice_payment_generator.py (fonte única), para o
// preview espelhar exatamente o que a API gera para a mesma fatura.
const BOLETO_BASE = {
    banco: '598', bancoDv: 9, bancoNome: '598 - Fintech Bank App',
    agencia: '0001', conta: '00000001', carteira: '09',
    nossoNumero: String(BASE.cpf).replace(/\D/g, '').slice(-10),
    documento: String(BASE.cpf).replace(/\D/g, ''),
    cedente: 'Fintech Bank App S.A.', cedenteCpf: '12.345.678/0001-90',
    sacado: BASE.nome, sacadoCpf: BASE.cpfFormatado,
};
function computeLinhaDigitavel(overrides) {
    return buildBoletoData({ ...BOLETO_BASE, ...overrides }).linhaDigitavel;
}

// Movimentações simuladas (compras do ciclo Jul/26 — somam 629,52)
const MOVS_ABERTA = [
    { data: '02/07', descricao: 'AMAZON BR (01/01) — VESTUÁRIO .SAO PAULO', valor: 197.08 },
    { data: '10/07', descricao: 'MERCADOLIVRE*AMARE (01/01) — MORADIA .OSASCO', valor: 74.45 },
    { data: '15/07', descricao: 'EBN *SONYPLAYST (01/01) — DIVERSOS .CURITIBA', valor: 55.03 },
    { data: '20/07', descricao: 'AMAZON MARKETPLACE (01/01) — VESTUÁRIO .SAO PAULO', valor: 76.08 },
    { data: '25/07', descricao: 'ATACADAO 637 SA (01/01) — ALIMENTAÇÃO .OSASCO', valor: 129.95 },
    { data: '30/07', descricao: 'CONECTCAR *Conectcar (01/01) — VEÍCULOS .ALPHAVILLE', valor: 50.00 },
    { data: '31/07', descricao: 'IOF DIARIO COMPRA (01/01) — IMPOSTOS', valor: 46.93 },
];

// Parcelas futuras (próximas faturas)
const PARCELAS_FUTURAS = [
    { data: '02/07', descricao: 'MERCADOLIVRE*AMARE (02/04)', valor: 197.08 },
    { data: '20/07', descricao: 'AMAZON BR (03/07)', valor: 52.82 },
    { data: '20/07', descricao: 'AMAZON MARKETPLACE (03/10)', valor: 76.08 },
    { data: '21/07', descricao: 'EBN *SONYPLAYST (03/03)', valor: 55.03 },
    { data: '02/08', descricao: 'EBN *SONYPLAYST (03/03)', valor: 17.40 },
    { data: '13/08', descricao: 'EBN *SONYPLAYST (03/03)', valor: 39.17 },
];

// ── 1. Fatura Fechada EM ABERTO (não paga) ─────────────────────────────────
function fechadaEmAberto() {
    return generateUniversalInvoicePDF({
        ...BASE,
        tipo: 'closed',
        periodo: 'Jun/26',
        isPaga: false,
        totalEstaFatura: 3870.86,
        resumo: {
            anterior: 0,
            pagamento: 0,
            saldoFinanciado: 0,
            lancamentos: 3870.86,
            total: 3870.86,
        },
        encargos: [
            { nome: 'Juros do rotativo', taxa: '15,39% a.m.', valor: 0 },
            { nome: 'Juros de mora', taxa: '1,00% a.m. (0,0333%/dia)', valor: 0 },
            { nome: 'Multa por atraso', taxa: '2,00%', valor: 0 },
            { nome: 'IOF de financiamento', taxa: '0,38% + 0,0082% a.d.', valor: 0 },
        ],
        movimentacoes: [
            { data: '15/06', descricao: 'SAQUE PARCELADO LOJA C&A (02/04)', valor: 38.66 },
            { data: '15/06', descricao: 'IOF DIARIO SAQUE (02/04)', valor: 0.10 },
            { data: '15/06', descricao: 'IOF ADICIONAL SAQUE (02/04)', valor: 0.15 },
            { data: '15/06', descricao: 'ENCARGOS SAQUE (02/04)', valor: 24.85 },
            { data: '21/06', descricao: 'TARIFA DE PAGAMENTO DE CONTAS', valor: 9.90 },
            { data: '17/07', descricao: 'ENCARGOS CONTRATUAIS DE ATRASO', valor: 8.86 },
            { data: '17/07', descricao: 'TARIFA SMS', valor: 4.99 },
            { data: '21/06', descricao: 'CONTA COMIGO', valor: 195.01 },
            { data: '30/06', descricao: 'COMPRA PARCELADA ELETRO 12X (01/12)', valor: 356.00 },
            { data: '10/06', descricao: 'SUPERMERCADO BOM DIA', valor: 223.14 },
            { data: '28/06', descricao: 'FARMACIA SAUDE TOTAL', valor: 87.32 },
            { data: '05/07', descricao: 'POSTO IPIRANGA 5000', valor: 150.00 },
        ],
        parcelasFuturas: PARCELAS_FUTURAS,
        proximaFatura: 437.58,
        demaisFaturas: 783.01,
        totalProximasFaturas: 1220.59,
        pagamentoMinimo: {
            valor: 387.09,
            financiado: 3870.86,
            encargos: 0,
            iof: 0,
            total: 387.09,
            jurosLabel: '15,39% a.m. — 453,46% a.a.',
            cetLabel: '15,73% a.m. — 491,21% a.a.',
        },
        parcelasFixas: {
            valor: 322.57,
            qtd: '12x',
            financiado: 3870.86,
            solicitado: 3870.86,
            iof: 23.95,
            total: 4094.81,
            jurosLabel: '5,99% a.m. — 102,95% a.a.',
            cetLabel: '6,32% a.m. — 110,71% a.a.',
        },
        pixCopiaECola: '00020126580014BR.GOV.BCB.PIX0136chloe.dubois@fintechbank.com.br52040000530398654063870.865802BR5917CHLOE DUBOIS6009SAO PAULO62070503***6304A1B2',
        boletoLinhaDigitavel: computeLinhaDigitavel({ vencimento: BASE.vencimento, valor: 3870.86 }),
        boleto: {
            ...BOLETO_BASE,
            vencimento: BASE.vencimento,
            emissao: BASE.emissao,
            valor: 3870.86,
            instrucoes: [
                'Cobrar multa de 2% após o vencimento.',
                'Juros de mora de 0,0333% ao dia após o vencimento.',
                'Em caso de dúvidas, consulte o aplicativo Fintech Bank.',
            ],
        },
        nota: '⚠️ Fatura EM ABERTO — 20 dias em atraso. Os encargos do atraso são herdados e consolidados na Fatura Aberta.',
    });
}

// ── 2. Fatura Fechada PAGA ─────────────────────────────────────────────────
function fechadaPaga() {
    return generateUniversalInvoicePDF({
        ...BASE,
        tipo: 'closed',
        periodo: 'Jun/26',
        isPaga: true,
        totalEstaFatura: 3870.86,
        resumo: {
            anterior: 0,
            pagamento: 3870.86,
            pagamentoData: '2026-08-05T10:30:00.000Z',
            saldoFinanciado: 0,
            lancamentos: 3870.86,
            total: 0,
        },
        encargos: [
            { nome: 'Juros do rotativo', taxa: '15,39% a.m.', valor: 0 },
            { nome: 'Juros de mora', taxa: '1,00% a.m. (0,0333%/dia)', valor: 0 },
            { nome: 'Multa por atraso', taxa: '2,00%', valor: 0 },
            { nome: 'IOF de financiamento', taxa: '0,38% + 0,0082% a.d.', valor: 0 },
        ],
        movimentacoes: [
            { data: '15/06', descricao: 'SAQUE PARCELADO LOJA C&A (02/04)', valor: 38.66 },
            { data: '15/06', descricao: 'IOF DIARIO SAQUE (02/04)', valor: 0.10 },
            { data: '15/06', descricao: 'IOF ADICIONAL SAQUE (02/04)', valor: 0.15 },
            { data: '15/06', descricao: 'ENCARGOS SAQUE (02/04)', valor: 24.85 },
            { data: '21/06', descricao: 'TARIFA DE PAGAMENTO DE CONTAS', valor: 9.90 },
            { data: '17/07', descricao: 'ENCARGOS CONTRATUAIS DE ATRASO', valor: 8.86 },
            { data: '17/07', descricao: 'TARIFA SMS', valor: 4.99 },
            { data: '21/06', descricao: 'CONTA COMIGO', valor: 195.01 },
        ],
        parcelasFuturas: PARCELAS_FUTURAS,
        proximaFatura: 437.58,
        demaisFaturas: 783.01,
        totalProximasFaturas: 1220.59,
        pagamentoMinimo: { valor: 387.09, financiado: 3870.86, encargos: 0, iof: 0, total: 387.09 },
        parcelasFixas: { valor: 322.57, qtd: '12x', financiado: 3870.86, solicitado: 3870.86, iof: 23.95, total: 4094.81 },
        pixCopiaECola: '00020126580014BR.GOV.BCB.PIX0136chloe.dubois@fintechbank.com.br52040000530398654063870.865802BR5917CHLOE DUBOIS6009SAO PAULO62070503***6304A1B2',
        boletoLinhaDigitavel: computeLinhaDigitavel({ vencimento: BASE.vencimento, valor: 3870.86 }),
        boleto: {
            ...BOLETO_BASE,
            vencimento: BASE.vencimento,
            emissao: BASE.emissao,
            valor: 3870.86,
            instrucoes: [
                'Boleto de fatura quitada — para conferência.',
                'Em caso de dúvidas, consulte o aplicativo Fintech Bank.',
            ],
        },
        nota: '✅ Fatura QUITADA em 05/08/2026. Encargos de atraso herdados e consolidados na Fatura Aberta.',
    });
}

// ── 3. Fatura Aberta (herança PAGA) ─────────────────────────────────────────
function abertaPaga() {
    return generateUniversalInvoicePDF({
        ...BASE,
        tipo: 'open',
        periodo: 'Jul/26',
        isPaga: false,
        totalEstaFatura: 1979.11,
        resumo: {
            anterior: 3870.86,
            pagamento: 3870.86,
            pagamentoData: '2026-08-05T10:30:00.000Z',
            saldoFinanciado: 0,
            lancamentos: 629.52,
            total: 1979.11,
        },
        encargos: [
            { nome: 'Taxa de Multa por Atraso (Herdada)', taxa: '2,00%', valor: 232.26 },
            { nome: 'Juros de Mora (Herdado)', taxa: '0,0333%/dia', valor: 64.44 },
            { nome: 'Juros Remuneratórios (Herdado)', taxa: '0,513%/dia', valor: 992.88 },
            { nome: 'IOF Adicional Fixo (Herdado)', taxa: '0,38%', valor: 60.01 },
        ],
        movimentacoes: MOVS_ABERTA,
        parcelasFuturas: PARCELAS_FUTURAS,
        proximaFatura: 437.58,
        demaisFaturas: 783.01,
        totalProximasFaturas: 1220.59,
        pagamentoMinimo: {
            valor: 1412.54,
            financiado: 629.52,
            encargos: 1349.59,
            iof: 0,
            total: 1979.11,
            jurosLabel: '15,39% a.m. — 453,46% a.a.',
            cetLabel: '15,73% a.m. — 491,21% a.a.',
        },
        parcelasFixas: {
            valor: 164.93,
            qtd: '12x',
            financiado: 1979.11,
            solicitado: 1979.11,
            iof: 11.83,
            total: 2093.02,
            jurosLabel: '5,99% a.m. — 102,95% a.a.',
            cetLabel: '6,32% a.m. — 110,71% a.a.',
        },
        pixCopiaECola: '00020126580014BR.GOV.BCB.PIX0136chloe.dubois@fintechbank.com.br52040000530398654061979.115802BR5917CHLOE DUBOIS6009SAO PAULO62070503***6304C7D9',
        boletoLinhaDigitavel: computeLinhaDigitavel({ vencimento: '2026-08-15T00:00:00.000Z', valor: 1979.11 }),
        boleto: {
            ...BOLETO_BASE,
            vencimento: '2026-08-15T00:00:00.000Z',
            emissao: BASE.emissao,
            valor: 1979.11,
            cedente: 'Fintech Bank App S.A.',
            cedenteCpf: '12.345.678/0001-90',
            sacado: BASE.nome,
            sacadoCpf: BASE.cpfFormatado,
            instrucoes: [
                'Cobrar multa de 2% após o vencimento.',
                'Juros de mora de 0,0333% ao dia após o vencimento.',
                'Este boleto liquida o total consolidado da fatura aberta (compras + herança + encargos herdados).',
            ],
        },
        nota: '🛍️ Fatura Aberta — Total consolidado no corte: R$ 1.979,11 (compras + herança + encargos herdados).',
    });
}

(async () => {
    const files = [
        ['fatura_universal_FECHADA_EM_ABERTO.pdf', await fechadaEmAberto()],
        ['fatura_universal_FECHADA_PAGA.pdf', await fechadaPaga()],
        ['fatura_universal_ABERTA_PAGA.pdf', await abertaPaga()],
    ];
    for (const [name, buf] of files) {
        const file = path.join(OUT_DIR, name);
        fs.writeFileSync(file, buf);
        console.log('✅', name, `(${buf.length} bytes)`);
    }
    console.log('\n🎉 3 PDFs universais gerados em .freebuff/pdf-preview/');
})();
