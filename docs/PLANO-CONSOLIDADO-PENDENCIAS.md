# 📋 Plano Consolidado — Pendências Acumuladas

> **Status:** Ativo (aguardando execução) · **Criado em:** 06/ago/2026
> **Escopo:** Todas as pendências que ficaram para trás nas resoluções do sistema de
> faturas/encargos (auditoria de órfãos pré-005, guarda do rateio retroativo, botão no
> Admin, testes desatualizados pós-migration 005, refactor SRC).
> **Regra de ouro:** nada pode atropelar nada — as fases têm dependências explícitas e a
> ordem de execução é segura contra conflito de merge no `index.cjs`.

---

## 🗺️ Visão Geral das Fases

| Fase | Domínio | Itens | Depende de | Prioridade |
|:-----|:--------|:------|:-----------|:-----------|
| **A** | Backend: guarda do rateio + docs da anomalia | A1, A2 | — | 🔴 Alta |
| **B** | Frontend Admin: botão "Órfãos Pré-005" | B1, B2, B3 | Rota já pronta (`/admin/audit/orphans-pre005`) | 🔴 Alta |
| **C** | Testes: integration desatualizado + falhas de unit | C1, C2 | A (semântica da tx de encargos) | 🟡 Média |
| **D** | Refactor SRC (continuação) | D1 | — | 🟢 Congelada até A/B/C verdes |
| **E** | Validação final (executar em paralelo) | E1–E6 | A + B + C | 🔴 Gate final |

**Ordem de execução:** `A → B → C` (backend e docs primeiro; frontend usa a rota já
pronta; testes por último para validar tudo). A **Fase D fica congelada** até A/B/C
estarem verdes, para não criar conflito de merge no `index.cjs`.

---

## 🔵 FASE A — Backend: guarda do rateio + docs da anomalia

> Sem dependências externas. Backend/script primeiro para o frontend e os testes
> consumirem a semântica correta da tx de encargos.

### A1. Guarda anti-regressão no `fix_orphan_payment_step7.cjs`

**Arquivo:** `API/scripts/fix_orphan_payment_step7.cjs`

**Contexto verificado:** o script **não valida** que `charge.amount` nunca seja o valor
total da tx. A anomalia real (Wade `-5.623,68` e Alexander `-5.758,44`) criou txs de
encargos com o valor TOTAL em vez do excedente (`pagamento − principal`). O health check
(categorias B/C) flagrou 4 achados; foram corrigidos manualmente via `UPDATE
transactions`. Esta guarda impede a regressão.

**Implementação:**

1. **Dry-run reprova valor total:** em `runAll()`, ao imprimir o plano, validar cada
   `plan.charges[]` — se `charge.amount >= 99%` do `originalAmount` da tx (padrão
   "valor total", caso Wade/Alexander), imprimir `❌ REPROVADO` e sair com **exit ≠ 0**
   (não permite `--confirm` com esse padrão).
2. **`--confirm` revalida antes do INSERT:** para cada `c` de `plan.charges`, antes do
   `INSERT`, revalidar `c.amount <= originalAmount − totalAlocado` (excedente real =
   pagamento − principal). Violação → `ROLLBACK` + erro.
3. **Pool de órfãos exclui txs de encargos:** no `queryOrphanPool`, adicionar
   `AND description IS DISTINCT FROM 'Encargos de atraso (rateio retroativo)'` — essas
   txs são órfãs **intencionais** (pré-005, sem invoice de propósito) e nunca podem ser
   re-rateadas em execuções futuras.
4. **Verificação pós-rateio:** alertar se alguma tx órfã nova tiver
   `amount == amount` de uma tx vinculada do mesmo CPF (padrão de duplicação).

**Critério de aceite:** `node --check` OK · dry-run `--all` reprova (exit ≠ 0) se houver
padrão de valor total · `--all --confirm` em massa limpa não quebra · health check = 0.

---

### A2. Documentar a anomalia no REGRAS + SKILL

**Arquivos:** `docs/REGRAS-NEGOCIO-FATURA.md` · `SKILL.md`

**Contexto verificado:** a §22.9 existe (rota `GET /admin/audit/orphans-pre005`) mas
**não** tem a nota do caso Wade/Alexander nem a regra do excedente.

**Implementação:**

1. Nova subseção **§22.10** (ou nota dentro da §22.9) documentando:
   - Caso Wade (`-5.623,68`) e Alexander (`-5.758,44`): txs de encargos criadas com
     **valor total** em vez do excedente (`1.752,82` / `1.887,58`);
   - Correção aplicada: `UPDATE transactions` (sem trigger envolvida — a trigger
     protege `invoices`, e a correção mexe só em `transactions`);
   - **Regra de negócio:** o excedente é sempre `pagamento − principal`; tx de encargos
     nunca pode ter `amount` ≥ valor da tx original;
   - Referência cruzada para a guarda do script (A1).
