// Pagamento feito quando NÃO há fatura FECHADA com dívida — o cliente está pagando a
// fatura ABERTA (docs/REGRAS-NEGOCIO-FATURA.md §25). Regra única:
//  1. quita os encargos pendentes (billing_charges) — só se cobrir TODOS, com a mesma
//     tolerância de R$ 0,01 do pagamento total (invoiceController.pay);
//  2. o resto é ANTECIPAÇÃO da fatura que vai fechar: fica sem invoice_id até o
//     invoiceEngine vinculá-la à fatura recém-fechada.
// Função pura: o chamador grava appliedToCharges em transactions.applied_to_charges.
const round2 = (n) => Math.round(n * 100) / 100;

function planOpenCyclePayment({ payAmount, pendingChargesTotal }) {
    const pay = round2(Math.max(0, Number(payAmount) || 0));
    const charges = round2(Math.max(0, Number(pendingChargesTotal) || 0));
    const markChargesPaid = charges > 0 && pay >= charges - 0.01;
    const appliedToCharges = markChargesPaid ? Math.min(charges, pay) : 0;
    return { appliedToCharges, anticipation: round2(pay - appliedToCharges), markChargesPaid };
}

module.exports = { planOpenCyclePayment };
