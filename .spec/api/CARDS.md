# Spec: Cartão de Crédito

**Arquivo de implementação:** `API/index.cjs` (rotas `/cards/*`), `API/repositories/cardRepo.js`, `API/repositories/invoiceRepo.js`
**Status:** Implementado

## Endpoints

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/cards/invoice/pay` | user | Pagar fatura integral |
| POST | `/cards/invoice/parcel` | user | Parcelar fatura |
| POST | `/cards/invoice/anticipate` | user | Antecipar parcelas |

## Regras de Negócio

### Fatura atual vs fechada
- **Fatura atual (`currentInvoice`)** — lançamentos do ciclo aberto
- **Fatura fechada (`closedInvoice`)** — ciclo anterior fechado, aguarda pagamento
- Transações na fatura fechada são do tipo `INVOICE_INSTALLMENT` ou `INVOICE_PAYMENT`

### Pagamento de fatura
- Débita do saldo da conta corrente
- Cria transação `INVOICE_PAYMENT`
- Atualiza `closedInvoice` para 0 após pagamento completo

### Parcelamento
- Divide o valor da fatura em N parcelas
- Gera `installment_plans` no banco
- Cada parcela cria transação `INVOICE_INSTALLMENT`

### Antecipação de parcelas
- Antecipa parcelas futuras com desconto configurável
- Tipo de transação: `INVOICE_ANTICIPATION`

## Objeto CreditCard (resposta de `/users/me`)

```json
{
  "creditCard": {
    "number": "****-****-****-1234",
    "dueDate": "2026-07-10",
    "invoiceDueDate": "2026-07-10",
    "closedInvoiceDueDate": "2026-06-10",
    "currentInvoice": 450.00,
    "closedInvoice": 1200.00,
    "availableLimit": 3550.00,
    "totalLimit": 5000.00,
    "pointsBalance": 1250,
    "isBlocked": false,
    "transactions": [],
    "closedTransactions": []
  }
}
```

## Tipos de transação

| Tipo | Operação |
|------|---------|
| `INVOICE_PAYMENT` | Pagamento de fatura |
| `INVOICE_INSTALLMENT` | Parcela de fatura |
| `INVOICE_ANTICIPATION` | Antecipação de parcela |
| `SHOP_DEBIT` | Compra no Shop (débito no cartão) |

## Referência de spec UI

Para layout da tela de Faturas no mobile, ver `.spec/mobile/FATURAS.md`.
