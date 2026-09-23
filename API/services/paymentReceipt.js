/**
 * paymentReceipt.js — comprovante de pagamento de fatura (PDF → tópico Telegram da massa).
 *
 * FONTE ÚNICA do comprovante: usado no pagamento (invoiceController.sendPaymentReceipt)
 * e no reenvio pela UTI (anomalia PAGAMENTO_SEM_COMPROVANTE), para a 2ª via sair
 * idêntica à original.
 */
const telegramService = require('./telegramService');

function montarDadosComprovante(cpf, user, data) {
    const cardFinal = String((user && (user.card_number || user.cardNumber)) || '').replace(/\D/g, '').slice(-4);
    return {
        nome: (user && user.full_name) || '',
        cpf,
        cpfFormatado: telegramService.formatCpf(cpf),
        cartaoFinal: cardFinal || '—',
        valorPago: data.valorPago,
        tipo: data.tipo, // TOTAL | MINIMO | PARCIAL
        saldoRestante: data.saldoRestante,
        dataPagamento: data.dataPagamento || new Date().toISOString(),
        formaPagamento: 'Saldo em conta',
        vencimento: data.vencimento || null,
        autenticacao: data.autenticacao || `FB-${Date.now().toString(36).toUpperCase()}`,
        nota: data.nota || '',
    };
}

/**
 * Gera o PDF e envia ao tópico da massa (toggle 'payment_receipt' do painel decide).
 * `aguardar: true` espera a confirmação real do Telegram (res.sent) — a UTI precisa
 * saber se entregou; o fluxo de pagamento não espera (não pode travar o pagamento).
 */
async function enviarComprovante(cpf, user, data, { aguardar = false } = {}) {
    const { generatePaymentReceiptPDF } = require('./invoicePdfService');
    const buffer = await generatePaymentReceiptPDF(montarDadosComprovante(cpf, user, data));
    const envio = aguardar ? telegramService.sendDocumentAguardando : telegramService.sendDocument;
    return envio(cpf, buffer, `comprovante_${cpf}.pdf`, 'payment_receipt');
}

const tipoPelaDescricao = (descricao) => {
    if (/m[ií]nimo/i.test(descricao || '')) return 'MINIMO';
    if (/parcial/i.test(descricao || '')) return 'PARCIAL';
    return 'TOTAL';
};

/**
 * 2ª via de um INVOICE_PAYMENT já gravado (UTI). Devolve o resultado do envio
 * ({ sent, reason?, error? }) — só conta como curado se sent === true.
 */
async function reenviarComprovanteDePagamento({ db, esc, cpf, tx }) {
    const [user] = await db.executeQuery(`SELECT * FROM ${db.fq('users')} WHERE cpf = ${esc(cpf)}`);
    return enviarComprovante(cpf, user, {
        valorPago: Math.abs(parseFloat(tx.amount || 0)),
        tipo: tipoPelaDescricao(tx.description),
        dataPagamento: new Date(tx.date).toISOString(),
        autenticacao: `FB-${String(tx.id).replace(/-/g, '').slice(0, 10).toUpperCase()}`,
        nota: '2ª via — comprovante reenviado pela UTI de Recuperação (o envio original não foi entregue).',
    }, { aguardar: true });
}

module.exports = { montarDadosComprovante, enviarComprovante, reenviarComprovanteDePagamento, tipoPelaDescricao };
