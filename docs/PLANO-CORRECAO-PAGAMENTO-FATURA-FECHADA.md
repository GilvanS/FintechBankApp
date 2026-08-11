# Plano de Correção — Pagamento gravado na Fatura FECHADA (violação do ciclo de vida)

**Data:** 2026-08-08 · **Massa afetada:** 123.100.123-00 (e qualquer massa que pague fatura após a migration 005)
**Status:** 🔴 CONFIRMADO AINDA ABERTO em 2026-08-11 — este plano nunca foi executado

> **Atualização 2026-08-11:** o usuário reportou o mesmo sintoma numa massa nova
> (125.588.232-80 — Fat 1 mostrando mês errado). Reinvestiguei do zero e cheguei à
> MESMA causa raiz já documentada aqui em 08/08 — confirma que este plano nunca foi
> implementado. Achei também um segundo ofensor que este documento não cobria
> (Ofensor D, abaixo) e um alvo de correção que faltava nos Passos originais
> (`runBillingValidation`, que o Passo 5 só menciona como verificação, não como
> arquivo a corrigir). Ver seção **"8. Complemento 2026-08-11"** no fim do arquivo.

---

## 1. O que o usuário reportou

> "Paguei a fatura atrasada dessa massa 123.100.123-00 e **foi gravado o pagamento na fatura fechada** — foi violado de novo a regra do ciclo de vida."

Regra de negócio (docs/REGRAS-NEGOCIO-FATURA.md):

> **§6.4.1 / §8.1 / §13.5.5:** A transação `INVOICE_PAYMENT` (tipo `PAYMENT`) **DEVE aparecer em `openTransactions` (fatura aberta), NUNCA em `closedTransactions` (fatura fechada).** A fatura fechada é imutável; a quitação é derivada de `transactions.invoice_id`, nunca carimbada na invoice.

---

## 2. Evidências coletadas

### 2.1 Banco — fatura NÃO foi mutada (trigger funcionou ✅)

```sql
-- fintech.invoices WHERE cpf = '12310012300'
b7dd3456 | FECHADA | valor_total=3870.86 | valor_pago=0.00 | data_pagamento=NULL | due Jul/12 | dias_atraso=27 | upd 08/Ago 00:xx
202abb9e | FECHADA | valor_total=720.30 | valor_pago=0.00 | data_pagamento=NULL | due Ago/10 | dias_atraso=0  | upd 03/Ago
```

- `valor_pago = 0.00` e `data_pagamento = NULL` → **a trigger `trg_invoices_immutable_when_closed` está ATIVA** (`tgenabled = O`) e bloqueou a escrita monetária na fatura fechada. ✅
- Ou seja: o "pagamento gravado na fechada" **não** veio de UPDATE na invoice — veio de **leitura/derivação errada no `enrichUserCreditCardData`**.

### 2.2 Banco — pagamentos vinculados às faturas FECHADAS (por design, fonte da verdade pós-005)

```sql
-- fintech.transactions WHERE cpf = '12310012300' AND type = 'INVOICE_PAYMENT'
-3870.86 | invoice_id=b7dd3456 | "Pagamento fatura" | 08/Ago 00:xx   ← Julho (a atrasada)
-720.30  | invoice_id=202abb9e | "Pagamento fatura" | 08/Ago 00:xx   ← Agosto
```

- O `pay()` grava o vínculo `invoice_id` na fatura fechada de propósito — é assim que `getClosedInvoiceDebt` calcula o saldo pago (`fetchPaidByInvoice` = `SUM(INVOICE_PAYMENT) GROUP BY invoice_id`). **Esse vínculo está correto e deve ser mantido.**

### 2.3 Código — o OFENSOR raiz está no `enrichUserCreditCardData` (index.cjs)

**Ofensor A — não usa a fonte de verdade pós-005 para detectar quitação:**

- `unpaidClosed` filtra por `!i.data_pagamento` (linha ~545) e `_closedInvoiceValorPago` lê `valor_pago` do DB (linha 582). Ambos ficam `NULL/0` após a migration 005 porque a trigger impede a escrita. Resultado: **a fatura paga continua sendo considerada "não paga"** no enrich.
- `closedInvoiceIsPaid`/`closedInvoicePaidAt` só são setados no branch `else` (linhas 616-617) via `computeInvoicePaidInfo`, que também lê `data_pagamento`/`valor_pago` — **nunca vira true no fluxo novo**. → Sem badge PAGA, resumo da fechada mostra R$ 0.00 no admin.
- O `getClosedInvoiceDebt` (invoiceController) já resolveu isso com `fetchPaidByInvoice` — **o enrich não foi atualizado com a mesma fonte.**

