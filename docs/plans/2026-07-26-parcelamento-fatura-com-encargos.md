# Plano: Parcelamento de Fatura com Encargos do Motor

**Data:** 2026-07-26
**Branch:** developer
**Autor:** planejamento assistido

---

## 1. Contexto

O endpoint `POST /cards/invoice/parcel` já existe (`API/index.cjs:4364`) e usa `computeInstallmentPlan()` (`API/utils/billing.js:77`) para amortizar via Tabela Price sobre o `principal` retornado por `getClosedInvoiceDebt()`.

**Problema atual:** o principal ignora os `billing_charges` pendentes gerados diariamente pelo motor de cobrança (`runBillingValidation` em `API/index.cjs:4019`), que acumula `iof + juros_remuneratorios + juros_mora + multa` sobre o saldo residual em atraso. Consequência: parcelar uma fatura em atraso hoje **refinancia menos do que o cliente realmente deve**, e o motor continua gerando encargos diários sobre uma fatura já "quitada" via parcelamento.

**Estado verificado em 26/07/2026 00:18 BRT:**

- Cron `0 0 * * *` (meia-noite **UTC** = 21:00 BRT do dia anterior) rodou 26/07 06:00 UTC (= 03:00 BRT).
- `users.days_overdue` atualizado ✅
- `billing_charges` do dia geradas ✅ (11 e 16 dias de atraso)
- `invoices.dias_atraso` **travou em 15** para 25/26 registros — bug: o UPDATE em `index.cjs:4160-4164` não bate quando `due_date` tem timestamp diferente do armazenado, ou o cast de timestamp perde precisão.
- `invoices.valor_total_com_encargos` **sempre NULL** — coluna existe, motor não escreve.

## 2. Objetivo

Fazer o parcelamento consumir **todos** os encargos pendentes acumulados pelo motor, no mesmo instante em que refinancia, e garantir que:

1. Principal parcelado = fatura fechada + `billing_charges` pendentes.
2. Após o parcelamento, `billing_charges` pendentes da fatura são marcadas como `consolidated` (não `paid`, para preservar auditoria).
3. Motor pára de gerar novos encargos sobre essa fatura (settle já faz isso via `account_status=adimplente` + `data_pagamento` set).
4. O novo plano em `installment_plans` reflete corretamente `principal_original`, `encargos_incorporados`, `iof_parcelamento`, `juros_parcelamento`, `total_financiado`.
5. UI (`WEB/components/InvoiceView.tsx` + `MOBILE/src/components/InvoiceView.tsx`) mostra ao usuário: valor original da fatura, encargos por atraso, IOF do parcelamento, juros do parcelamento, total, valor da parcela, número de parcelas.

## 3. Escopo (o que muda)

### 3.1. Backend

**`API/index.cjs` — `getClosedInvoiceDebt(cpf)` (linha 4288)**

Passar a somar `billing_charges` pendentes ao `gross`:

```js
const pendingCharges = await databricksService.executeQuery(`
  SELECT COALESCE(SUM(amount), 0) AS pending
  FROM ${databricksService.fq('billing_charges')}
  WHERE cpf = ${esc(cpf)}
    AND invoice_reference = ${esc(overdueInvoiceRef)}
    AND status = 'pending'
`);
const encargosPendentes = parseFloat(pendingCharges[0]?.pending || 0);
const gross = principalCampos + encargosPendentes;

return {
  invoice,
  principal: principalCampos,      // valor_total + saldo_anterior + valores gravados na fatura
  encargosPendentes,               // NOVO
  owed: Math.max(0, gross - paid),
};
```

`overdueInvoiceRef` = `${dueDate.getFullYear()}-${String(dueDate.getMonth()+1).padStart(2,'0')}`.

**`POST /cards/invoice/parcel` (linha 4364)**

Depois de `settleClosedInvoices(...)`, marcar as charges como consolidadas:

```js
await databricksService.executeQuery(`
  UPDATE ${databricksService.fq('billing_charges')}
  SET status = 'consolidated', consolidated_at = CURRENT_TIMESTAMP
  WHERE cpf = ${esc(cpf)}
    AND invoice_reference = ${esc(overdueInvoiceRef)}
    AND status = 'pending'
`);
```

Adicionar coluna `consolidated_at` (migração 003 abaixo). Alternativa mínima: reusar `status='paid'` — mas quebra o filtro do motor `WHERE status='pending'` já usado, então serve. **Escolha: `status='consolidated'`** para não confundir com pagamento à vista.

**`POST /cards/invoice/installment-options` (linha 4355)**

Alterar resposta para expor a composição:

```js
res.json({
  success: true,
  amount: closedDebt.owed,
  breakdown: {
    principalFatura: closedDebt.principal,
    encargosPorAtraso: closedDebt.encargosPendentes,
    total: closedDebt.owed,
  },
  options: buildInstallmentOptions(closedDebt.owed),
});
```

**`runBillingValidation` (linha 4019)**

