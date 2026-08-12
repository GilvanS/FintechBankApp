# Regras de Negócio — Fatura e Pagamento

## Visão Geral

Este documento descreve as regras de negócio do sistema de faturas de cartão de crédito do FintechBank App. Serve como fonte única de verdade para agentes de IA e desenvolvedores.

---

## 1. Ciclo da Fatura

### 1.1 Datas
| Evento | Dia | Descrição |
|--------|:---:|-----------|
| **Fechamento** (close_day) | 20 | Fatura atual é FECHADA. Novas compras vão para o próximo ciclo. |
| **Vencimento** (due_day) | 10 | Data limite para pagamento sem encargos. |
| **Grace Period** | +3 dias | 3 dias úteis após o vencimento antes de considerar inadimplência. |
| **Referência** (invoiceRef) | `YYYY-MM` | Ex: `2026-08` para fatura com fechamento em julho e vencimento em agosto. |

### 1.2 Estados da Fatura
| Estado | Descrição |
|--------|-----------|
| `ABERTA` | Ciclo atual. Compras sendo acumuladas. |
| `FECHADA` | Ciclo encerrado. Fatura disponível para pagamento. |
| `FECHADA + data_pagamento` | Fatura quitada. |
| `FECHADA + dias_atraso > 0` | Fatura vencida (inadimplente). |

---

## 2. Cálculo do Saldo Devedor

### 2.1 Regra Fundamental

> **O saldo devedor de uma fatura fechada é calculado sobre o PRINCIPAL (valor_total), NUNCA sobre o GROSS (computeInvoiceGross).**

```
closedInvoice = Σ (valor_total - valor_pago)  ← PRINCIPAL residual
_closedInvoiceValorTotal = Σ valor_total      ← PRINCIPAL total (para display)
_closedInvoiceValorPago = Σ valor_pago        ← Total pago (para display)
```

**O que NÃO fazer:**
- ❌ NUNCA usar `computeInvoiceGross()` como `_closedInvoiceValorTotal`
- ❌ NUNCA incluir encargos congelados no valor exibido da fatura fechada

### 2.2 Comparação: computeInvoiceGross vs computeInvoiceOwed

O sistema tem **duas funções** para calcular o valor de uma fatura. Cada uma serve a propósitos diferentes. Usar a função errada no lugar certo é a **causa raiz** dos bugs de double-counting e dupla cobrança.

#### Código Fonte (utils/invoiceMath.js)

```javascript
// ─── Campos que compõem o GROSS ─────────────────────────────────
const INVOICE_GROSS_FIELDS = [
    'valor_total',        // ← PRINCIPAL (compras do ciclo)
    'saldo_anterior',     // ← Herança de encargos de fatura anterior
    'valor_iof',          // ← IOF congelado
    'valor_multa',        // ← Multa congelada
    'valor_juros_remuneratorios',  // ← Juros remuneratórios congelados
    'valor_juros_mora',   // ← Juros de mora congelados
];

/** GROSS = valor_total + saldo_anterior + todos os encargos congelados */
function computeInvoiceGross(invoice) {
    if (!invoice) return 0;
    return INVOICE_GROSS_FIELDS.reduce((sum, field) => sum + parseFloat(invoice[field] || 0), 0);
}

/** OWED = residual = valor_total - valor_pago (NUNCA negativo) */
function computeInvoiceOwed(invoice) {
    if (!invoice) return 0;
    const target = round2(parseFloat(invoice.valor_total || 0));
    return Math.max(0, round2(target - parseFloat(invoice.valor_pago || 0)));
}
```

#### Fórmulas

| Função | Fórmula | Inclui encargos? | Exemplo (R$ 3.870,86 principal + R$ 414,08 encargos) |
|:-------|:--------|:----------------:|:-----------------------------------------------------:|
| `computeInvoiceGross(inv)` | `valor_total + saldo_anterior + valor_iof + valor_multa + valor_juros_remuneratorios + valor_juros_mora` | ✅ **SIM** (soma TUDO) | R$ 4.284,94 |
| `computeInvoiceOwed(inv)` | `Math.max(0, valor_total - valor_pago)` | ❌ **NÃO** (só principal) | R$ 3.870,86 |

#### Onde Cada Função é Usada (Tabela Completa)

| Local no Código | Função Usada | Finalidade | Por que esta e não a outra? |
|:----------------|:------------:|:-----------|:---------------------------|
| **enrichUserCreditCardData** (linha 208): `invRows.filter(i => computeInvoiceGross(i) > 0)` | `GROSS` | **Filtrar** faturas que têm algum valor (qualquer valor > 0, seja principal ou encargo) | Usar `owed` aqui excluiria faturas pagas integralmente que ainda têm encargos congelados — o filtro é só para saber se a invoice tem dados relevantes, não para calcular saldo |
| **enrichUserCreditCardData** (linha 240): `latestFechada = invRows.find(i => computeInvoiceGross(i) > 0)` | `GROSS` | **Filtrar** a última fatura fechada (mesmo que quitada) para exibir badge PAGA | A última fechada quitada tem `valor_pago = valor_total`, então `owed = 0` e não seria encontrada com `computeInvoiceOwed`. O `gross > 0` garante que encontramos a invoice mesmo quitada |
| **getClosedInvoiceDebt** (linha 4375): `const gross = round2(computeInvoiceGross(row))` | `GROSS` | **Apenas para referência** (o campo `gross` é incluído no objeto retornado para debug/auditoria, mas o `owed` é o que realmente importa para o pagamento) | O `owed` (usado para cobrar) é calculado na linha seguinte como `residual = valor_total - valor_pago`. O `gross` é só informativo |
| **audit_negative_balance** (linha 6566): `if (pago > gross + 0.02)` | `GROSS` | **Auditar** se `valor_pago` excedeu o valor bruto congelado da fatura (overpayment detection) | A auditoria precisa do valor TOTAL que a fatura vale (incluindo encargos congelados) para detectar pagamento excessivo. Usar `owed` aqui subestimaria o teto |
| **audit_missing_payment_date** (linha 6581): `if (pago >= gross - 0.005 && !inv.data_pagamento)` | `GROSS` | **Auditar** faturas quitadas sem `data_pagamento` registrada | Mesma lógica: o teto para considerar quitada é o gross (todo o valor que a fatura vale), não o owed residual |
| **simulate-pay** (linha 6797): `totalOwed = Σ (computeInvoiceGross(inv) - valor_pago)` | `GROSS` (com subtração) | **Endpoint de simulação** — calcula o total devido incluindo encargos congelados para dry-run | Este endpoint é uma ferramenta de diagnóstico admin que mostra o valor TOTAL que resolveria a fatura, não o saldo devedor para pagamento real |
| **enrichUserCreditCardData** (linha ~220): `closedInvoice = Σ (valor_total - valor_pago)` | **OWN** (inline) | **Saldo devedor** exibido para o cliente e usado como base de cálculo de encargos atuais | **NUNCA usar gross aqui!** Senão os encargos congelados do seed seriam cobrados de novo como encargos atuais (dupla cobrança) |
| **runBillingValidation** (linha 4062): `residual = max(0, valor_total - valor_pago)` | **OWN** (inline) | **Base de cálculo** dos encargos diários no motor de validação | Mesma razão: encargos incidem sobre o saldo devedor real, não sobre o valor bruto congelado |
| **planDistribution** (invoiceMath.js linha 78): `target = valor_total` | **OWN** (principal) | **Target de quitação** de cada fatura na distribuição de pagamento | Usar gross como target faria o pagamento nunca quitar a fatura (pois `newValorPago(valor_total) < gross` → `isFullyPaid = false`) |
| **markFullyPaidInvoices** (index.cjs): `target = valor_total` | **OWN** (principal) | **Decidir** se uma fatura foi totalmente quitada | Mesma razão: a fatura é quitada quando o cliente paga o PRINCIPAL, não o principal + encargos |
| **computeInvoicePaidInfo** (invoiceMath.js linha 120): `target = valor_total` | **OWN** (principal) | **Sinalizar** se invoice está paga (para badge ✓ PAGA) | Encargos não são \"quitados\" — são herdados pela aberta. O pagamento do principal é o que define se a fatura está paga |

#### Regra de Ouro

> **`computeInvoiceOwed`** (ou inline `valor_total - valor_pago`) DEVE ser usado em TODO lugar que lida com **SALDO DEVEDOR, PAGAMENTO e ENCARGOS**.  \n> **`computeInvoiceGross`** DEVE ser usado APENAS para **FILTRAGEM** (saber se invoice tem dados) e **AUDITORIA** (detectar excesso de pagamento).

| Contexto | Função Correta | Se usar a errada... |
|:---------|:--------------:|:--------------------|
| Saldo devedor (`closedInvoice`) | `computeInvoiceOwed` | Cliente vê valor maior que o real |
| Cálculo de encargos (`runBillingValidation`) | `valor_total - valor_pago` (inline) | Encargos calculados sobre valor inflado → cliente paga MAIS |
| Total exibido da fechada (`closedInvoiceTotal`) | `computeInvoiceOwed` | Fatura paga mostra valor maior que o pago |
| Valor original preservado (`_closedInvoiceValorTotal`) | `valor_total` (inline) | Badge PAGA mostra valor com encargos inclusos |
| Target de quitação (`planDistribution`) | `valor_total` | Pagamento nunca quita a fatura |
| Badge PAGA (`computeInvoicePaidInfo`) | `valor_total` | Invoice nunca aparece como paga |
| Filtrar invoices com saldo > 0 | `computeInvoiceGross` | Invoice quitada com encargos congelados some do filtro |
| Auditoria de overpayment | `computeInvoiceGross` | Teto menor que o real → falso positivo de overpayment |

#### Exemplo Prático — O Perigo de Usar a Função Errada

```
Invoice tem:
  valor_total             = R$ 3.870,86
  multa (congelada)       = R$   77,42
  juros_mora (congelados) = R$   23,20
  juros_rem (congelados)  = R$  357,44
  iof (congelado)         = R$   20,42
  ─────────────────────────────────
  computeInvoiceGross     = R$ 4.349,34
  computeInvoiceOwed (sem pagamento) = R$ 3.870,86

Se usado como \"total da fatura\" no frontend:
  GROSS = R$ 4.349,34  ❌ ERRADO — cliente pensa que deve R$ 4.349,34
  OWED  = R$ 3.870,86  ✅ CORRETO — o principal da fatura

Se usado como base de encargos:
  GROSS → encargos sobre R$ 4.349,34 = R$ 537,66  ❌ DUPLA COBRANÇA
  OWED  → encargos sobre R$ 3.870,86 = R$ 478,48  ✅ CORRETO
```

#### Resumo Visual — Quem Chama o Quê

```
                    ┌───────────────────────────┐
                    │   computeInvoiceGross      │
                    │   (valor_total + encargos) │
                    └─────────┬──────┬───────────┘
                              │      │
              ┌───────────────┘      └───────────────┐
              ▼                                      ▼
     ┌─────────────────┐                  ┌─────────────────┐
     │ FILTRAGEM        │                  │ AUDITORIA        │
     │ enrichUserData   │                  │ audit_completo   │
     │ .filter(i=>g>0)  │                  │ overpayment      │
     │ latestFechada    │                  │ missing_payment  │
     └─────────────────┘                  └─────────────────┘

                    ┌───────────────────────────┐
                    │   computeInvoiceOwed       │
                    │   (valor_total - pago)     │
                    └─────────┬──────┬───────────┘
                              │      │
              ┌───────────────┘      └───────────────┐
              ▼                                      ▼
     ┌─────────────────┐                  ┌─────────────────┐
     │ PAGAMENTO        │                  │ ENCARGOS         │
     │ getClosedInvoice │                  │ runBillingVal    │
     │ planDistrib      │                  │ enrichUserData   │
     │ markFullyPaid    │                  │ (cálculo diário) │
     │ invoicePaidInfo  │                  │                  │
     └─────────────────┘                  └─────────────────┘
```

### 2.3 Funções Auxiliares Relacionadas

Além das duas principais, o módulo `utils/invoiceMath.js` exporta:

#### computeInvoicePaidInfo(invoice)

```javascript
function computeInvoicePaidInfo(invoice) {
    if (!invoice) return { isPaid: false, paidAt: null };
    const target = parseFloat(invoice.valor_total || 0);     // ← PRINCIPAL
    const pago = parseFloat(invoice.valor_pago || 0);
    const paidAt = invoice.data_pagamento || null;
    const isPaid = pago >= target - 0.005 && Boolean(paidAt); // tolerância centavos
    return { isPaid, paidAt };
}
```

**Usada por:** `enrichUserCreditCardData` para determinar se a fatura está quitada (badge verde ✓ PAGA).
**Regra:** O target é `valor_total` (principal), NUNCA `computeInvoiceGross`. Encargos não entram nesta conta.

#### planDistribution(invoiceRows, payAmount)