2. Linha compacta no `SKILL.md` (tabela de imutabilidade/comandos do
   `fix_orphan_payment_step7.cjs`).

**Critério de aceite:** `validate:rules` ✓ · `validate:anchors` ✓ (0 BAD) · SKILL e REGRAS
sincronizados.

---

## 🟢 FASE B — Frontend Admin: botão "Órfãos Pré-005"

> Depende da rota backend, **já pronta e testada** (`GET /admin/audit/orphans-pre005`).

### B1. Função `adminAuditOrphansPre005` na `api.ts`

**Arquivo:** `WEB/services/api.ts`

**Contexto verificado:** **não existe** nenhuma função para a rota orphans-pre005.

**Implementação:** criar no padrão de `adminAuditConsistency` (linha ~1096):

- `GET /admin/audit/orphans-pre005?limit=&cpf=`;
- Tipar retorno: `success`, `cutoff`, `summary { totalUsers, totalPages, totalCovered,
  totalExceeded, totalDeficit, hasMore }`, `results[] { cpf, name, status, delta,
  orphanSum, linkedPaymentsTotal, invoices{valorPagoTotal} }`;
- `try/catch` com `message` em erro (mesmo padrão das outras).

### B2. Botão + handler no `BillingMockSection.tsx`

**Arquivo:** `WEB/components/Admin/BillingMockSection.tsx`

**Contexto verificado:** o arquivo tem 3 botões de auditoria (Consistência, COMPLETA,
Encargos) — **não tem** o de Órfãos.

**Implementação:**

- `handleAuditOrphans` no padrão de `handleAuditConsistency` (import dinâmico da api):
  - `res.success` → `setAuditResult(res)` + toast
    `📊 ${totalCovered} cobertas, ${totalExceeded} excedentes, ${totalDeficit} déficit`;
  - erro → toast de falha.
- Botão "🕳️ Órfãos Pré-005" com `primaryOutlineBtnClass`, junto dos demais, + descrição
  curta ("Rateio retroativo pré-005: cobertura/delta por CPF, read-only").

### B3. Render do resultado no `AuditResultCard.tsx`

**Arquivo:** `WEB/components/Admin/AuditResultCard.tsx`

**Contexto verificado:** o card **não suporta** o formato `orphans-pre005`.

**Implementação:** nova seção condicional (`auditResult.summary?.totalUsers !== undefined
&& auditResult.results`) exibindo:

- Resumo global: `totalUsers` massas · `totalCovered` ✅ · `totalExceeded` ⚠️ ·
  `totalDeficit` 🔴;
- Lista `results[]` (capada a ~10) com `cpf` (formatado), `name`, `status`
  (chip colorido) e `delta` (R$);
- `cutoff` (data da migration 005 usada) como nota.

**Critério de aceite (Fase B):** `npx tsc --noEmit` na WEB ✓ · teste unit do
`BackofficeInvoiceSection`/Admin continua verde · clique no botão no preview mostra o
modal com os dados reais.

---

## 🟡 FASE C — Testes desatualizados pós-migration 005

> Depende da Fase A (semântica da tx de encargos definida e documentada).

### C1. Atualizar `invoicePaymentCompleto.integration.test.js`

**Arquivo:** `API/tests/integration/invoicePaymentCompleto.integration.test.js`

**Contexto verificado:** o teste espera o **contrato pré-migration 005**:

- linha ~97: `txPayment.amount = -5623.68` (valor antigo do seed, sem split);
- linha ~100: `invoiceRow.valor_pago = 3870.86` **gravado na invoice** (a trigger
  bloqueia UPDATE de `valor_pago` em FECHADA — o motor novo deriva quitação de
  `transactions.invoice_id`);
- linha ~114: `closedInvoiceResidual = -1752.82` (com a tx corrigida, o residual muda).

**Implementação:** alinhar o teste ao contrato pós-005:

- Pagamento de 5.623,68 → split: tx vinculada `-3.870,86` (invoice_id) + tx de encargos
  `-1.752,82` (invoice_id NULL);
- Quitação derivada: `valor_pago` da invoice **não é alterado** pela rota de pagamento
  (permanece com o valor legado/seed);
- `data_pagamento` definida; `account_status = 'adimplente'`;
- `closedInvoiceResidual = -1.752,82` (saldo credor = excedente) OU o que o motor
  calcular com a semântica A1 — conferir valor exato antes de fixar o `expect`.

### C2. Avaliar/Corrigir as 3 falhas de unit

**Arquivos:** `API/tests/unit/telegramServiceSend.unit.test.js` ·
`API/tests/unit/subscriptionsEngine.test.js` · `API/tests/unit/auditLog.unit.test.js`