**Ofensor B — caso especial injeta PAYMENT em `closedTransactions` (viola §6.4.1/§8.1):**

```js
// index.cjs, filtro do closedTransactions (~linha 903-913)
if (txDate <= _prevPrevCloseMs || txDate > _prevCloseMs) {
    // Permitir que transações de pagamento (PAYMENT) feitas após _prevCloseMs entrem
    // no histórico de closedTransactions da fatura fechada que elas pagaram.
    const isPay = tx.type === 'PAYMENT' || tx.type === 'INVOICE_PAYMENT' || tx.type === 'INVOICE_ANTICIPATION';
    if (isPay && txDate > _prevCloseMs && txDate <= maxDueTime) {
        return true;
    }
    ...
}
```

- **Este é o ponto exato que o usuário vê**: o PAYMENT aparece na lista de lançamentos da fatura fechada (`closedTransactions` → `ClosedInvoice.tsx` → seção "Pagamentos desta fatura"). Contradiz diretamente a regra documentada.

**Ofensor C — frontend depende do comportamento errado:**

- `ClosedInvoice.tsx`: `paymentTxs = closedTxs.filter(isPaymentTx)` (linha ~100) e `isInvoicePaid` exige `creditCard.closedInvoiceIsPaid` (linha 67). Com os ofensores A+B, a fechada mostra o pagamento listado mas sem badge PAGA e com valor original exibido como devido.

### 2.4 Schema — sem mudança necessária

- `invoices.valor_pago` / `invoices.data_pagamento` continuam existindo para **legado** (faturas pré-005). O fluxo novo NÃO escreve neles (trigger). ✅
- `transactions.invoice_id` já existe e é o vínculo oficial. ✅

---

## 3. Correção proposta

### Passo 1 — Backend: enrich passa a derivar quitação de `transactions.invoice_id` (fonte única)

**Arquivo:** `API/index.cjs` — `enrichUserCreditCardData`

1. Adicionar consulta espelho de `fetchPaidByInvoice` (SUM de `INVOICE_PAYMENT` por `invoice_id` do CPF).
2. `unpaidClosed` passa a excluir faturas com `pagoPorInvoice >= valor_total` (quitadas de verdade), em vez de usar `!data_pagamento`.
3. `_closedInvoiceValorPago` = Σ pago por `invoice_id` (real), com fallback para `valor_pago` legado quando não houver vínculo.
4. `closedInvoiceIsPaid = true` + `closedInvoicePaidAt` (data da transação de pagamento mais recente) quando **todas** as fechadas em atraso estiverem quitadas.
5. `closedInvoiceResidual` = Σ (valor_total − pago_real), já corrigido.
6. `closedInvoiceCharges` continua lendo `billing_charges` (pendentes) — sem mudança.

> Critério: para 123.100.123-00, o enrich deve produzir `closedInvoiceIsPaid=true`, `closedInvoicePaidAt=2026-08-08`, `_closedInvoiceValorPago=4591.16`, `closedInvoiceResidual=0`.

### Passo 2 — Backend: remover o caso especial que injeta PAYMENT em `closedTransactions`

**Arquivo:** `API/index.cjs` — filtro do `closedTransactions`

- Remover o bloco `isPay && txDate > _prevCloseMs ... return true` (Ofensor B).
- PAYMENT passa a aparecer SOMENTE em `openTransactions` (regra §6.4.1/§8.1).
- Verificar que `currentInvoice` continua filtrando PAYMENT (já filtra) e que `paymentHistory` segue agregando os INVOICE_PAYMENT (já agrega).

> Critério: `closedTransactions` de 123.100.123-00 não contém nenhuma transação PAYMENT.

### Passo 3 — Frontend: badge PAGA + seção de pagamentos da fechada

**Arquivo:** `WEB/components/ClosedInvoice.tsx`

- `isInvoicePaid` passa a funcionar com o `closedInvoiceIsPaid` real (Passo 1) — badge verde ✓ PAGA + valor original `_closedInvoiceValorTotal`.
- A seção "Pagamentos desta fatura" (`paymentTxs`) deixa de ler de `closedTransactions` (que não terá mais PAYMENT) e passa a ler de `creditCard.paymentHistory` (campo agregado dedicado do backend) filtrado pelo escopo da fechada — mantém o informativo sem violar a regra.