Distribui um valor de pagamento entre múltiplas faturas (da mais antiga para a mais recente).
**Target de quitação:** `valor_total` (principal), NUNCA gross.
**Usada por:** `settleClosedInvoices` para distribuir pagamentos parciais.

---

## 3. Pagamento

### 3.1 Tipos de Pagamento

| Tipo | Critério | Comportamento |
|------|----------|---------------|
| **Total** | `amount >= totalDue - 0.01` | Quita a fatura, zera saldo devedor, libera limite total pago |
| **Mínimo** | `amount >= 10% de totalDue` | Paga multa e juros de mora, mantém juros remuneratórios sobre residual |
| **Parcial** | `amount < 10% de totalDue` | Abate do principal, encargos continuam sobre residual |

### 3.2 Fluxo de Pagamento

```
Usuario clica \"Pagar fatura\"
  → Seleciona valor (total/minimo/parcial/customizado)
  → Modal de PIN abre
  → Confirma PIN
  → Frontend chama POST /api/cards/invoice/pay { cpf, pin, amount }
  → Backend:
      1. Verifica saldo (balance >= amount)
      2. Se total: quita invoice(s), estorna saldo
      3. Se parcial: debita balance, distribui entre invoices, calcula encargos residuais
      4. Registra transação INVOICE_PAYMENT na fatura aberta
      5. Atualiza valor_pago na tabela invoices
  → Frontend atualiza dados via getUserByCpf()
```

### 3.3 Regras de Amount no Frontend

> **O `amount` DEVE ser passado como 3º parâmetro em TODAS as chamadas para `payCreditCardInvoice(cpf, pin, amount)`.**

❌ **ERRADO:** `payCreditCardInvoice(cpf, pin)` — backend assume totalDue, quebra pagamento parcial.
✅ **CORRETO:** `payCreditCardInvoice(cpf, pin, amountSelecionado)`

### 3.4 Tratamento de Erro

- Se saldo insuficiente: mostrar toast com mensagem clara
- Se token expirado: modal de re-login
- Qualquer erro deve ser VISÍVEL ao usuário (não apenas `console.error`)

---

## 4. Encargos

### 4.1 Regra de Incidência

> **Encargos são calculados sobre o SALDO RESIDUAL (valor_total - valor_pago), NUNCA sobre o valor_total bruto.**

| Encargo | Fórmula | Base |
|---------|---------|:----:|
| **Multa** (2%) | `residual × 0,02` | Residual |
| **Juros de Mora** (0,0333%/dia) | `residual × 0,000333 × diasAtraso` | Residual |
| **Juros Remuneratórios** (0,513%/dia) | `residual × 0,00513 × diasAtraso` | Residual |
| **IOF** (0,38% fixo + 0,0082%/dia) | `residual × (0,0038 + 0,000082 × diasAtraso)` | Residual |

### 4.2 Herança de Encargos

> **Encargos da fatura fechada em atraso NUNCA aparecem no total da fechada — eles são TRANSFERIDOS para a fatura aberta.**

### 4.3 Regra de Herança de Encargos da Fatura Anterior

> **Uma fatura fechada SÓ mostra encargos se eles foram HERDADOS de uma fatura fechada ainda mais antiga (anterior a ela).**

#### Cenários:

| Situação | Exemplo | Fatura Fechada | Comportamento |
|----------|---------|:--------------:|---------------|
| **Primeira fatura da conta** | Qualquer massa de teste nova | R$ 3.870,86 | ✅ NÃO herda encargos. Valor = principal (valor_total). |
| **Fatura posterior com anterior PAGA** | Cliente pagou a fatura passada em dia | R$ 3.870,86 | ✅ NÃO herda encargos. A anterior foi quitada sem atraso. |
| **Fatura posterior com anterior em ATRASO** | Cliente NÃO pagou a fatura passada | R$ 3.870,86 + encargos da anterior | ✅ HERDA encargos. O saldo residual + encargos da anterior somam ao principal desta. |