**Contexto verificado (Jest unit: 439/440):**

| Suite | Falha | Classificação |
|:--|:--|:--|
| `auditLog.unit.test.js` | Suite não roda (JWT_SECRET ausente no harness) | **Pré-existente** — corrigir o harness (mock de env) |
| `subscriptionsEngine.test.js` | Retry policy: espera `past_due`, recebe `active` | **Avaliar** — pode ser regressão desta sessão (recurringBillsRepo mudou) |
| `telegramServiceSend.unit.test.js` | Categoria só-Group não tenta tópico do CPF | **Avaliar** — pode ser regressão (telegramService.js é untracked/novo) |

**Implementação:**

- Corrigir harness do `auditLog` (prover `JWT_SECRET` no teste ou mockar o middleware);
- Investigar e corrigir `subscriptionsEngine` (retry policy seta `past_due` no banco? o
  `recurringBillsRepo.update` mapeia status corretamente?);
- Investigar e corrigir `telegramServiceSend` (categoria `system_*` não deve tentar
  tópico do CPF — se o serviço real tenta, é bug real; se o teste está errado, corrigir
  o teste).

**Critério de aceite (Fase C):** Jest unit 440/440 · integration (C1) verde.

---

## 🟣 FASE D — Refactor SRC (CONGELADA até A/B/C verdes)

> **Não executar agora.** Pode conflitar com a Fase A (mesmo arquivo `index.cjs`).

**Contexto verificado:** só `API/src/controllers/invoiceController.js` +
`API/src/routes/invoice.routes.js` foram extraídos (piloto). Restam ~120 rotas por
domínio (auth, cards, admin, pix, shop, recurring) seguindo o plano de extração já
criado.

**Quando destravar:** depois de A/B/C + validação E, em rodada separada, extraindo em
lotes de ~20 rotas por domínio, preservando os 63 endpoints admin e os repositories/
utils existentes.

---

## 🧪 FASE E — Validação final (gate)

> Executar em **paralelo** após A + B + C.

| # | Validação | Comando | Esperado |
|:--|:--|:--|:--|
| E1 | Sintaxe backend | `node --check API/scripts/fix_orphan_payment_step7.cjs && node --check API/index.cjs` | OK |
| E2 | Dry-run do script | `node API/scripts/fix_orphan_payment_step7.cjs --all` | Reprova vazia/limpa (exit 0, sem padrão de valor total) |
| E3 | Docs | `node API/scripts/validate_skill_rules.js` + `node API/scripts/validate_anchors.js` | ✓ ✓ (0 BAD) |
| E4 | Typecheck WEB | `cd WEB && npx tsc --noEmit` | Sem erros |
| E5 | Jest | `node ./node_modules/jest/bin/jest.js --selectProjects unit` + `--selectProjects integration` | 440/440 unit · integration verde |
| E6 | Rota ao vivo | curl `GET /admin/audit/orphans-pre005?cpf=<massa>` + health check oficial | 0 achados · JSON coerente |

---

## ✅ Estado atual (pré-execução, verificado no código)

| Item | Estado |
|:-----|:-------|
| Rota `GET /admin/audit/orphans-pre005` | ✅ **Pronta e testada** (aggregate `SUM(valor_pago)`, filtro cpf, paginação ≤100) |
| Anomalia Wade/Alexander (txs com valor total) | ✅ **Corrigida no banco** (UPDATE transactions, estável 35s+) |
| Health check imutabilidade | ✅ **0 achados** (A=0, B=0, C=0) |
| Fase A1 (guarda no script) | ❌ Pendente |
| Fase A2 (doc §22.10) | ❌ Pendente |
| Fase B (botão no Admin) | ❌ Pendente (api.ts, BillingMockSection, AuditResultCard) |
| Fase C1 (integration desatualizado) | ❌ Pendente |
| Fase C2 (3 falhas de unit) | ❌ Pendente (1 pré-existente confirmada) |
| Fase D (refactor SRC) | 🟢 Congelada |

---

## 🗃️ Arquivos afetados (resumo)

| Arquivo | Fase |
|:--|:--|
| `API/scripts/fix_orphan_payment_step7.cjs` | A1 |
| `docs/REGRAS-NEGOCIO-FATURA.md` | A2 |
| `SKILL.md` | A2 |
| `WEB/services/api.ts` | B1 |
| `WEB/components/Admin/BillingMockSection.tsx` | B2 |
| `WEB/components/Admin/AuditResultCard.tsx` | B3 |
| `API/tests/integration/invoicePaymentCompleto.integration.test.js` | C1 |
| `API/tests/unit/auditLog.unit.test.js` · `subscriptionsEngine.test.js` · `telegramServiceSend.unit.test.js` | C2 |
| `API/src/**` (futuro) | D (congelada) |