**Arquivo:** `WEB/components/Admin.tsx` / `Admin/BackofficeInvoiceSection.tsx`

- Já leem `card.closedInvoiceIsPaid` e `card._closedInvoiceValorPago` (linhas 3334-3335) — passam a funcionar com o Passo 1. Sem mudança de código necessária (só validação visual).

### Passo 4 — Documentar no SKILL.md e REGRAS-NEGOCIO-FATURA.md

- Nova regra: **"Quitação pós-migration-005 é derivada de `transactions.invoice_id` (`SUM INVOICE_PAYMENT`), NUNCA de `valor_pago`/`data_pagamento` da invoice (imutável pela trigger). O `enrichUserCreditCardData` DEVE usar a mesma fonte do `getClosedInvoiceDebt`."**
- Reforçar §6.4.1: PAYMENT exclusivamente em `openTransactions`.
- Atualizar tabela de campos (§13.4): `closedInvoiceIsPaid` = derivado de transactions, não de `data_pagamento`.

### Passo 5 — Testes

1. **Unit (backend):** novo teste em `API/tests/unit/` validando o enrich com fatura paga via `invoice_id` (sem `data_pagamento`) → `closedInvoiceIsPaid=true`, PAYMENT fora de `closedTransactions`.
2. **Regressão:** rodar suíte da API (`npm test` no API) — foco em `validateDoubleChargeFix`, `invoiceMath.unit`, `subscriptionsEngine`.
3. **Integração (massa 123.100.123-00):** login → `GET /api/users/me` → conferir `creditCard`:
   - `closedInvoiceIsPaid: true`, `closedInvoicePaidAt: 2026-08-08`
   - `_closedInvoiceValorPago: 4591.16`, `closedInvoiceResidual: 0`
   - `closedTransactions` sem PAYMENT; `openTransactions` com os 2 PAYMENT
4. **Painel admin (preview):** fatura fechada exibe valor original + badge PAGA; fatura aberta mostra herança/encargos corretos.
5. **Re-rodar `runBillingValidation`** (`POST /admin/billing/validate-all`) para confirmar que os encargos sobre o residual (0,00) não geram divergência.

---

## 4. O que NÃO muda (para não quebrar nada)

| Item | Decisão | Motivo |
|------|---------|--------|
| Trigger `trg_invoices_immutable_when_closed` | **Mantém ativa** | É a trava do ciclo de vida |
| `pay()` gravar `invoice_id` na fatura fechada | **Mantém** | É a fonte de verdade do saldo pago (`getClosedInvoiceDebt`) |
| `valor_pago`/`data_pagamento` legados | **Mantém** | Faturas pré-005 dependem deles |
| `billing_charges` como fonte dos encargos | **Mantém** | Encargos são herdados pela fatura aberta |
| Payload do frontend (Dashboard/ClosedInvoice) | **Mantém** | Só os valores que chegam passam a vir corretos |

---

## 5. Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `API/index.cjs` | Corrigir `enrichUserCreditCardData` (Passos 1 e 2) |
| `WEB/components/ClosedInvoice.tsx` | Ajustar `paymentTxs` para `paymentHistory` (Passo 3) |
| `docs/REGRAS-NEGOCIO-FATURA.md` | §13.4 + nova regra de quitação pós-005 (Passo 4) |
| `SKILL.md` | Versão compacta (Passo 4) |
| `API/tests/unit/enrichPaidByInvoice.test.js` | Novo teste (Passo 5) |

---

## 6. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Mudar `unpaidClosed` quebra legado pré-005 | Fallback: se não houver `invoice_id` vinculado, usa `valor_pago` (híbrido, igual ao `getClosedInvoiceDebt`) |
| PAYMENT some da tela do usuário | `paymentHistory` + `openTransactions` continuam exibindo; seção da fechada lê `paymentHistory` |
| Encargos herdados divergem | Fonte continua `billing_charges` (não recalcula) — sem mudança |
| Testes de snapshot do ClosedInvoice quebram | Atualizar snapshots junto com o Passo 3 |

---

## 7. Validação final do usuário (checklist)

- [ ] Massa 123.100.123-00: fatura fechada mostra valor ORIGINAL + badge **PAGA** (não R$ 0.00)
- [ ] Nenhum PAYMENT aparece na lista de lançamentos da fatura fechada
- [ ] O pagamento aparece na fatura ABERTA (`openTransactions`)
- [ ] Resumo do admin (Legado/Gerenciar Cliente) consistente com a tela do cliente
- [ ] `GET /api/users/me` retorna `closedInvoiceIsPaid=true`, `closedInvoicePaidAt=2026-08-08`