**Regra de exibição:**
- A fatura fechada exibe APENAS o **principal** (`valor_total - valor_pago`)
- Se houver `saldo_anterior` (encargos herdados), este valor aparece separadamente no resumo (seção \"Saldo anterior\")
- Os encargos da fatura atual (multa, juros, IOF) NUNCA aparecem na fechada — vão para a **aberta**
- A única exceção: `saldo_anterior` que já era encargo de uma fatura ainda mais antiga

**Exemplo visual:**
```
┌──────────────────────────────────────────────┐
│  Resumo da Fatura Fechada                    │
│  ─────────────────────────────               │
│  Saldo anterior (herdado):     R$   478,48  │ ← SÓ aparece se veio de fatura mais antiga
│  Despesas do período:          R$ 3.870,86  │ ← Principal (compras do ciclo)
│  Total da fatura:              R$ 4.349,34  │
│  ─────────────────────────────               │
│  Encargos por atraso:          R$   478,48  │ ← SÓ aparece no resumo se NÃO foi paga
│  ─────────────────────────────               │
│  FATURA ABERTA:                              │
│  Saldo herdado da fechada:     R$ 4.349,34  │ ← principal + encargos HERDADOS
│  Compras do novo ciclo:        R$   969,34  │
│  Total em aberto:              R$ 5.318,68  │
└──────────────────────────────────────────────┘
```

**Por que isso é importante:**
- ✅ Evita dupla cobrança (encargos aparecerem na fechada E na aberta)
- ✅ Cliente entende que a dívida é uma só, com valor crescendo
- ✅ Motor de cálculo correto: encargos incidem sobre residual, não sobre total com juros

### 4.4 Quando a Fatura é Paga em Atraso

> **Se o cliente paga a fatura DEPOIS do vencimento, os encargos acumulados NÃO desaparecem — são herdados pela fatura aberta e ESTOPAM (congelam) até o fechamento da aberta.**

#### Fluxo completo:

```
1. Fatura FECHADA vence → entra em atraso
2. Motor calcula encargos (multa, juros, IOF) → armazena em billing_charges
3. Cliente paga o PRINCIPAL da fechada (ex: R$ 3.870,86)
4. Fatura fechada → badge \"✓ PAGA\" + valor ORIGINAL preservado (R$ 3.870,86)
5. Encargos (R$ 478,48) → HERDADOS para a fatura ABERTA
6. Fatura aberta agora:
   - currentInvoice = compras do ciclo (ex: R$ 969,34) ← NÃO inflou!
   - Encargos herdados = R$ 478,48 ← somam ao total
   - currentInvoiceTotal = 969,34 + 3.870,86 + 478,48 = R$ 5.318,68
7. Os encargos ficam \"ESTOPADOS\" — não geram novos encargos sobre si
   (juros incidem sobre o PRINCIPAL residual, não sobre juros passados)
```

---

## 5. Payload do Frontend

### 5.1 InvoicesView.tsx (rota \"Faturas\")

```typescript
// ✅ Correto após fix:
const res = await payCreditCardInvoice(user.cpf, enteredPin, pendingAmount);

// ❌ Antes (bug):
// const res = await payCreditCardInvoice(user.cpf, enteredPin);
```

### 5.2 Dashboard.tsx (rota \"Cartões\")

```typescript
// ✅ Correto — usa passwordActionPayload ref para preservar o amount:
const selectedAmount = (passwordActionPayload.current as any)?.amount;
const amountToPay = typeof selectedAmount === 'number' ? selectedAmount : user.creditCard.closedInvoice;
const result = await payCreditCardInvoice(user.cpf, pin, amountToPay);
```

---

## 6. Exibição no Frontend

### 6.1 Fatura Fechada PAGA

Quando `closedInvoiceIsPaid = true`:
- Mostrar valor ORIGINAL (principal) com badge verde \"✓ PAGA\"
- Exibir data de pagamento
- NÃO mostrar botões de \"Pagar fatura\"
- NÃO mostrar alertas de inadimplência

### 6.2 Fatura Fechada em Atraso

Quando `closedInvoice > 0 && daysOverdue > 0`:
- Mostrar valor RESIDUAL (principal - pago)
- Mostrar dias em atraso
- Encargos são herdados pela aberta (não mostrar na fechada)
- Botões: \"Pagar fatura\", \"Parcelar fatura\", \"Pagar com PIX\"

### 6.3 Flags de Display

| Campo | Onde | Uso |
|-------|------|-----|
| `_closedInvoiceValorTotal` | fatura paga | Mostrar valor original |
| `_closedInvoiceValorPago` | fatura paga | Mostrar quanto foi pago |
| `closedInvoiceIsPaid` | fatura paga | Badge verde |
| `closedInvoicePaidAt` | fatura paga | Data do pagamento |
| `closedInvoiceCharges` | admin/admin | Referência de encargos |
| `daysOverdue` | qualquer | Dias em atraso |

### 6.3.1 Exibição Permanente de Encargos na Fatura Fechada

> **A seção de encargos na fatura fechada DEVE ser exibida SEMPRE — mesmo quando a fatura está paga — como demonstrativo informativo de que não houve herança de encargos de fatura anterior.**

#### Regra de Exibição

| Estado | Header | Valores | Cor |
|:-------|:-------|:-------:|:---:|
| **Fatura NÃO paga** | `⚠️ Encargos do Atraso (18 dias acumulados no período)` | Calculados pelo motor | Amber 🟠 |
| **Fatura PAGA** | `📄 Encargos do Atraso (0 dias - Pago em dia)` | R$ 0.00 (todos) | Cinza ⚪ opaco |

#### Comportamento Visual

- Quando **paga**: opacidade reduzida (opacity-40) + cor cinza (text-zinc-400) + header muda de `⚠️` para `📄`
- Quando **não paga**: cores normais (amber) + valores reais calculados
- A nota informativa no final adapta o texto conforme `isPaid`

#### Por que SEMPRE exibir?

1. ✅ **Transparência**: O admin vê explicitamente que a fatura paga NÃO herdou encargos
2. ✅ **Consistência visual**: A estrutura da seção é sempre a mesma, independente do estado de pagamento
3. ✅ **Auditoria visual**: Valores zerados confirmam que não há encargos residuais esquecidos
4. ✅ **Regra de negócio clara**: "Encargos zerados = não houve herança de fatura anterior"

#### Código de Referência (Admin.tsx)

```tsx
<>
<div className={`pt-2 font-bold text-[10px] uppercase tracking-wider ... ${
    isPaid ? 'text-zinc-400' : 'text-amber-500'
}`}>
    <span>{isPaid ? '📄' : '⚠️'} Encargos do Atraso ({isPaid ? '0 dias - Pago em dia' : `${overdueDays} dias acumulados no período`}):</span>
</div>

{/* Valores: se paga = R$ 0.00, se não paga = calculado */}
<span className="font-mono font-bold">R$ {(!isPaid ? multa : 0).toFixed(2)}</span>
<span className="font-mono font-bold">R$ {(!isPaid ? jurosMora : 0).toFixed(2)}</span>
{/* ... mesma lógica para todos os 5 encargos ... */}
</>
```

#### Nota Informativa (adaptável)

```tsx
{isPaid ? (
    // Fatura paga: encargos zerados
    <div>✅ Fatura quitada em DD/MM/AAAA. Encargos zerados = não houve herança de fatura anterior.</div>
) : (
    // Fatura não paga: encargos reais
    <div>ℹ️ Esta fatura fechada é informativa. Os encargos do atraso (R$ X) são herdados para a ABERTA.</div>
)}
```

---

### 6.3.2 IOF no Painel Admin — Cálculo para Exibição

> **No painel Admin (diagnóstico backoffice), os componentes IOF Fixo e IOF Diário são calculados SEMPRE sobre o `originalClosedAmount` usando a fórmula original do motor, NUNCA por rateio arbitrário do `bkCharges.iof`.**

#### ❌ ERRADO (removido):

```javascript
// Rateio 50/50 do bkCharges.iof — ARBITRÁRIO e INCORRETO
const iofFixo = isFinite(iofTotal) ? Math.round(iofTotal * 0.50 * 100) / 100 : ...
const iofDiario = isFinite(iofTotal) ? (iofTotal - iofFixo) : ...
```

**Por que é errado:** A proporção real entre IOF Fixo e IOF Diário depende dos dias de atraso. Com 18 dias:
- IOF Fixo = 0.38% ≈ 0.38/(0.38+0.1476) ≈ **72%** do total
- IOF Diário = 0.0082%/dia × 18d ≈ 0.1476% ≈ **28%** do total
- Rateio 50/50 superestima o IOF Diário em ~79%!

#### ✅ CORRETO (fórmula original):

```javascript
// Fórmula original do motor, SEMPRE sobre originalClosedAmount:
const iofFixo = originalClosedAmount > 0
    ? Math.round(originalClosedAmount * 0.0038 * 100) / 100
    : 0;
const iofDiario = isOverdue && originalClosedAmount > 0
    ? Math.round(originalClosedAmount * 0.000082 * overdueDays * 100) / 100
    : 0;
const iofTotalCalc = iofFixo + iofDiario;
```

**Por que está correto:** A fórmula replica exatamente o cálculo do motor `runBillingValidation` (ver [Seção 10.5](#105-fórmulas-de-encargos-runbillingvalidation)), garantindo que:
- IOF Fixo = 0.38% do principal (alíquota única independente de dias)
- IOF Diário = 0.0082%/dia × dias de atraso × principal
- A soma dos dois = IOF total acumulado pelo motor
- Mesmo após pagamento, os valores são calculados corretamente sobre o valor original

#### Onde se aplica

| Contexto | Fórmula | Exemplo (R$ 3.870,86, 18 dias) |
|:---------|:--------|:------------------------------:|
| Admin.tsx — Painel Backoffice (fechada paga) | Fórmula original sobre `originalClosedAmount` | IOF Fixo: R$ 14,71 / IOF Diário: R$ 5,71 |
| Admin.tsx — Fatura Aberta (herança) | Fórmula original sobre `originalClosedAmount` | Mesmos valores |
| Admin.tsx — Fatura Fechada não paga | `bkCharges.iof` do backend (fonte única) | IOF Total: R$ 20,42 |

---

### 6.4 Transação de Pagamento (PAYMENT) — Exibição no Frontend

> **A transação `INVOICE_PAYMENT` (tipo `PAYMENT`) DEVE aparecer na lista de transações da fatura ABERTA (`openTransactions`), NUNCA na fatura fechada (`closedTransactions`).**

#### 6.4.1 Regras de Display

| Aspecto | Regra |
|---------|-------|
| **Onde aparece** | Na lista de `openTransactions` da fatura aberta |
| **Tipo visual** | Transação de crédito (entrada) com badge verde \"✓ PAGO\" |
| **Sinal do amount** | **Positivo** na lista (`+R$ 3.870,86`) — é um crédito que abate o saldo |
| **Descrição** | `\"Pagamento fatura\"` + tipo (Total / Mínimo / Parcial) |
| **Ícone** | Verde (diferente dos ícones de compra que são neutros/escuros) |
| **Agrupamento** | Aparece MISTURADO com as compras do ciclo, em ordem cronológica |

#### 6.4.2 Visual no Frontend

```
┌──────────────────────────────────────────────────┐
│  Últimas movimentações da fatura                 │
│  ───────────────────────────────                 │
│  │ ⋮  │ Pagamento fatura (Total) 28/jul  +R$ 3.870,86  │
│  │ ✓  │                               [PAGO]          │
│  ├─────┼────────────────────────────────────────┤
│  │ 🛵  │ iFood                  26/jul    R$   144,51  │
│  │ 🚗  │ Uber                   25/jul    R$    72,01  │
│  │ 🛒  │ Mercado Livre          24/jul    R$   529,66  │
│  ├─────┼────────────────────────────────────────┤
│  │ 💳  │ Anuidade               20/jul    R$   223,16  │
│  └─────┴────────────────────────────────────────┘
└──────────────────────────────────────────────────┘
```

#### 6.4.3 Impacto nos Indicadores da Fatura Aberta

| Indicador | Afetado pelo PAYMENT? | Comportamento |
|-----------|:---------------------:|---------------|
| `currentInvoice` (compras) | ❌ **NÃO** | Permanece inalterado — soma apenas as compras do ciclo |
| `currentInvoiceTotal` | ✅ **SIM** | O PAYMENT NÃO altera este valor diretamente; o total reflete compras + saldo herdado + encargos |
| `openTransactions` | ✅ **SIM** | O PAYMENT aparece como mais uma transação na lista |
| `closedInvoice` | ✅ **SIM** | Após pagamento total, fica R$ 0,00 com badge PAGA; após parcial, reduz o residual |
| Limite disponível | ✅ **SIM** | O limite aumenta proporcionalmente ao valor pago |

#### 6.4.4 Comportamento por Tipo de Pagamento

| Tipo | Descrição no Frontend | Amount exibido | Badge |
|------|----------------------|:--------------:|:-----:|
| **Total** | `\"Pagamento fatura\"` | `+R$ 3.870,86` | ✓ PAGO 🟢 |
| **Mínimo** | `\"Pagamento fatura (Mínimo)\"` | `+R$ 387,09` | ✓ PAGO 🟢 |
| **Parcial** | `\"Pagamento fatura (Parcial)\"` | `+R$ 1.500,00` | ✓ PAGO 🟢 |

#### 6.4.5 Regras de Atualização Visual (Pós-Pagamento)

1. **Fatura fechada PAGA:**
   - `closedInvoice` → R$ 0,00
   - Exibir badge verde **\"✓ PAGA\"** ao lado do valor ORIGINAL preservado (`_closedInvoiceValorTotal`)
   - Mostrar data do pagamento (`closedInvoicePaidAt`)
   - Remover botões de ação (Pagar, PIX, Boleto)
   - Adicionar texto informativo: \"Fatura paga em 28/07/2026\"

2. **Fatura fechada com pagamento PARCIAL:**
   - `closedInvoice` → residual (valor_total - valor_pago)
   - Exibir badge informativo **\"Pagamento parcial\"**
   - Mostrar valor pago (`_closedInvoiceValorPago`) e valor restante
   - Botões de ação permanecem para pagar o residual

3. **Fatura aberta — PAYMENT visível:**
   - A transação PAYMENT aparece na lista de lançamentos
   - Se o usuário entrar na tela de Faturas, os dados são recarregados via `getUserByCpf()`
   - A API retorna `user.creditCard.openTransactions` contendo a transação PAYMENT
   - O frontend DEVE chamar `getUserByCpf()` após pagamento para atualizar o estado

#### 6.4.6 Regras de Consistência Visual

1. ✅ PAYMENT NUNCA aparece em `closedTransactions` — apenas em `openTransactions`
2. ✅ PAYMENT NÃO altera a cor/ícone do `currentInvoice`
3. ✅ Pagamento total → badge PAGA na fechada + PAYMENT na aberta
4. ✅ Pagamento parcial → residual visível na fechada + PAYMENT na aberta
5. ✅ Após pagamento, o frontend DEVE recarregar os dados (não confiar apenas no cache)
6. ❌ NUNCA mostrar valor gross (com encargos) como \"valor original\" da fatura paga — usar `_closedInvoiceValorTotal` que é o PRINCIPAL

---

## 7. Banco de Dados

### 7.1 Tabela `invoices`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Chave primária |
| `cpf` | VARCHAR(11) | CPF do titular |
| `status` | VARCHAR | `ABERTA` ou `FECHADA` |
| `valor_total` | DECIMAL(15,2) | Principal (compras do ciclo) |
| `valor_pago` | DECIMAL(15,2) | Total já pago desta invoice |
| `data_pagamento` | TIMESTAMP | Quando foi totalmente quitada |
| `due_date` | TIMESTAMP | Data de vencimento |
| `dias_atraso` | INTEGER | Dias de atraso (sincronizado pelo motor) |
| `multa` | DECIMAL(15,2) | Multa congelada |
| `juros_mora` | DECIMAL(15,2) | Juros de mora congelados |
| `juros_remuneratorios` | DECIMAL(15,2) | Juros remuneratórios congelados |
| `iof` | DECIMAL(15,2) | IOF congelado |
| `saldo_anterior` | DECIMAL(15,2) | Saldo anterior (se houver) |

### 7.2 Restrições
- `valor_pago` NUNCA pode exceder `valor_total` (cap via `LEAST()`)
- `dias_atraso` deve ser sincronizado periodicamente via `sync_invoice_dias_atraso.js`
- Pagamento parcial distribui entre invoices (mais antiga primeiro)

---

## 8. Transação de Pagamento (INVOICE_PAYMENT)

### 8.1 Onde Aparece

> **`INVOICE_PAYMENT` DEVE aparecer em `openTransactions` (fatura aberta), NÃO em `closedTransactions` (fatura fechada).**

### 8.2 Regras

1. **`PAYMENT` vai para a fatura ABERTA** como transação de crédito (amount negativo)
2. **`PAYMENT` NÃO altera `currentInvoice`** — o valor da fatura aberta (compras do ciclo) permanece inalterado
3. **`PAYMENT` aparece no extrato** como \"Pagamento fatura\" com badge verde ✓ PAGO
4. **`paymentHistory`** é campo separado agregado para referência do admin
5. **`currentInvoiceTotal`** reflete o pagamento (deduz do saldo total), mas `currentInvoice` (compras) não

### 8.3 Visual no Frontend

```
┌──────────────────────────────────────────────┐
│  Fatura Aberta — Transações                   │
│  ─────────────────────────────               │
│  Pagamento fatura   28/jul   +R$ 3.870,86  │
│                                   [✓ PAGO]  │
│  iFood              26/jul    R$   144,51    │
│  Uber               25/jul    R$    72,01    │
└──────────────────────────────────────────────┘
```

---

## 9. Auditoria e Consistência

### 9.1 Scripts de Auditoria

| Script | Finalidade | Comando |
|--------|------------|---------|
| `scripts/audit_completo.js` | Double-counting + negative balance | `node scripts/audit_completo.js` |
| `scripts/audit_retroativo_double_charge.js` | Corrigir valor_pago > valor_total | `node scripts/audit_retroativo_double_charge.js --fix --confirm` |
| `npm run audit:all` | Auditoria completa + relatório HTML | `npm run audit:all` |
| `scheduled/sync_invoice_dias_atraso.js` | Sincronizar dias_atraso | (cron diário meia-noite) |

### 9.2 Regras de Consistência

1. `valor_pago` NUNCA > `valor_total` (se acontecer, é bug de double-counting)
2. `days_overdue` do usuário DEVE bater com `dias_atraso` da invoice
3. Encargos são calculados sobre **residual** (`valor_total - valor_pago`), não sobre `valor_total` bruto
4. Pagamento visível como `PAYMENT` na fatura aberta — se não aparecer, é bug

---

## 10. Motor de Validação Diária — runBillingValidation

### 10.1 Visão Geral

> **O `runBillingValidation` é o motor diário que percorre TODOS os usuários com fatura fechada não paga, calcula encargos sobre o saldo residual e atualiza o status de inadimplência.**

```
Execução:    Diária (meia-noite via node-cron) + Sob demanda (POST /admin/billing/validate-all)
Local:       API/index.cjs, linha 4048
Função:      async function runBillingValidation()
Atualiza:    users (account_status, days_overdue), invoices (dias_atraso), billing_charges
```

### 10.2 Fluxo de Execução

```
1. Carregar billing_config (close_day, due_day, grace_period, is_active)
   ├── Se is_active = false → retorna sem executar
   └── Calcular ciclo atual → computeCurrentCycle(cfg) → invoiceRef, closeDate, dueDate

2. Buscar TODOS os usuários (SELECT cpf, account_status, days_overdue)

3. Buscar faturas FECHADA E NÃO PAGAS (grupo por CPF — mais antiga primeiro)
   └── Para cada CPF: calcular RESIDUAL = max(0, valor_total - valor_pago)
       (Esta é a FONTE ÚNICA do saldo devedor para o cálculo de encargos)

4. Para cada usuário com fatura em atraso:
   ├── Calcular daysOverdue = floor((today - due_date) / 86400000)
   ├── Calcular novo status: daysOverdue >= 1 → 'inadimplente', senão 'adimplente'
   ├── Se daysOverdue > 0:
   │   ├── Consultar billing_charges ja acumulados (SELECT SUM WHERE status='pending')
   │   ├── Calcular target via calcAllCharges(residual, daysOverdue)
   │   ├── Inserir APENAS o delta positivo (target - existing). NUNCA deleta.
   │   └── Todos calculados sobre o RESIDUAL (não valor_total bruto)
   └── Se account_status ou days_overdue mudou:
       └── UPDATE users SET account_status, days_overdue

5. Sincronizar dias_atraso nas invoices (SQL bulk UPDATE)

6. Retornar resumo: { success, message, cycle, markedInadimplente, markedAdimplente, chargesGenerated, chargesDetail }
```

### 10.3 Cálculo de Encargos (sobre o Residual)

> **Regra crítica: `invoiceAmount` usado no cálculo NUNCA é o `valor_total` bruto — é o RESIDUAL (`valor_total - valor_pago`).**

```javascript
// Fonte: closedDueByCpf
const residual = Math.max(0, parseFloat(row.valor_total || 0) - parseFloat(row.valor_pago || 0));
closedDueByCpf.set(row.cpf, { dueDate: row.due_date, amount: residual, valorTotal, valorPago });
```

### 10.4 Regras Importantes

| Regra | Descrição |
|:------|:----------|
| **Fonte do vencimento** | Usa `due_date` da tabela `invoices`, NÃO `user.credit_card_invoice_due_date` |
| **Base de cálculo** | SEMPRE sobre o residual (`valor_total - valor_pago`), nunca sobre o valor bruto |
| **Encargos diários** | A cada execução (diária), os encargos são **ACUMULADOS** — consulta o existente, calcula o target, insere só o delta positivo. **NUNCA deleta.** |
| **Status** | `daysOverdue >= 1` → inadimplente. Qualquer dia após o vencimento (sem grace period) |
| **Grace period** | Não aplicado no runBillingValidation. O grace está no `dueDate + 3` para bloqueio de cartão |
| **Pagamento parcial** | Encargos incidem sobre o residual — quem pagou parcialmente paga menos encargos |
| **Fatura paga** | Fatura com `data_pagamento` preenchida é ignorada — não gera encargos nem atualiza status |

### 10.5 Fórmulas de Encargos (runBillingValidation)

| Encargo | Fórmula | Exemplo (R$ 3.870,86, 18 dias) |
|---------|---------|:------------------------------:|
| **Multa** (2%) | `residual × 0,02` | R$ 77,42 |
| **IOF** fixo (0,38%) + diário (0,0082%/dia) | `residual × 0,0038 + residual × 0,000082 × dias` | R$ 20,42 |
| **Juros Remuneratórios** (0,513%/dia) | `residual × 0,00513 × dias` | R$ 357,44 |
| **Juros de Mora** (0,0333%/dia) | `residual × 0,000333 × dias` | R$ 23,20 |
| **Total** | Soma dos 4 encargos | **R$ 478,48** |

### 10.6 Cron de Execução

O motor roda automaticamente via `node-cron` no startup da API:

```javascript
cron.schedule('0 0 * * *', async () => {
    // 1. Invoice Engine (runEngine)
    // 2. runBillingValidation()
    // 3. recurringEngine.runEngine()
    // 4. syncInvoiceDiasAtraso()
});
```

**Ordem de execução:**
1. Invoice Engine — fecha ciclos, cria novas faturas
2. Billing Validation — recalcula encargos e status
3. Recurring Engine — cobra assinaturas recorrentes
4. Sync Dias Atraso — sincroniza dias_atraso nas invoices (redundância segura)

### 10.7 Rotas da API

| Método | Rota | Descrição |
|:------:|:-----|:----------|
| `POST` | `/admin/billing/validate-all` | Executa runBillingValidation sob demanda |
| `POST` | `/admin/billing/run-cycle` | Alias da mesma função |

**Ambas exigem autenticação de admin** (`bearerAuth` + `authenticateAdmin`).

### 10.8 syncInvoiceDiasAtraso (função complementar)

> **Função separada que sincroniza bulk os `dias_atraso` na tabela `invoices` — roda tanto no runBillingValidation (inline) quanto como função independente.**

Atualiza:
```sql
UPDATE invoices
SET dias_atraso = GREATEST(0, (CURRENT_DATE - due_date::date)),
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'FECHADA'
  AND data_pagamento IS NULL
  AND due_date < CURRENT_TIMESTAMP
  AND COALESCE(dias_atraso, -1) != GREATEST(0, (CURRENT_DATE - due_date::date))
```

**Importante:** A condição `COALESCE(dias_atraso, -1) != ...` garante que a query só atualiza linhas cujo valor mudou — evitando writes desnecessários.

### 10.9 Regra Critica - Acumulacao de Encargos (NUNCA Deletar)

> **O motor NUNCA deleta encargos acumulados. Cada execução adiciona apenas o delta positivo (target - existing). Encargos antigos são penalidade preservada.**

#### ❌ Comportamento Antigo (Removido)

```javascript
// ANTES: DELETE + INSERT — perdia encargos acumulados!
DELETE FROM billing_charges WHERE cpf = '?' AND invoice_reference = '?' AND status = 'pending';
INSERT INTO billing_charges (id, cpf, invoice_reference, charge_type, amount, ...)
VALUES ('multa', ?), ('iof', ?), ('juros_rem', ?), ('juros_mora', ?);
```

**Problema:** Se o cliente pagava parcialmente, o residual diminuía e o DELETE+INSERT recalculava encargos APENAS sobre o novo residual menor — PERDENDO os encargos já acumulados sobre o valor original. Isso anulava a penalidade por atraso.

**Exemplo do bug:**
```
Antes do pagamento:  19 dias × R$ 3.870,86 → encargos = R$ 499,94  ← acumulado
Pagamento parcial:   R$ 2.870,86 → residual = R$ 1.000,00
Depois (motor roda): 20 dias × R$ 1.000,00 → encargos = R$ 140,24 ← PERDEU R$ 359,70!
```

#### ✅ Comportamento Novo (Implementado)

```javascript
// AGORA: Consulta existente, calcula target, insere só a diferença

// 1. Buscar encargos já acumulados para este CPF + invoice_reference
const existingCharges = await databricksService.executeQuery(`
    SELECT charge_type, SUM(amount) as total
    FROM billing_charges
    WHERE cpf = '${u.cpf}' AND invoice_reference = '${overdueInvoiceRef}'
    GROUP BY charge_type
`);
const getExisting = (type) => parseFloat(existingCharges.find(c => c.charge_type === type)?.total || 0);

// 2. Calcular target (encargos que DEVERIAM estar acumulados)
const ch = calcAllCharges(residual, daysOverdue);

// 3. Para cada tipo, inserir APENAS a diferença positiva
const chargeDefs = [
    { type: 'multa',              target: ch.multa },
    { type: 'iof',                target: ch.iof },
    { type: 'juros_remuneratorios', target: ch.jurosRemuneratorios },
    { type: 'juros_mora',         target: ch.jurosMora }
];

for (const cd of chargeDefs) {
    const existing = getExisting(cd.type);
    const diff = round2(cd.target - existing);
    if (diff > 0.005) {
        // Só insere se target > existing (delta positivo)
        await databricksService.executeQuery(`
            INSERT INTO billing_charges (...)
            VALUES ('${idBase}_${cd.type}', '${u.cpf}', '${overdueInvoiceRef}', '${cd.type}', ${diff}, ...)
        `);
    }
}
// NUNCA deleta — encargos antigos PRESERVADOS como penalidade!
```

#### Regras de Ouro

| # | Regra | Consequência se violada |
|:-:|:------|:------------------------|
| 1 | **NUNCA** use `DELETE` em `billing_charges` com `status = 'pending'` | Cliente paga parcial e perde encargos acumulados |
| 2 | Sempre consulte o total existente por `cpf + invoice_reference + charge_type` | Duplicatas de encargos |
| 3 | Calcule o target com `calcAllCharges(residual, daysOverdue)` | Fórmula errada → encargos incorretos |
| 4 | Insira apenas `max(0, target - existing)` — o delta positivo | Encargos podem ser negativos (inexistente) |
| 5 | Se `target < existing` (residual diminuiu), **NÃO faça nada** — penalidade fica | Penalidade perdida |
| 6 | A cada execução, os encargos só AUMENTAM (ou estabilizam) | Regressão de encargos |

#### Exemplo Numerico Detalhado

```
Fatura: R$ 3.870,86 | Pagamento parcial: R$ 2.870,86 no dia 20 | Residual: R$ 1.000,00

Dia 1-19: Motor rodou (ou deveria ter rodado) → acumulou encargos sobre R$ 3.870,86
  Multa (2%):               77,42
  Juros Mora (19d x 0,0333%):  24,49
  Juros Rem (19d x 0,513%):   377,29
  IOF (0,38% + 19d x 0,0082%): 20,74
  Total acumulado:             499,94  ← ISSO FICA!

Dia 20: Pagamento de R$ 2.870,86 → residual = R$ 1.000,00

Dia 20: Motor roda NOVAMENTE:
  target = calcAllCharges(1000, 20) → R$ 140,24
  existing (ja acumulado) = R$ 499,94
  diff = 140,24 - 499,94 = -359,70 → NAO insere nada
  → R$ 499,94 PRESERVADOS (penalidade mantida!)

Dia 30: Motor roda (sem novo pagamento):
  target = calcAllCharges(1000, 30) → R$ 198,24
  existing = R$ 499,94
  diff = 198,24 - 499,94 = -301,70 → NAO insere nada
  → R$ 499,94 AINDA PRESERVADOS

Conclusao: Os R$ 499,94 acumulados nos primeiros 19 dias sobre o valor ORIGINAL
sao PERMANENTES — nunca diminuem, mesmo que o residual caia para R$ 1.000,00.
```

#### Impacto no Frontend

Com a acumulação correta:
- `closedInvoiceCharges` no payload mostra os encargos TOTAIS acumulados (nunca diminuem)
- `buildClosedInvoiceSummary` retorna `daysOverdue` real e `totalEncargos` real
- `currentInvoiceTotal` reflete a soma correta: compras + residual + encargos acumulados
- Após pagamento parcial, os encargos antigos CONTINUAM visíveis no admin

---

## 11. Função getClosedInvoiceDebt — Cálculo do Saldo Devedor para Pagamento

### 11.1 Visão Geral

> **`getClosedInvoiceDebt` calcula o valor TOTAL devido de TODAS as faturas fechadas não pagas de um CPF. É a FONTE ÚNICA usada pela rota `/cards/invoice/pay` para determinar quanto cobrar.**

```
Local:       API/index.cjs, linha 4340
Função:      async function getClosedInvoiceDebt(cpf)
Retorna:     { invoice, invoices, oldest, owed } | null
Usada por:   POST /cards/invoice/pay  (para calcular totalDue)
```

### 11.2 Código da Função

```javascript
async function getClosedInvoiceDebt(cpf) {
    const { esc } = repoContext;
    const rows = await databricksService.executeQuery(`
        SELECT id, due_date, created_at, valor_total, saldo_anterior, valor_iof,
               valor_multa, valor_juros_remuneratorios, valor_juros_mora,
               COALESCE(valor_pago, 0) AS valor_pago
        FROM ${databricksService.fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
        ORDER BY due_date ASC
    `);
    if (!rows.length) return null;

    const round2 = n => Math.round(n * 100) / 100;
    const invoices = rows.map(row => {
        const residual = round2(parseFloat(row.valor_total || 0) - parseFloat(row.valor_pago || 0));
        return { ...row, owed: Math.max(0, residual) };
    });
    const owed = round2(invoices.reduce((sum, inv) => sum + inv.owed, 0));

    return {
        invoice: invoices[invoices.length - 1],
        invoices,
        oldest: invoices[0],
        owed
    };
}
```

### 11.3 Regra Fundamental

> **O valor `owed` retornado é SEMPRE o RESIDUAL (`valor_total - valor_pago`), NUNCA o GROSS (`computeInvoiceGross`).**

### 11.4 Fluxo de Uso no Pagamento

```
POST /cards/invoice/pay
  ├── getClosedInvoiceDebt(cpf) → { owed, invoices }
  ├── payType = amount >= owed ? 'TOTAL' : amount >= owed*0.1 ? 'MINIMO' : 'PARCIAL'
  ├── settleClosedInvoices(cpf, nowISO, amount)  ← distribui pagamento
  ├── INSERT INVOICE_PAYMENT transaction
  ├── UPDATE users SET balance = balance - amount
  └── Retorna { success, paymentType, valorPago, paymentCodes }
```

### 11.5 Exemplos de Cálculo

```
Fatura única (R$ 3.870,86, sem pagamento prévio):
  getClosedInvoiceDebt → owed = R$ 3.870,86

Fatura com pagamento parcial prévio (R$ 1.500 já pagos):
  residual = 3.870,86 - 1.500,00 = R$ 2.370,86
  getClosedInvoiceDebt → owed = R$ 2.370,86

Duas faturas (R$ 1.200 + R$ 3.870,86, nenhuma paga):
  owed = 1.200,00 + 3.870,86 = R$ 5.070,86
```

### 11.6 Regras Importantes

1. `owed` é calculado por invoice, NÃO por CPF (a soma é que consolida)
2. Ordenação ASC por `due_date` — a mais antiga primeiro
3. `valor_pago` é sempre `COALESCE(valor_pago, 0)` — nunca NULL
4. `residual` NUNCA é negativo (`Math.max(0, ...)`)
5. Fatura paga (`data_pagamento IS NOT NULL`) é excluída da query

---

## 12. Função settleClosedInvoices — Distribuição de Pagamento

### 12.1 Visão Geral

> **`settleClosedInvoices` distribui um valor de pagamento entre as faturas fechadas não pagas, da mais antiga para a mais recente, usando `planDistribution`.**

```
Local:       API/index.cjs, linha 4360
Função:      async function settleClosedInvoices(cpf, nowIso, payAmount)
Efeito:      Atualiza valor_pago no banco, marca data_pagamento quando quita
```

### 12.2 Fluxo Completo

```
getClosedInvoiceDebt(cpf) → invoices e owed
  └── Se nenhuma invoice ou owed = 0 → retorna sem ação

planDistribution(invoices, payAmount) → { applied, remaining, allPaid, invoices }
  └── Para cada invoice (da mais antiga):
      1. target = valor_total  ← PRINCIPAL, NÃO gross
      2. novoPago = min(remaining, target - currentPago)
      3. novoPago = min(novoPago, target * 1.0)  ← cap no target
      4. UPDATE valor_pago = valor_pago + novoPago
      5. Se novoPago + currentPago >= target:
         → marca data_pagamento = nowIso  ← fatura quitada!
      6. remaining -= novoPago
      7. Se remaining <= 0 → para (pagamento totalmente distribuído)
```

### 12.3 Regras de Distribuição

1. **Ordem:** Mais antiga primeiro (a fatura mais velha é quitada antes)
2. **Target:** `valor_total` (principal), NUNCA `computeInvoiceGross`
3. **Cap:** `valor_pago` NUNCA excede `valor_total` (protegido por `Math.min`)
4. **Data de pagamento:** Marcada quando `novoPago + valorPagoExistente >= target - 0.005`
5. **Distribuição total:** Se `payAmount` cobre todas as faturas, todas são marcadas como quitadas
6. **Distribuição parcial:** A última fatura recebe apenas o residual, sem ser marcada como quitada

### 12.4 Exemplos de Distribuição

```
Exemplo 1: Pagamento total de fatura única
  payAmount = R$ 3.870,86, invoice = { valor_total: R$ 3.870,86, valor_pago: 0 }
  → Aplica R$ 3.870,86 → valor_pago = R$ 3.870,86 → data_pagamento = now → quitada!

Exemplo 2: Pagamento parcial (R$ 2.000 em fatura de R$ 3.870,86)
  payAmount = R$ 2.000,00, invoice = { valor_total: R$ 3.870,86, valor_pago: 0 }
  → Aplica R$ 2.000,00 → valor_pago = R$ 2.000,00 → NÃO quitada (restam R$ 1.870,86)

Exemplo 3: Pagamento distribuído entre 2 faturas (R$ 5.000)
  Invoice A: R$ 1.200,00 (paga)
  Invoice B: R$ 3.870,86 (restam R$ 3.800,00 → paga com R$ 3.870,86)
  → Neste caso, R$ 5.000 cobre ambas. A é quitada, B é quitada, sobram R$ 0,14.
```

---

## 13. Função enrichUserCreditCardData — Montagem dos Dados de Cartão/Fatura

### 13.1 Visão Geral

> **`enrichUserCreditCardData` é a função central que monta o objeto `user.creditCard` enviado ao frontend. Ela consulta as invoices, calcula saldos, encargos e monta as transações.**

```
Local:       API/index.cjs, linha 155
Função:      async function enrichUserCreditCardData(normalized, cpf)
Efeito:      Modifica normalized.creditCard in-place com todos os campos
Retorna:     void (altera o objeto normalized passado por referência)
```

### 13.2 Parâmetros de Entrada

| Parâmetro | Tipo | Origem | Descrição |
|-----------|------|--------|-----------|
| `normalized` | Object | `normalizeUser(userRow)` | Objeto do usuário já normalizado com dados básicos |
| `normalized.creditCard` | Object | Vem do userRow | Contém `currentInvoice`, `invoiceDueDate` da tabela users |
| `cpf` | String | `normalized.cpf` | CPF para consultar invoices no banco |

### 13.3 Etapas de Execução (Passo a Passo)

```
Etapa 1 — Carregar invoices do banco (linha ~165)
  ├── SELECT * FROM invoices WHERE cpf = ? ORDER BY due_date DESC
  └── Filtra por computeInvoiceGross(i) > 0  (só as que têm algum valor)

Etapa 2 — Buscar encargos pendentes (linha ~180)
  ├── SELECT FROM billing_charges WHERE cpf = ? AND status = 'pending'
  └── Agrupa por charge_type, soma amounts: multa, iof, juros_rem, juros_mora

Etapa 3 — Calcular dias em atraso (linha ~195)
  ├── Usa user.credit_card_invoice_due_date OU due_date da invoice fechada
  └── daysOverdue = floor((hoje - dueDate) / 86400000)

Etapa 4 — Montar fatura fechada (linha ~210)
  ├── Filtra invRows: status == 'FECHADA'
  ├── Separa não pagas (data_pagamento IS NULL)
  ├── closedInvoice = Σ (valor_total - valor_pago) ← RESIDUAL
  ├── _closedInvoiceValorTotal = Σ valor_total ← PRINCIPAL (badge PAGA)
  ├── _closedInvoiceValorPago = Σ valor_pago ← total pago
  ├── closedInvoiceDueDate = due_date da mais recente não paga
  ├── closedInvoiceIsPaid = computeInvoicePaidInfo(latestFechada).isPaid
  └── closedInvoicePaidAt = computeInvoicePaidInfo(latestFechada).paidAt

Etapa 5 — Montar transações PAYMENT (linha ~250)
  ├── SELECT FROM transactions WHERE cpf, type='INVOICE_PAYMENT'
  └── Filtra por janela de 90 dias (ciclo atual)
      ├── paymentHistory → array completo para admin
      └── openTransactions ← PAYMENT incluído aqui

Etapa 6 — Calcular encargos atuais (linha ~280)
  ├── Se daysOverdue > 0 E closedInvoice > 0:
  │   ├── multa = residual * 0.02
  │   ├── jurosMora = residual * 0.000333 * daysOverdue
  │   ├── jurosRem = residual * 0.00513 * daysOverdue
  │   ├── iof = residual * (0.0038 + 0.000082 * daysOverdue)
  │   └── currentInvoiceTotal = currentInvoice + closedInvoice + totalEncargos
  └── Se NÃO: currentInvoiceTotal = currentInvoice (sem encargos)

Etapa 7 — Mapear transações para o formato do frontend (linha ~320)
  ├── Para cada transação no banco:
  │   ├── merchant ← mapeia tipo (PAYMENT, PURCHASE, etc.)
  │   ├── Se PAYMENT: merchant = mapeia descrição (Total/Mínimo/Parcial)
  │   └── Se PAYMENT: amount = Math.abs(amount), ícone verde
  └── closedTransactions → transações da fatura fechada (sem PAYMENT)

Etapa 8 — Definir campos de display (linha ~380)
  ├── fields: availableLimit, totalLimit, pointsBalance, isBlocked, etc.
  ├── closedInvoiceCharges → { multa, jurosMora, jurosRem, iof, totalEncargos }
  └── closedInvoiceTotal → só o principal (R$ 3.870,86)
```

### 13.4 Campos que a Função Define (creditCard)

| Campo | Origem | Descrição |
|-------|--------|-----------|
| `currentInvoice` | userRow.credit_card_current_invoice | Compras do ciclo atual |
| `closedInvoice` | Σ residual das fechadas não pagas | Saldo devedor |
| `closedInvoiceTotal` | Σ valor_total | Badge PAGA (valor original) |
| `closedInvoiceIsPaid` | computeInvoicePaidInfo | Booleano |
| `closedInvoicePaidAt` | invoice.data_pagamento | Timestamp |
| `_closedInvoiceValorTotal` | Σ valor_total das não pagas | Display fechada |
| `_closedInvoiceValorPago` | Σ valor_pago | Quanto foi pago |
| `closedInvoiceDueDate` | invoice.due_date | Vencimento da fechada |
| `closedInvoiceCharges` | billing_charges | { multa, jurosMora, jurosRem, iof, totalEncargos } |
| `currentInvoiceTotal` | currentInvoice + closedInvoice + encargos | Total da aberta |
| `currentInvoiceMinimo` | 10% do total | Pagamento mínimo |
| `daysOverdue` | calculado | Dias em atraso |
| `openTransactions` | transactions do ciclo | Lançamentos da aberta |
| `closedTransactions` | transactions da fechada (sem PAYMENT) | Lançamentos da fechada |
| `paymentHistory` | todas INVOICE_PAYMENT | Histórico admin |

### 13.5 Regras Críticas

1. **`currentInvoice` NUNCA é alterado** — permanece o valor do banco (soma de compras)
2. **`closedInvoice` = residual (valor_total - valor_pago)** — NUNCA gross
3. **`_closedInvoiceValorTotal` = Σ valor_total** — para badge PAGA, NUNCA gross
4. **Encargos herdados** somam a `currentInvoiceTotal`, NÃO a `currentInvoice`
5. **PAYMENT incluso em openTransactions**, NÃO em closedTransactions
6. **`currentInvoice` filtra PAYMENT** — `filter(tx => tx.type !== 'PAYMENT')`
7. **Todos os valores são arredondados** via `_r2()` (round2)

### 13.6 Fluxo de Dados (Diagrama)

```
         ┌──────────────────────────────────────────────────┐
         │               enrichUserCreditCardData            │
         │                                                   │
         │  invRows ← SELECT invoices WHERE cpf              │
         │      │                                            │
         │      ▼                                            │
         │  billing_charges ← SELECT pending charges         │
         │      │                                            │
         │      ▼                                            │
         │  daysOverdue ← calc days since due_date           │
         │      │                                            │
         │      ├──→ closedInvoice = Σ residual              │
         │      ├──→ _closedInvoiceValorTotal = Σ total      │
         │      ├──→ _closedInvoiceValorPago = Σ pago        │
         │      │                                            │
         │      ├──→ PAYMENT transactions ← SELECT           │
         │      │     openTransactions ← inclui PAYMENT      │
         │      │     currentInvoice ← filter PAYMENT out    │
         │      │                                            │
         │      ├──→ encargos = calc sobre residual          │
         │      │     currentInvoiceTotal = currentInvoice    │
         │      │       + closedInvoice + encargos            │
         │      │                                            │
         │      └──→ creditCard ← { todos os campos }        │
         └──────────────────────────────────────────────────┘
```

### 13.7 Casos de Borda Tratados

| Situação | Comportamento |
|----------|---------------|
| Nenhuma invoice encontrada | `creditCard.closedInvoice = 0`, sem encargos |
| Todas as invoices pagas | `closedInvoice = 0` com badge PAGA |
| Pagamento parcial | Residual visível, badge informativo |
| Múltiplas faturas não pagas | Soma dos residuais, oldest/more recent |
| Fatura sem data_pagamento mas valor_pago = total | `closedInvoiceIsPaid = false` (inconsistência) |
| daysOverdue = 0 | Sem encargos, status adimplente |
| currentInvoice = 0 (sem compras no ciclo) | Fatura aberta vazia, apenas encargos |

### 13.8 Dependências da Função

```
enrichUserCreditCardData
  ├── computeInvoiceGross(inv)          ← utils/invoiceMath.js  (filtragem)
  ├── computeInvoicePaidInfo(inv)       ← utils/invoiceMath.js  (badge PAGA)
  ├── normalizeUser(userRow)            ← repo (dados básicos)
  ├── usersRepo.findByCpf(cpf)          ← repo (consulta usuário)
  └── databricksService.executeQuery()  ← service (SQL)
```

---

## 14. Pipeline de Transformação de Transações PAYMENT — Do Banco ao Frontend

### 14.1 Visão Geral

> **Pipeline completo de 5 estágios que uma transação `INVOICE_PAYMENT` percorre, desde o INSERT no banco até a renderização no frontend.**

### 14.2 Estágio 1 — INSERT (Backend: POST /cards/invoice/pay)

```javascript
// Descrição diferencia o tipo de pagamento:
const payDescription = payAmount >= minPayment
    ? 'Pagamento minimo de fatura'
    : 'Pagamento parcial de fatura';

// INSERT na tabela transactions:
// type: 'INVOICE_PAYMENT'
// description: payDescription
// amount: NEGATIVO (ex: -3870.86) — representa crédito
```

### 14.3 Estágio 2 — SELECT (Backend: enrichUserCreditCardData Etapa 5)

```sql
SELECT * FROM transactions
WHERE cpf = ? AND type = 'INVOICE_PAYMENT'
ORDER BY date DESC
```

Filtro por janela de 90 dias: apenas transações do ciclo atual ou recente.

### 14.4 Estágio 3 — .map() → Formato Frontend (Backend: enrichUserCreditCardData Etapa 7)

```javascript
// Merchant mapping:
const lowerDesc = (desc || '').toLowerCase();
if (lowerDesc.includes('parcial')) {
    merchant = 'Pagamento fatura (Parcial)';
} else if (lowerDesc.includes('minimo') || lowerDesc.includes('mínimo')) {
    merchant = 'Pagamento fatura (Mínimo)';
} else {
    merchant = 'Pagamento fatura (Total)';
}
```

### 14.5 Estágio 4 — Filtro por Janela de Ciclo

```
Ciclo aberto: due_date ± 30 dias → inclui PAYMENT
Ciclo fechado: dentro das datas da invoice fechada → NÃO inclui PAYMENT
```

### 14.6 Estágio 5 — Renderização no Frontend

```tsx
// Componente InvoiceView.tsx
{openTransactions.map(tx => (
  <div key={tx.id} className="flex items-center gap-3">
    <div className={tx.type === 'PAYMENT' ? 'text-green-500' : 'text-gray-600'}>
      {tx.type === 'PAYMENT' ? '✓' : tx.merchant === 'Anuidade' ? '💳' : '🛒'}
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium">{tx.merchant}</p>
      <p className="text-xs text-gray-500">{formatDate(tx.date)}</p>
    </div>
    <span className={tx.type === 'PAYMENT' ? 'text-green-600 font-semibold' : ''}>
      {tx.type === 'PAYMENT' ? '+R$ ' + Math.abs(tx.amount).toFixed(2) : 'R$ ' + tx.amount.toFixed(2)}
    </span>
  </div>
))}
```

### 14.7 Tabela de Mapeamento Completo (INSERT → Frontend)

| Estágio | Campo | INSERT | SELECT | .map() | Render |
|:--------|:------|:------:|:------:|:------:|:------:|
| 1. INSERT | `type` | `'INVOICE_PAYMENT'` | `'INVOICE_PAYMENT'` | → `'PAYMENT'` | Badge verde |
| 2. Descrição | `description` | `'Pagamento minimo...'` | raw | → `merchant` | Texto visível |
| 3. Amount | `amount` | `-3870.86` | raw | `Math.abs()` | `+R$ 3.870,86` |
| 4. Data | `date` | `NOW()` | raw | formatDate | `28/jul` |

### 14.8 Regras de Consistência do Pipeline

1. INSERT com `amount` NEGATIVO (crédito)
2. SELECT retorna raw — o formato é ajustado no .map()
3. `merchant` mapping: 'parcial' testado ANTES de 'minimo'
4. Amount no frontend: SEMPRE positivo via `Math.abs()`
5. PAYMENT incluso em `openTransactions` na renderização do frontend

---

## 15. Cronograma e Jobs Agendados

### 15.1 Jobs Automáticos

| Job | Frequência | Descrição | Arquivo |
|:----|:-----------|:----------|:--------|
| Invoice Engine | Diário (00:00) | Fecha ciclos, cria faturas | `services/invoiceEngine.js` |
| Billing Validation | Diário (00:05) | Calcula encargos, atualiza status | `index.cjs` (runBillingValidation) |
| Recurring Engine | Diário (00:10) | Cobra assinaturas recorrentes | `services/recurringEngine.js` |
| Sync Dias Atraso | Diário (00:15) | Sincroniza dias_atraso nas invoices | `index.cjs` (syncInvoiceDiasAtraso) |
| Fix Pagamentos Órfãos | Semanal (dom 03:00) | Corrige pagamentos sem invoice correspondente | `index.cjs` (runOrphanPaymentFix) |
| Auditoria Completa | Semanal (dom 02:00) | Double-counting + negative balance | `scripts/audit_completo.js` |

### 15.2 Comandos para Execução Manual

```bash
# Executar runBillingValidation sob demanda (admin)
curl -X POST http://localhost:3001/api/admin/billing/validate-all \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Executar syncInvoiceDiasAtraso via rota admin
curl http://localhost:3001/api/admin/audit-consistency \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Executar auditoria completa
npm run audit:all

# Executar correção de pagamentos órfãos (admin)
curl -X POST http://localhost:3001/api/admin/fix-orphan-payments \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Verificar dados de um CPF específico (admin)
curl http://localhost:3001/api/users/me \
  -H "Authorization: Bearer $TOKEN_DO_USUARIO" | json_pp
```

---

## 16. Troubleshooting — Erros Comuns

> **Seção de resolução de problemas práticos.** Links cruzados com as seções técnicas relevantes do documento.

---

### 16.1 `EADDRINUSE: address already in use 0.0.0.0:3001`

**Causa:** O servidor API anterior não foi encerrado corretamente. O processo do Node ainda está segurando a porta 3001.

**Soluções:**

```bash
# 1. Matar o processo na porta 3001 (Windows - cmd.exe)
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# 2. Ou usar PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process

# 3. Ou no bash (Git Bash):
curl -X POST http://localhost:3001/api/admin/shutdown  # se o servidor responder
```

**Prevenção:** Sempre usar `Ctrl+C` no terminal do servidor antes de reiniciar. Se o terminal foi fechado sem parar o servidor, matar o processo manualmente.

**Seção relacionada:** O servidor é iniciado via `index.cjs` (ver [Seção 10.7](#107-rotas-da-api) para rota de shutdown).

---

### 16.2 `Acesso negado (403)` em rotas admin

**Causa:** Token JWT do admin expirou ou foi perdido (troca de sessão, reinício do servidor).

**Solução:**

```bash
# Obter novo token de admin:
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cpf":"99999999999","password":"admin999"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4
```

**Prevenção:** A cada nova sessão, obter um token fresco. Armazenar em variável de ambiente `$ADMIN_TOKEN` para reuso dentro da sessão.

**Seção relacionada:** Ver [Seção 3.4](#34-tratamento-de-erro) para tratamento de erro no frontend.

---

### 16.3 `Adjacent JSX elements must be wrapped in an enclosing tag` (Vite/Babel)

**Causa:** Bug clássico de template literal em JSX — uma crase + `>` sem `}` antes em uma className.

```tsx
// ❌ ERRADO: backtick + > sem o } da expressão JSX
<div className={`text-${cor}   ← FALTA o } antes de >
>`}  ← Babel interpreta o > como JSX

// ✅ CORRETO:
<div className={`text-${cor} ${ativo ? 'font-bold' : ''}`}>
```

**Solução:** Rodar o lint customizado que detecta este padrão:

```bash
node WEB/scripts/lint-no-missing-jsx-brace.cjs
```

**Prevenção:** Manter className em uma única linha sempre que possível. Configurar o lint como pre-commit hook.

**Seção relacionada:** Ver [Seção 5 (Payload do Frontend)](#5-payload-do-frontend).

---

### 16.4 `Saldo insuficiente` ao pagar fatura

**Causa:** O `balance` do usuário é menor que o valor solicitado para pagamento.

**Verificação:**

```bash
curl -s http://localhost:3001/api/users/me -H "Authorization: Bearer $TOKEN" |
  python -c "import sys,json; u=json.load(sys.stdin)['user']; print(f'Balance: R\$ {u[\"balance\"]}'); print(f'ClosedInvoice: R\$ {u.get(\"creditCard\",{}).get(\"closedInvoice\")}')"
```

**Solução — depositar saldo via admin:**

```bash
curl -s -X POST http://localhost:3001/api/admin/deposit \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cpf":"12312312312","amount":5000}'
```

**Seção relacionada:** Ver [Seção 3.2](#32-fluxo-de-pagamento) para o fluxo completo de pagamento.

---

### 16.5 `valor_pago > valor_total` (double-counting)

**Causa:** Bug no qual o pagamento era registrado em TODAS as faturas (multi-invoice) em vez de distribuído proporcionalmente pela função `planDistribution`.

**Verificação:**

```bash
node API/scripts/audit_completo.js
```

**Solução:**

```bash
node API/scripts/audit_completo.js --fix --confirm
```

**Seção relacionada:** Ver [Seção 2.1](#21-regra-fundamental), [Seção 12.3](#123-regras-de-distribuição) e [Seção 9.1](#91-scripts-de-auditoria).

---

### 16.6 `Fatura fechada mostra valor maior que o pago`

**Causa:** `_closedInvoiceValorTotal` está usando `computeInvoiceGross(inv)` em vez de `inv.valor_total`.

**Verificação:**

```bash
curl -s http://localhost:3001/api/users/me -H "Authorization: Bearer $TOKEN" |
  python -c "import sys,json; u=json.load(sys.stdin)['user']['creditCard']; print(f'ValorTotal: R\$ {u.get(\"_closedInvoiceValorTotal\")}'); print(f'ValorPago: R\$ {u.get(\"_closedInvoiceValorPago\")}')"
```

**Seção relacionada:** Ver [Seção 2.1](#21-regra-fundamental) e [Seção 6.1](#61-fatura-fechada-paga).

---

### 16.7 Erro de Unicode no console Windows (`charmap codec can't encode`)

**Causa:** O terminal Windows (cmd.exe) usa codificação cp1252 que não suporta caracteres Unicode como `→`, `✓`, `⚠️`.

**Solução:**

```bash
chcp 65001  # Muda para UTF-8
```

**Seção relacionada:** Todos os scripts de auditoria ([Seção 9.1](#91-scripts-de-auditoria)) usam cores ANSI.

---

### 16.8 `Porta 3000 já em uso` (frontend Vite)

**Causa:** Outra instância do Vite está rodando (possível de sessão anterior).

**Solução:**

```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
# Ou iniciar em outra porta:
npm run dev -- --port 5173
```

---

### 16.9 `Cannot find module '../repositories/dbAdapter'`

**Causa:** O `cronReconciliation.js` depende de um módulo que foi removido.

**Efeito:** O servidor API inicia normalmente — este erro ocorre apenas no cron de conciliação que é opcional. A API principal funciona sem ele.

**Solução (temporária):** Comentar a linha que importa `cronReconciliation.js` em `index.cjs`.

---

### 16.10 Testes falham com timeout (Vitest no Windows)

**Causa:** O Vitest pode exceder o timeout padrão (5 segundos) no Windows devido a I/O mais lento.

**Solução:**

```bash
npm test -- --testTimeout=30000
```

**Seção relacionada:** Ver [Seção 15.2](#152-comandos-para-execução-manual) para comandos de teste.

---

### 16.11 Python não encontrado (`python3` vs `python`)

**Causa:** No Windows, o comando do Python é `python`, não `python3`.

**Solução:** Usar `python` em vez de `python3` em todos os scripts e comandos.

---

### 16.12 `Ripgrep binary not found`

**Causa:** O ripgrep (`rg`) não está instalado no sistema Windows ou o path não está configurado.

**Solução:**

```bash
npm install -g @microsoft/ripgrep
# Ou configurar variável de ambiente:
set CODEBUFF_RG_PATH=C:\caminho\para\rg.exe
```

---

> ⚠️ **Nota:** Esta seção é compartilhada entre o SKILL.md (versão compacta para agentes) e este documento completo. Ambos devem ser mantidos sincronizados.

---

## 17. Fórmulas de Cálculo — invoiceMath.js (Fonte Única)

> O módulo `API/utils/invoiceMath.js` é a **fonte única** de todas as fórmulas de cálculo de encargos, gross e distribuição de pagamento. Qualquer alteração nas taxas ou fórmulas DEVE ser feita AQUI.

### 17.1 Constantes de Taxa

| Constante | Valor | Descrição |
|:----------|:-----:|:----------|
| `MULTA_RATE` | `0.02` (2%) | Multa fixa por atraso |
| `JUROS_MORA_DAILY` | `0.000333` (0,0333%/dia) | Juros de mora diários |
| `JUROS_REM_DAILY` | `0.00513` (0,513%/dia) | Juros remuneratórios diários |
| `IOF_ADICIONAL_RATE` | `0.0038` (0,38%) | IOF fixo (alíquota única) |
| `IOF_DIARIO_DAILY` | `0.000082` (0,0082%/dia) | IOF diário |

### 17.2 Funções de Cálculo

#### calcMulta(principal)

Calcula multa de 2% sobre o principal.

```javascript
function calcMulta(principal) {
    return round2(principal * 0.02);
}
```

**Exemplo:** `calcMulta(3870.86)` → `round2(3870.86 × 0.02)` → **R$ 77,42**

---

#### calcJurosMora(principal, days)

Calcula juros de mora a 0,0333% ao dia.

```javascript
function calcJurosMora(principal, days) {
    return round2(principal * 0.000333 * days);
}
```

**Exemplo:** `calcJurosMora(3870.86, 18)` → `round2(3870.86 × 0.000333 × 18)` → **R$ 23,20**

---

#### calcJurosRemuneratorios(principal, days)

Calcula juros remuneratórios a 0,513% ao dia.

```javascript
function calcJurosRemuneratorios(principal, days) {
    return round2(principal * 0.00513 * days);
}
```

**Exemplo:** `calcJurosRemuneratorios(3870.86, 18)` → `round2(3870.86 × 0.00513 × 18)` → **R$ 357,44**

---

#### calcIofAdicional(principal)

Calcula IOF adicional fixo de 0,38%.

```javascript
function calcIofAdicional(principal) {
    return round2(principal * 0.0038);
}
```

**Exemplo:** `calcIofAdicional(3870.86)` → `round2(3870.86 × 0.0038)` → **R$ 14,71**

---

#### calcIofDiario(principal, days)

Calcula IOF diário a 0,0082% ao dia.

```javascript
function calcIofDiario(principal, days) {
    return round2(principal * 0.000082 * days);
}
```

**Exemplo:** `calcIofDiario(3870.86, 18)` → `round2(3870.86 × 0.000082 × 18)` → **R$ 5,71**

---

#### calcIof(principal, days)

Calcula IOF total = adicional fixo + diário.

```javascript
function calcIof(principal, days) {
    return round2(calcIofAdicional(principal) + calcIofDiario(principal, days));
}
```

**Exemplo:** `calcIof(3870.86, 18)` → `14.71 + 5.71` → **R$ 20,42**

---

#### calcAllCharges(principal, days)

Calcula TODOS os encargos de uma vez. Retorna objeto com todos os valores.

```javascript
function calcAllCharges(principal, days) {
    const multa = calcMulta(principal);
    const jurosMora = calcJurosMora(principal, days);
    const jurosRemuneratorios = calcJurosRemuneratorios(principal, days);
    const iofAdicional = calcIofAdicional(principal);
    const iofDiario = calcIofDiario(principal, days);
    const iof = calcIof(principal, days);
    const total = round2(multa + jurosMora + jurosRemuneratorios + iof);
    return { multa, jurosMora, jurosRemuneratorios, iofAdicional, iofDiario, iof, total };
}
```

**Exemplo:** `calcAllCharges(3870.86, 18)` →

| Campo | Fórmula | Resultado |
|:------|:--------|:---------:|
| `multa` | `3870.86 × 0.02` | **R$ 77,42** |
| `jurosMora` | `3870.86 × 0.000333 × 18` | **R$ 23,20** |
| `jurosRemuneratorios` | `3870.86 × 0.00513 × 18` | **R$ 357,44** |
| `iofAdicional` | `3870.86 × 0.0038` | **R$ 14,71** |
| `iofDiario` | `3870.86 × 0.000082 × 18` | **R$ 5,71** |
| `iof` | `14.71 + 5.71` | **R$ 20,42** |
| `total` | `77.42 + 23.20 + 357.44 + 20.42` | **R$ 478,48** |

### 17.3 Onde Cada Função é Chamada

| Função | Chamada por | Finalidade |
|:-------|:------------|:-----------|
| `calcMulta` | `enrichUserCreditCardData` | Cálculo de multa para display no frontend |
| `calcMulta` | `runBillingValidation` | Cálculo de multa para persistência em billing_charges |
| `calcMulta` | `BackofficeInvoiceSection` | Cálculo de multa para display no admin (centralizado) |
| `calcJurosMora` | `enrichUserCreditCardData` | Juros de mora para display |
| `calcJurosMora` | `runBillingValidation` | Juros de mora para persistência |
| `calcJurosRemuneratorios` | `enrichUserCreditCardData` | Juros remuneratórios para display |
| `calcJurosRemuneratorios` | `runBillingValidation` | Juros remuneratórios para persistência |
| `calcIofAdicional` | `enrichUserCreditCardData` | IOF fixo para display |
| `calcIofAdicional` | `BackofficeInvoiceSection` | IOF fixo no admin |
| `calcIofDiario` | `enrichUserCreditCardData` | IOF diário para display |
| `calcIofDiario` | `BackofficeInvoiceSection` | IOF diário no admin |
| `calcIof` | `enrichUserCreditCardData` | IOF total (delega para calcIofAdicional + calcIofDiario) |
| `calcAllCharges` | `GET /admin/health/charges` | Auditoria: comparar com billing_charges armazenados |
| `calcAllCharges` | `enrichUserCreditCardData` | Cálculo de encargos de pagamento em atraso (_paidLateCharges) |

### 17.4 Tabela de Valores de Referência

Para `principal = R$ 3.870,86` (valor padrão de fatura das massas de teste):

| Dias | Multa | Juros Mora | Juros Rem | IOF | Total |
|:----:|:----:|:----------:|:---------:|:---:|:-----:|
| 0 | R$ 77,42 | R$ 0,00 | R$ 0,00 | R$ 14,71 | **R$ 92,13** |
| 7 | R$ 77,42 | R$ 9,02 | R$ 139,04 | R$ 16,93 | **R$ 242,41** |
| 13 | R$ 77,42 | R$ 16,76 | R$ 258,15 | R$ 18,84 | **R$ 371,17** |
| 18 | R$ 77,42 | R$ 23,20 | R$ 357,44 | R$ 20,42 | **R$ 478,48** |
| 30 | R$ 77,42 | R$ 38,67 | R$ 595,73 | R$ 24,24 | **R$ 736,06** |
| 60 | R$ 77,42 | R$ 77,35 | R$ 1.191,46 | R$ 33,77 | **R$ 1.380,00** |

### 17.5 Cross-Reference com Regras de Negócio

| Seção neste doc | Funções relacionadas |
|:----------------|:--------------------|
| [Seção 2.2](#22-comparação-computeinvoicegross-vs-computeinvoiceowed) | `computeInvoiceGross`, `computeInvoiceOwed` |
| [Seção 2.3](#23-funções-auxiliares-relacionadas) | `computeInvoicePaidInfo`, `planDistribution` |
| [Seção 4.1](#41-regra-de-incidência) | `calcMulta`, `calcJurosMora`, `calcJurosRemuneratorios`, `calcIof`, `calcAllCharges` |
| [Seção 6.3.2](#632-iof-no-painel-admin--cálculo-para-exibição) | `calcIofAdicional`, `calcIofDiario` |
| [Seção 10](#10-motor-de-validação-diária--runbillingvalidation) | `calcAllCharges` (usado no motor) |
| [Seção 11](#11-função-getclosedinvoicedebt--cálculo-do-saldo-devedor-para-pagamento) | `computeInvoiceOwed`, `planDistribution` |

---

## 18. Cenário de Teste: Pagamento Parcial + Encargos sobre Residual

> **Este cenário documenta o teste completo e validado da massa `61111863709` (Isidore Charles), usado como caso de referência para o comportamento do motor quando há pagamento parcial e residual.**

### 18.1 Visão Geral

```
Fatura:     R$ 3.870,86 (vencimento 10/jul/2026)
Pagamento:  R$ 2.870,86 em 29/jul/2026 (após 19 dias de atraso)
Residual:   R$ 1.000,00
Tipo:       Pagamento MAIOR que o mínimo (74% do total) — NÃO é mínimo formal
```

### 18.2 Dados da Massa (Fonte Única de Verdade)

| Campo | Banco de Dados | API |
|:------|:--------------:|:---:|
| `cpf` | 61111863709 | 61111863709 |
| `nome` | Isidore Charles | Isidore Charles |
| `balance` | R$ 1.129,14 | R$ 1.129,14 |
| `days_overdue` | 20 | 20 |
| `account_status` | inadimplente | inadimplente |

#### Invoice (tabela `fintech.invoices`)

| Campo | Valor |
|:------|:----:|
| `id` | 2aad9391-f08b-4cf7-8ac4-7b24102238ee |
| `status` | FECHADA |
| `due_date` | 2026-07-10T18:00:00.000Z |
| `valor_total` | **R$ 3.870,86** (original imutável) |
| `valor_pago` | **R$ 2.870,86** (pagamento parcial) |
| `data_pagamento` | **null** (ainda não quitou residual) |
| `dias_atraso` | **20** (sincronizado pelo motor) |

#### Billing Charges Acumulados (tabela `fintech.billing_charges`)

| Referência | multa | juros_mora | juros_rem | iof | Dias base |
|:-----------|:----:|:----------:|:---------:|:---:|:---------:|
| **2026-07** (antes do pagto — base R$ 3.870,86) | R$ 77,42 | R$ 20,62 | R$ 317,72 | R$ 19,79 | 16
| **2026-08** (após pagto — base R$ 1.000 residual) | R$ 20,00 | R$ 6,33* | R$ 377,29 | R$ 20,74 | 19-20

> *Nota: Os valores na referência 2026-08 incluem TANTO os encargos acumulados ANTES do pagamento (sobre R$ 3.870,86) quanto os calculados DEPOIS (sobre R$ 1.000). A proteção delta garante que o total nunca seja menor que o já acumulado.

### 18.3 Payload da API (GET /users/me)

| Campo creditCard | Valor | Descrição |
|:-----------------|:----:|:-----------|
| `closedInvoice` | **R$ 3.870,86** | Valor ORIGINAL imutável |
| `closedInvoiceResidual` | **R$ 1.000,00** | Saldo residual (valor pendente) |
| `closedInvoiceTotal` | **R$ 3.870,86** | Badge PAGA (valor original) |
| `currentInvoice` | **R$ 1.229,21** | Compras do ciclo — NÃO inflado |
| `closedInvoiceCharges.multa` | **R$ 20,00** | Recalculado sobre residual × 20 dias |
| `closedInvoiceCharges.jurosMora` | **R$ 6,66** | Recalculado sobre residual × 20 dias |
| `closedInvoiceCharges.jurosRemuneratorios` | **R$ 102,60** | Recalculado sobre residual × 20 dias |
| `closedInvoiceCharges.iof` | **R$ 5,44** | Recalculado sobre residual × 20 dias |
| `closedInvoiceCharges.totalEncargos` | **R$ 134,70** | Soma dos encargos recalculados |
| `currentInvoiceTotal` | **R$ 2.363,91** | = 1.229,21 + 1.000,00 + 134,70 |
| `currentInvoiceMinimo` | **R$ 1.257,62** | = 10% × 1.229,21 + 1.000,00 + 134,70 |
| `daysOverdue` | **20** | Sincronizado pelo motor |
| `closedInvoiceDueDate` | 2026-07-10 | Vencimento original |
| `invoiceDueDate` | 2026-08-10 | Vencimento da fatura aberta |

### 18.4 Transações PAYMENT Visíveis

A transação `INVOICE_PAYMENT` de R$ 2.870,86 aparece em `openTransactions`:

```json
{
  "type": "PAYMENT",
  "amount": 2870.86,
  "merchant": "Pagamento fatura (Parcial)",  ← Fonte: index.cjs linha 427
  "date": "2026-07-29T...",
  "description": "Pagamento de fatura"           ← Campo estendido
}
```

### 18.5 Fórmulas Validadas (Dados Reais)

#### Cálculo dos Encargos sobre o Residual (R$ 1.000, 20 dias)

| Encargo | Fórmula | Resultado | Verificação |
|:--------|:--------|:---------:|:-----------:|
| Multa (2%) | `1000 × 0,02` | **R$ 20,00** | ✅ `calcMulta(1000)=20` |
| Juros Mora (0,0333%/dia) | `1000 × 0,000333 × 20` | **R$ 6,66** | ✅ `calcJurosMora(1000,20)=6.66` |
| Juros Remun. (0,513%/dia) | `1000 × 0,00513 × 20` | **R$ 102,60** | ✅ `calcJurosRem(1000,20)=102.60` |
| IOF Fixo (0,38%) | `1000 × 0,0038` | **R$ 3,80** | ✅ `calcIofAdicional(1000)=3.80` |
| IOF Diário (0,0082%/dia) | `1000 × 0,000082 × 20` | **R$ 1,64** | ✅ `calcIofDiario(1000,20)=1.64` |
| IOF Total | `3,80 + 1,64` | **R$ 5,44** | ✅ `calcIof(1000,20)=5.44` |
| **Total Encargos** | **soma** | **R$ 134,70** | ✅ `calcAllCharges(1000,20).total=134.70` |

#### Composição do `currentInvoiceTotal`

```
R$ 2.363,91 = 1.229,21 (compras) + 1.000,00 (residual) + 134,70 (encargos) ✅
```

### 18.6 Execução do Motor (runBillingValidation) — Resultado Validado

#### Comportamento Após a Execução Manual

| Aspecto | Antes (29/jul, 19d) | Depois (30/jul, 20d) | Variação |
|:--------|:-------------------:|:--------------------:|:--------:|
| `daysOverdue` | 19 | **20** | ✅ +1 dia |
| `closedInvoiceCharges.totalEncargos` | R$ 129,16 | **R$ 134,70** | ✅ +R$ 5,54 |
| `currentInvoiceTotal` | R$ 2.358,37 | **R$ 2.363,91** | ✅ +R$ 5,54 |
| Encargos acumulados no banco | R$ 499,94 | **R$ 499,94** | ✅ preservado (delta=0) |
| Motor gerou novos registros? | — | **NÃO** | ✅ proteção delta ativa |

#### Por que o motor NÃO gerou novos registros na 2ª execução

```
Target (calcAllCharges(1000, 20)):
  multa=20.00, jurosMora=6.66, jurosRem=102.60, iof=5.44  → total R$ 134,70

Já acumulado no banco (SUM billing_charges WHERE 2026-08):
  multa=97.42, jurosMora=30.82, jurosRem=377.29, iof=20.74 → total R$ 526,27

Delta = target - existing:
  multa: 20.00 - 97.42 = -77,42  → 0 (negativo, não insere)
  jurosMora: 6.66 - 30.82 = -24,16 → 0 (negativo, não insere)
  jurosRem: 102.60 - 377.29 = -274,69 → 0 (negativo, não insere)
  iof: 5.44 - 20.74 = -15,30 → 0 (negativo, não insere)
  Total delta: R$ 0,00  ← NADA foi adicionado

Conclusão: A proteção delta funcionou corretamente.
Os encargos acumulados ANTES do pagamento parcial (sobre R$ 3.870,86)
permanecem como penalidade — nunca diminuem, mesmo após residual menor.
```

### 18.7 Regras Verificadas e Validadas por Este Cenário

| # | Regra | Status | Evidência |
|:-:|:------|:------|:----------|
| 1 | `closedInvoice` mostra valor ORIGINAL (R$ 3.870,86), não residual | ✅ | `closedInvoice=3870.86` no payload |
| 2 | `closedInvoiceResidual` mostra R$ 1.000,00 separadamente | ✅ | `closedInvoiceResidual=1000` no payload |
| 3 | `currentInvoice` NÃO é inflado pelo PAYMENT | ✅ | `currentInvoice=1229.21` estável |
| 4 | Encargos são calculados sobre RESIDUAL, não sobre total | ✅ | `calcAllCharges(1000,20)=134.70` |
| 5 | Encargos antigos são PRESERVADOS (nunca deletados) | ✅ | Delta=0, acumulado=526.27 |
| 6 | Proteção delta impede dupla cobrança | ✅ | 2ª execução gerou 0 registros |
| 7 | `currentInvoiceTotal` = compras + residual + encargos | ✅ | 2363.91 = 1229.21 + 1000 + 134.70 |
| 8 | PAYMENT aparece em `openTransactions` | ✅ | type=PAYMENT, amount=2870.86 na lista |
| 9 | `daysOverdue` atualiza a cada execução do motor | ✅ | 19 → 20 (+1 dia) |
| 10 | `closedInvoiceTotal` = valor original (não gross) | ✅ | closedInvoiceTotal=3870.86 |

### 18.8 Como Reproduzir Este Cenário

```bash
# 1. Login como a massa
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"cpf":"61111863709","password":"admin999"}'

# 2. Ver dados ANTES do pagamento (creditCard completo)
curl -s http://localhost:3001/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# 3. Pagamento parcial de R$ 2.870,86
curl -s -X POST http://localhost:3001/api/cards/invoice/pay \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cpf":"61111863709","pin":"1234","amount":2870.86}'

# 4. Ver dados APÓS pagamento
curl -s http://localhost:3001/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# 5. Resumo da fatura aberta
curl -s http://localhost:3001/api/credit/invoices/summary/aberta \
  -H "Authorization: Bearer $TOKEN"

# 6. Executar motor de billing (como admin)
curl -s -X POST http://localhost:3001/api/admin/billing/validate-all \
  -H "Authorization: Bearer $TOKEN_ADMIN"

# 7. Ver dados APÓS o motor rodar
curl -s http://localhost:3001/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

### 18.9 Casos de Borda Cobertos

| Caso | Cenário | Resultado Esperado |
|:-----|:--------|:------------------|
| Pagamento maior que o mínimo | R$ 2.870,86 em R$ 3.870,86 (74%) | ✅ Residual reduzido, encargos preservados |
| Execução repetida do motor | 2 chamadas seguidas ao validate-all | ✅ Delta=0 na segunda, sem duplicatas |
| Residual pequeno | R$ 1.000 em múltiplas execuções | ✅ Encargos nunca diminuem (penalidade fixa) |
| Transação PAYMENT na aberta | Pagamento de R$ 2.870,86 | ✅ Aparece em openTransactions com merchant 'Pagamento fatura (Parcial)' |
| Fatura fechada não paga + residual | data_pagamento = null | ✅ closedInvoiceResidual = R$ 1.000 |
| **Motor NUNCA rodou antes do pagamento** | Pagamento precoce ANTES do primeiro cron | ⚠️ A 1ª execução PÓS pagamento calcula encargos do zero sobre o residual (sem proteção delta, pois não havia nada acumulado). Após isso, a proteção delta entra em ação nas execuções seguintes. |

> 💡 **Dica para testes:** Ao criar uma massa NOVA e pagar antes do primeiro cron, a primeira execução do motor terá `existing = 0` e `target > 0`, então o delta positivo será inserido como novos encargos sobre o residual. A proteção delta só aparece a partir da 2ª execução (quando `existing >= target`).

---

> **Fonte do código:** [`API/index.cjs`](../API/index.cjs) — `runBillingValidation`, `enrichUserCreditCardData` (linhas 427-434 para mapeamento PAYMENT)<br>
> **Massa de teste:** CPF `61111863709` — Isidore Charles<br>
> **Última validação:** 30/jul/2026 — Todas as 10 regras verificadas ✅

---

## 19. Regras de Estopo de Atraso e Crédito Excedente (Saldo Credor)

> **Implementado e validado em 02/ago/2026. Evita regressão na regularização de faturas pagas e acúmulo incorreto de encargos.**

### 19.1 Regra de Estopo de Atraso (Congelamento de Juros)
Quando o cliente realiza o pagamento integral do principal da fatura fechada:
1. O status do usuário é atualizado para `adimplente` e `days_overdue` é zerado no banco.
2. O motor de faturamento (`runBillingValidation`) **para de gerar novos juros diários** (atraso estopou!).
3. Os encargos gerados até a data do pagamento **continuam devidos (`status = 'pending'`)** no banco e aparecem herdados pela fatura aberta. Eles NÃO somem até serem quitados.
4. Os dias de atraso (`daysOverdue`) exibidos no dashboard para a fatura fechada paga em atraso são congelados baseando-se na data do pagamento (`data_pagamento - due_date`), em vez de continuar crescendo indefinidamente.

### 19.2 Quitação de Encargos
Ao pagar a fatura, o teto aceito de pagamento é a soma do principal devido + total de encargos pendentes no banco (`billing_charges` com status `'pending'`).
- O valor pago amortiza primeiro o principal da fatura fechada.
- O valor excedente ao principal é direcionado a pagar os encargos pendentes na tabela `billing_charges`, atualizando o status de `'pending'` para `'paid'` (de forma proporcional).

### 19.3 Crédito Excedente (Saldo Credor)
Se o valor pago for maior que a soma do principal + encargos pendentes:
$$\text{creditoExcedente} = \text{paymentsTotal} - (\text{principalTotal} + \text{chargesTotal})$$
- O excesso entra como crédito na conta do cartão de crédito (saldo credor).
- O `creditoExcedente` abate o valor final da fatura aberta:
  $$\text{currentInvoiceTotal} = \text{comprasDoCiclo} + \text{principalFechadoVencido} + \text{encargosPendentes} - \text{creditoExcedente}$$
- Isso garante que pagamentos a maior reduzam a fatura aberta do cartão.

---

## 20. Regra CREDIT_CARD vs ACCOUNT_DEBIT — Pagamento de Conta Recorrente

> **Regra de negócio do método de pagamento de assinaturas/contas recorrentes.** Vale para os dois fluxos (cobrança automática do `recurringEngine` e pagamento manual da rota `POST /recurring-bills/:cpf/:billId/pay`). Nenhum dos dois métodos polui a fatura do cartão como gasto.

### 20.1 Tabela Comparativa

| Aspecto | `ACCOUNT_DEBIT` (Débito em Conta) | `CREDIT_CARD` (Faturado no Cartão) |
|:--------|:----------------------------------|:-----------------------------------|
| **O que consome** | `users.balance` (saldo da conta corrente) | `users.credit_card_available_limit` (limite do cartão) |
| **Toca o saldo?** | ✅ Sim (decrementa `balance`) | ❌ Não (saldo intacto) |
| **Toca o limite?** | ❌ Não | ✅ Sim (decrementa o limite disponível) |
| **Transação gravada** | `PAYMENT` `-amount` — descrição `Pagamento Recorrente: <nome> (Débito em Conta)` | `PAYMENT` `-amount` — descrição `Pagamento Recorrente: <nome> (Faturado no Cartão)` |
| **Erro sem fundos** | `400 SALDO_INSUFICIENTE` | `400 LIMITE_INSUFICIENTE` |
| **Onde aparece** | Extrato da home (fora da fatura) | Linha **informativa** na fatura aberta (`informative: true`, sem somar no total) |
| **Entra na fatura aberta como gasto?** | ❌ Nunca | ❌ Nunca (só linha informativa — ver §20.3) |

### 20.2 Fluxo Automático (`recurringEngine` — cron 00:10)

A cobrança automática roda no `recurringEngine` e usa tipo `SUBSCRIPTION` na transação (não `PAYMENT`):

```
bill.payment_method || 'CREDIT_CARD'   // default é cartão
├─ ACCOUNT_DEBIT: balance >= amount? → UPDATE users SET balance = balance - amount
│                                      → INSERT transactions (SUBSCRIPTION, -amount)
└─ CREDIT_CARD (default): limite >= amount?
                          → UPDATE users SET credit_card_available_limit = ... - amount
                          → INSERT transactions (SUBSCRIPTION, -amount)
```

- **Falha de cobrança** → `past_due`, `retry_count + 1`, `next_billing_date` +1 dia (política de retentativa diária).
- **Após `max_retries` (3)** → `suspended` com reason `<MOTIVO>_RETENTATIVAS_EXCEDIDAS`.
- **Sucesso** → `active`, `retry_count = 0`, `next_billing_date` +1 mês (MONTHLY) ou +1 ano (ANNUAL).

### 20.3 Pagamento Manual (`POST /recurring-bills/:cpf/:billId/pay`)

Pagamento pontual disparado pelo usuário/admin (botão PAGAR). Diferenças do automático:

1. **Tipo `PAYMENT`** na transação (não `SUBSCRIPTION`) — aparece no extrato no filtro "Pagamentos".
2. **Upsert**: se a conta só existe no localStorage do frontend, a rota a registra no banco com o `billId` do frontend (id estável entre ciclos) — pagar 2x a MESMA conta atualiza a MESMA linha, sem duplicar.
3. **Resposta**: `{ success, message, bill, transactionId, paymentMethod, newBalance }`.
4. **Autorização**: dono da conta ou admin (`403` para outro usuário, `401` sem token).

### 20.4 Exibição no Frontend — Linha Informativa na Fatura Aberta

Um `PAYMENT` `CREDIT_CARD` (descrição contendo `Faturado no Cartão`) **não** é compra: o `cardRows` do `enrichUserCreditCardData` nunca o inclui como gasto. Para o cliente visualizar a assinatura na fatura aberta, o enrich adiciona uma linha com `informative: true`:

- Merchant derivado da descrição: `Pagamento Recorrente: Assinatura Netflix Mensal (Faturado no Cartão)` → **`Assinatura Netflix Mensal`** (fallback `Assinatura faturada no cartão`).
- `type: 'PAYMENT'` + `paymentType: 'TOTAL'` + `informative: true`.
- **NUNCA soma no total**: `currentInvoice`/`currentInvoiceTotal` já excluem `PAYMENT`, e o totalizador do `CurrentInvoice` ignora `informative`.
- O `ACCOUNT_DEBIT` **não** aparece na fatura (nem informativo) — vai só para o extrato da home.

### 20.5 Testes de Referência

- `API/tests/unit/recurringBillPay.test.js` — 14 cenários da rota manual (débito, saldo insuficiente, limite insuficiente, upsert, idempotência, autorização, `CREDIT_CARD` sem tocar saldo).
- `API/services/recurringEngine.js` — fluxo automático com tipo `SUBSCRIPTION` e política de retentativa.

---

> **Fonte do código:** [`API/index.cjs`](../API/index.cjs) — `enrichUserCreditCardData` (linha informativa); [`API/services/recurringEngine.js`](../API/services/recurringEngine.js); [`API/tests/unit/recurringBillPay.test.js`](../API/tests/unit/recurringBillPay.test.js)<br>
> **Regras relacionadas:** §15 (cronograma/jobs), §13 (enrichUserCreditCardData), §14 (pipeline PAYMENT)
---

## 22.10 Tratamento de Anomalias de Rateio (Casos Wade e Alexander)

> **Contexto:** Na auditoria de pagamentos órfãos anteriores à migration 005 (pré-005), foram identificados casos em que a transação de encargos foi gerada com o **valor total da transação original** em vez do **excedente de encargos** (pagamento - principal). Exemplo: Wade (-5.623,68) e Alexander (-5.758,44).

1. **Correção Aplicada:** Transações de encargos de rateio corrigidas via UPDATE transactions sem acionar triggers de faturas fechadas (pois não alteram a tabela invoices).
2. **Regra de Negócio de Encargos Excedentes:**
   - O valor atribuído aos encargos de rateio retroativo deve **SEMPRE** corresponder exatamente a pagamento - principal.
   - Transações de encargos nunca podem ter valor (mount) maior ou igual ao valor da transação original (>= 99%).
   - Transações de encargos criadas pelo rateio retroativo usam a descrição 'Encargos de atraso (rateio retroativo)' e são marcadas com invoice_id NULL intencionalmente, sendo excluídas do pool de futuros rateios.
3. **Guarda Anti-Regressão no Script (ix_orphan_payment_step7.cjs):**
   - **Dry-run:** Reprova e falha com exit != 0 se algum lançamento planejado possuir mount >= 99% da transação original.
   - **Confirmação (--confirm):** Valida antes do INSERT se charge.amount <= originalAmount - totalAlocado. Caso contrário, executa ROLLBACK.
   - **Exclusão de Re-rateio:** O script explicitamente adiciona AND description IS DISTINCT FROM 'Encargos de atraso (rateio retroativo)' na busca do pool de órfãos.