Corrigir o UPDATE de `invoices.dias_atraso` (bug atual — travado em 15):

- Trocar o WHERE por `id = <invoiceId>` (achou a invoice via `closedDueByCpf`, tem o id).
- Também gravar `valor_total_com_encargos = valor_total + saldo_anterior + valor_iof + valor_multa + juros_rem + juros_mora + SUM(billing_charges pending)`.
- Mudar cron para `0 3 * * *` (03:00 BRT = 06:00 UTC → **atenção:** node-cron usa TZ local do processo; se rodar em UTC, `0 3 * * *` = 03:00 UTC = 00:00 BRT-3. Verificar `process.env.TZ` antes de mexer).

### 3.2. Frontend

**`WEB/components/InvoiceView.tsx` + `MOBILE/src/components/InvoiceView.tsx`**

- Onde o modal de parcelamento chama `/cards/invoice/installment-options`, consumir `breakdown` e mostrar as três linhas antes das opções: "Valor da fatura", "Encargos por atraso", "Total a parcelar".
- Em cada opção `nx`, exibir `IOF do parcelamento`, `Juros do parcelamento`, `Valor da parcela`, `Total`.

**`WEB/components/TransactionReceipt.tsx` + `MOBILE/src/components/TransactionReceipt.tsx`**

Após parcelamento bem-sucedido, mostrar comprovante com a composição completa.

### 3.3. Banco de dados

**`API/migrations/003_billing_charges_consolidated.js`** (novo)

```sql
ALTER TABLE fintech.billing_charges
  ADD COLUMN IF NOT EXISTS consolidated_at TIMESTAMPTZ;

-- normalizar status permitidos: 'pending' | 'paid' | 'consolidated'
COMMENT ON COLUMN fintech.billing_charges.status IS
  'pending: encargo aguardando; paid: encargo consolidado em fatura fechada; consolidated: incorporado a parcelamento';
```

## 4. Ordem de execução

1. Migração 003 (`consolidated_at` + comment).
2. `getClosedInvoiceDebt` — somar pending charges. **Test:** unit test em `API/tests/billingEngine.test.js` cobrindo o caso com/sem encargos.
3. `POST /cards/invoice/installment-options` — retornar `breakdown`.
4. `POST /cards/invoice/parcel` — consolidar charges após settle.
5. Corrigir bug do `dias_atraso` travado (WHERE por id) e escrita de `valor_total_com_encargos`.
6. WEB/MOBILE: modal de parcelamento + comprovante.
7. E2E: script `API/scratch_test_parcel_com_encargos.js` que cria fatura fechada + billing_charges, chama options, chama parcel, verifica: invoice `data_pagamento` set, charges `consolidated`, `installment_plans` novo, `users.account_status='adimplente'`.

## 5. Verificações após cada passo

- **Após 2:** `curl /cards/invoice/installment-options` com massa `33333333333` (fatura em atraso 11d + 4 charges pending) — `amount` deve ser ≈ `3870.86 + 218.43 + 77.42 + 18.20 + 14.18 = 4199.09`.
- **Após 4:** `POST /cards/invoice/parcel {installments:6}` — checar `SELECT * FROM billing_charges WHERE cpf='33333333333' AND status='pending'` → deve retornar zero linhas.
- **Após 5:** rodar `POST /admin/billing/validate-all` manualmente — todas as invoices FECHADAs com `dias_atraso` correto e `valor_total_com_encargos` populado.

## 6. Fora do escopo (deixar para depois)

- Parcelar fatura ABERTA (produto ainda não decidiu; hoje só fatura FECHADA).
- Renegociação (desconto de encargos) — separado.
- Mudança do cron para BRT (verificar TZ do processo em produção antes).
- Notificação push do parcelamento (já tem `notificationsRepo.addNotification`; adicionar canal push é outro épico).

## 7. Riscos

- **Duplo-cobrança:** se `settleClosedInvoices` marcar `data_pagamento` mas a consolidação de charges falhar, o motor não gera mais encargos (bom) mas as charges continuam `pending` (ruim para auditoria). **Mitigação:** wrap em transação ou consolidar ANTES de settle e reverter em erro.
- **Refinanciamento com juros compostos:** o novo plano aplica `MONTHLY_INSTALLMENT_RATE = 15,39% a.m.` sobre `principal + encargos`. Encargos já embutem juros → juros sobre juros. **Decisão de produto:** aceitar (padrão do mercado brasileiro pós-Res.4.549/2017) OU aplicar taxa reduzida sobre o componente de encargos. Este plano assume **aceitar** — se produto quiser separar, adicionar `computeInstallmentPlanWithEncargos(principal, encargos, n)`.

## 8. Backlog imediato pós-plano

- [ ] Migração 003
- [ ] `getClosedInvoiceDebt` + unit test
- [ ] `/installment-options` breakdown
- [ ] `/parcel` consolidar charges
- [ ] Fix `dias_atraso` no motor + escrever `valor_total_com_encargos`
- [ ] UI web + mobile
- [ ] E2E scratch script