---

## 8. Complemento 2026-08-11 — por que o motor diário nunca soube da quitação

Este plano (Passo 1) corrige `enrichUserCreditCardData` — o caminho de **leitura** usado
pelo app e pelo admin. Mas existe um **terceiro** consumidor de "esta fatura está paga?"
que este documento não lista como alvo de correção: o motor que gera cobrança todo dia.

### Ofensor D — `runBillingValidation` nunca soube do modelo pós-005

**Arquivo:** `API/index.cjs`, função `runBillingValidation` (a mesma que já recebeu uma
correção parcial em `2ab86fdf`, sobre qual fatura escolher — não sobre se ela está paga).

```sql
SELECT cpf, due_date, valor_total, valor_pago FROM invoices
WHERE status = 'FECHADA' AND data_pagamento IS NULL
```

Zero conhecimento de `transactions.invoice_id`. Mesmo com o Passo 1 deste plano
corrigindo o enrich, **o motor diário continua gerando multa/juros/IOF sobre faturas já
quitadas**, porque lê os mesmos dois campos legados (`valor_pago`, `data_pagamento`) que
a trigger da migration 005 mantém travados em zero/null por design.

Prova, CPF 125.588.232-80 (2026-08-11): pagamento de R$5.286,06 vinculado por
`invoice_id` cobrindo a fatura de R$3.870,86 — `SUM` pela lógica correta já daria a
fatura como quitada — mas `account_status` continua `inadimplente`, `days_overdue`
continua subindo. Mesmo padrão do Ofensor A, em arquivo diferente.

### Ofensor E — pagamento TOTAL não vincula `invoice_id` (o Passo 2.2 deste plano assumia que sim)

A seção 2.2 original diz *"O `pay()` grava o vínculo `invoice_id` na fatura fechada de
propósito... Esse vínculo está correto e deve ser mantido."* — verdade só para
**pagamento parcial**. Existem dois caminhos:

| Pagamento | Arquivo | Vincula `invoice_id`? |
|---|---|---|
| Parcial/mínimo | `API/src/controllers/invoiceController.js:634-636` | ✅ sim |
| **Total** | `API/repositories/cardRepo.js:26-55` (`payDueInstallments`) | ❌ não — recebe `invoiceId` do chamador e descarta na desestruturação; o `INSERT` nem tem a coluna |

Isso significa: pagamentos **totais** novos (a partir de hoje, se nada mudar) continuam
gerando registro órfão, mesmo depois do Passo 1 deste plano corrigir a leitura — porque
a escrita para esse caminho específico nunca vinculou o dado que a leitura corrigida
vai procurar.

### Ação adicional aos Passos 1-5 originais

- [ ] **Passo 1-bis:** aplicar a MESMA correção do Passo 1 (derivar quitação de
      `transactions.invoice_id`, com fallback para `valor_pago` legado) em
      `runBillingValidation` (`index.cjs`) — não só em `enrichUserCreditCardData`.
      Recomendado extrair a lógica de "SUM pago por invoice_id" para uma função
      compartilhada entre os dois lugares, para não repetir o erro de duas fontes
      divergentes uma terceira vez.
- [ ] **Passo 2-bis:** `cardRepo.payDueInstallments` — aceitar `invoiceId` na
      assinatura e incluir `invoice_id` no `INSERT INTO transactions`, igual ao
      caminho parcial já faz.
- [ ] Teste: fatura com pagamento TOTAL vinculado por `invoice_id` não deve gerar
      encargo nem manter `inadimplente` no próximo ciclo do motor.
- [ ] Auditar CPFs com pagamento vinculado mas `account_status` ainda `inadimplente`
      (sintoma direto do Ofensor D) — devem se corrigir sozinhos assim que o
      Passo 1-bis rodar; não precisam de reparo manual de dado se o código for
      corrigido primeiro.

### Ordem de execução revisada

```
1. Passo 1 (enrich) + Passo 1-bis (runBillingValidation) — mesma correção, dois lugares
2. Passo 2 (remover PAYMENT de closedTransactions) + Passo 2-bis (vincular invoice_id no pagamento total)
3. Passo 3 (frontend) e Passo 4 (docs) — sem mudança de escopo
4. Passo 5 (testes) — incluir o caso do Passo 1-bis e 2-bis
5. Auditar os CPFs já órfãos (não corrigir dado às cegas — confirmar reconciliação primeiro)
```
