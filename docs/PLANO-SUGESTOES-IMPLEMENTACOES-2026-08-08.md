# 📋 Plano — Sugestões e Implementações Pendentes (Consolidado 08/ago/2026)

> Consolidado em **08/ago/2026** a partir das sugestões levantadas na conversa.
> Planos anteriores (não duplicados aqui, referenciados):
> - [`PLANO-IMPLEMENTACOES-SUGESTOES.md`](./PLANO-IMPLEMENTACOES-SUGESTOES.md) — Fases 1–6 (PDF universal, boleto/PIX Febraban, datas `toDateOnly`, Telegram/validador, imutabilidade, gate de testes)
> - [`PLANO-CONSOLIDADO-PENDENCIAS.md`](./PLANO-CONSOLIDADO-PENDENCIAS.md) — Fases A–E (rateio órfãos, botão Admin, testes pós-005, refactor SRC)
> - [`PLANO-REFATORACAO-BACKEND.md`](./PLANO-REFATORACAO-BACKEND.md) — refatoração SRC do backend

---

## 🗺️ Visão Geral das Fases

| Fase | Tema | Prioridade | Itens |
|:-----|:-----|:-----------|:------|
| A | Recorrência na Loja `/shop` (cliente final) | 🔥 Alta | A1–A3 |
| B | Comprovante rico: rótulo de assinatura + art. 52 no app | 🔥 Alta | B1–B2 |
| C | Observabilidade: log persistente de envios Telegram | 🟠 Média | C1–C3 |
| D | Alinhar métricas do badge vs validador | 🟡 Baixa | D1–D2 |
| E | Validações pendentes (testes manuais/curl) | 🧪 Gate | E1–E3 |

---

## 🔥 FASE A — Recorrência na Loja `/shop` (cliente final)

> **Contexto (validado em 08/ago/2026):** o toggle "Débito Recorrente" existe apenas no
> painel admin (`CardsManagement.tsx` → `effectiveType='SUBSCRIPTION'` + `paymentMethod='ACCOUNT_DEBIT'` →
> `/admin/acquirer-simulate`). A Loja do cliente final (`ShopView.tsx` → `/shop/checkout`) **não**
> tem o toggle e o handler rejeita `ACCOUNT_DEBIT` com `400 "Metodo de pagamento invalido"`.
> Documentado em [REGRAS §24.6](./REGRAS-NEGOCIO-FATURA.md#246-shopcheckout-não-suporta-recorrência-separação-de-fluxos).

### A1. Toggle "Débito Recorrente" no `ShopView.tsx`
- [ ] Adicionar switch/toggle "Débito Recorrente" (visível só quando `paymentMethod === 'balance'`/débito).
- [ ] Estado local `isRecurringDebit` + campo `frequency` (MONTHLY default).
- [ ] Enviar no payload: `paymentMethod: isRecurringDebit ? 'ACCOUNT_DEBIT' : 'debit'`, `type: isRecurringDebit ? 'SUBSCRIPTION' : undefined`, `frequency`.
- **Critério de aceite:** selecionar produto + débito + toggle → payload contém `ACCOUNT_DEBIT`/`SUBSCRIPTION`/`frequency`.

### A2. Ramo `SUBSCRIPTION + ACCOUNT_DEBIT` no handler `/shop/checkout` (`API/index.cjs:2319`)
- [ ] Espelhar o ramo do simulador (~linha 4610): `INSERT recurring_bills` + `sendPurchaseEvent` (mensagem rica `🔄 Assinatura em débito automático...` + PDF categoria `payment_receipt`), **sem debitar saldo no cadastro**.
- [ ] Validar PIN/cartão antes de cadastrar (mesmo fluxo do débito atual).
- [ ] Retornar `{ success: true, message: 'Assinatura em Débito Automático (Saldo em Conta) cadastrada com sucesso.' }`.
- **Critério de aceite:** `POST /shop/checkout` com `paymentMethod='ACCOUNT_DEBIT'` retorna 201 (hoje 400) e cria `recurring_bills` active.

### A3. Atualizar documentação
- [ ] REVERSO da regra §24.6 do REGRAS e SKILL §19 item 5 (deixar de dizer "recorrência é exclusiva do admin").
- [ ] Registrar no `validate_skill_rules.js` regra de que `/shop/checkout` aceita `ACCOUNT_DEBIT` quando toggle ativo.
- **Critério de aceite:** `npm run validate:rules` com 0 falhas após a mudança.

---

## 🔥 FASE B — Comprovante rico: rótulo de assinatura + art. 52 no app

### B1. Rótulo "compra à vista" → "débito automático" para assinaturas (`buildPurchaseComprovanteMsg`)
> **Contexto:** com `totalParcelas: 1`, a mensagem/PDF da assinatura cai no ramo "à vista" e exibe
> `Juros / encargos R$ 0,00 — compra à vista`, semanticamente errado para débito recorrente.
- [ ] Quando `tipoPagamento` contém "Assinatura" (ou `formaPagamento` = "Débito automático em conta"), renderizar `Débito automático em conta` em vez de `compra à vista`.
- [ ] Aplicar nos 3 lugares: `buildPurchaseComprovanteMsg` (mensagem rica), `generatePurchaseReceiptPDF` (PDF) e `sendSubscriptionChargeEvent`.
- **Critério de aceite:** cobrança Netflix/Plano Premium no tópico mostra "Débito automático em conta", não "compra à vista".

### B2. Campos art. 52 CDC no `TransactionReceipt.tsx` (app)
> **Contexto:** o backend já anexa os 7 campos (`originalAmount`, `jurosTotal`, `interestRate`, `totalParcelado`, `valorParcela`, `taxaEfetivaMensal`, `taxaEfetivaAnual`) às transações via `enrichUserCreditCardData` e o PDF/Telegram já exibem (§20.4 status: **app ⚠️ pendente**). O `TransactionReceipt.tsx` do app ainda não renderiza.
- [ ] Renderizar, quando `jurosTotal > 0`: `Juros R$ X`, `Taxa efetiva (a.m./a.a.)`, `Total s/ financiamento`, `Total c/ financiamento`, `Nx de R$ Y`.
- [ ] Gate: exibir bloco somente se `jurosTotal > 0` (evitar poluir compras à vista/sem juros).
- **Critério de aceite:** compra 13x com juros → comprovante do app mostra o bloco; 6x sem juros → não mostra.

---

## 🟠 FASE C — Observabilidade: log persistente de envios Telegram

> **Contexto:** bots do Telegram **não têm API para ler histórico de tópicos**; a verificação do tópico
> #733 dependia do log da API (que é sobrescrito a cada restart). Não existe tabela de log de envios.

### C1. Tabela `telegram_message_log`
- [ ] `CREATE TABLE telegram_message_log (id, cpf, topic_id, category, message_type ['text'|'document'], message_id, ok, error, created_at)`.
- [ ] Criar `repositories/telegramMessageLogRepo.js` (`add`, `listByCpf`, `listRecent`).

### C2. Gravar em `telegramService.send()` e `sendDocument()`
- [ ] Após resolver cada destino, inserir registro (message_id quando ok; error/reason quando falha).
- [ ] Não bloquear o envio em caso de falha do log (try/catch).

### C3. Rota admin + uso
- [ ] `GET /admin/telegram/log?cpf=&category=&limit=` (authenticateAdmin) para o painel consultar.
- [ ] Atualizar a verificação do tópico: em vez de grep no log efêmero, consultar a tabela.
- **Critério de aceite:** compra na massa → linha na tabela com topic_id, category, message_id; `GET /admin/telegram/log?cpf=...` devolve o histórico mesmo após restart.

---

## 🟡 FASE D — Alinhar métricas do badge vs validador

> **Contexto:** `rules-coverage.svg` mostra **95%** (métrica de cross-references de seções, `statsUtils.computeStats().pct`) enquanto `validate:rules` reporta **66% (61/92)** (checks de keywords por seção). Métricas diferentes — o badge pode confundir.

### D1. Decidir a métrica canônica
- [ ] Opção A (recomendada): badge passa a exibir o **score do `validate_skill_rules.js`** (passaram/total = 61/92 → 66%), que é o gate real de CI.
- [ ] Opção B: manter `pct` de cross-refs, mas renomear o label do badge para `seções c/ ref` (evitar parecer cobertura de regras).
- [ ] Atualizar `generate_badge_svg.js`/`statsUtils.js` conforme a decisão e regenerar `rules-coverage.svg`.

### D2. Atualizar README
- [ ] Ajustar o texto/README se o significado do badge mudar.
- **Critério de aceite:** badge e `validate:rules` exibem o mesmo número (ou o badge deixa claro que é outra métrica).

---

## 🧪 FASE E — Validações pendentes (testes manuais/curl)

### E1. Forçar cobrança da nova assinatura "Plano Premium Recorrente" (R$ 49,90)
- [ ] `POST /admin/subscriptions/engine/force-cycle` com `cpf=12310012300` (a assinatura foi criada no teste do simulador; `next_billing_date` pode precisar ser zerado para vencer).
- [ ] Validar: débito no saldo, tx `SUBSCRIPTION -49.90`, mensagem rica + PDF no tópico #733, idempotência (2ª execução → 0 processadas).

### E2. Revalidar o fluxo completo do `/shop` com débito normal (regressão)
- [ ] `POST /shop/checkout` `paymentMethod='debit'` → compra + comprovante no tópico (já validado 08/ago: R$ 75,00 OK).
- [ ] Repetir após Fases A/B para garantir que nada quebrou.

### E3. Suíte final
- [ ] `cd API && npm test` (440+ unit) e `npm run validate:rules` (0 falhas).
- [ ] `cd WEB && npx tsc --noEmit` se Fase B mexeu em componentes.
- [ ] `node scripts/validate_skill_rules.js` após qualquer edição de SKILL.md/REGRAS.

---

## ✅ Estado atual (verificado no código em 08/ago/2026)

| Item | Status |
|:-----|:-------|
| Documentação §24 (REGRAS) + §19 (SKILL) do fluxo SUBSCRIPTION+ACCOUNT_DEBIT | ✅ FEITO |
| Correção do cron "00:10" → "00:00 (bloco do motor)" nos dois docs | ✅ FEITO |
| `calcEffectiveRates` implementado + 6 testes (bug do 500 em 12x com juros) | ✅ FEITO |
| `onCharge` no `recurringEngine` + evento comprovante no tópico | ✅ FEITO |
| Gate de ciclo (idempotência) no `runEngine` | ✅ FEITO |
| Payload do painel admin validado via `/admin/acquirer-simulate` (SUBSCRIPTION+ACCOUNT_DEBIT) | ✅ FEITO |
| **Toggle "Débito Recorrente" na Loja `/shop` (cliente final)** | ❌ PENDENTE (Fase A) |
| **Rótulo "compra à vista" → "débito automático" para assinaturas** | ❌ PENDENTE (B1) |
| **Campos art. 52 no `TransactionReceipt.tsx` (app)** | ❌ PENDENTE (B2) |
| **Tabela/log persistente de envios Telegram** | ❌ PENDENTE (Fase C) |
| **Badge 95% vs validator 66% (métrica divergente)** | ❌ PENDENTE (Fase D) |
| **Force-cycle da assinatura "Plano Premium Recorrente" R$ 49,90** | ❌ PENDENTE (E1) |

---

## 🗃️ Arquivos afetados (resumo por fase)

| Fase | Arquivos |
|:-----|:---------|
| A | `WEB/components/ShopView.tsx` · `WEB/services/api.ts` (`checkout`) · `API/index.cjs` (`/shop/checkout` ~2319) · `SKILL.md` · `docs/REGRAS-NEGOCIO-FATURA.md` §24.6 · `API/scripts/validate_skill_rules.js` |
| B | `API/index.cjs` (`buildPurchaseComprovanteMsg` ~145 · `sendSubscriptionChargeEvent` ~267) · `API/services/invoicePdfService.js` (`generatePurchaseReceiptPDF`) · `WEB/components/TransactionReceipt.tsx` |
| C | `API/services/telegramService.js` (`send`/`sendDocument`) · `API/repositories/telegramMessageLogRepo.js` (novo) · `API/index.cjs` (rota `/admin/telegram/log`) |
| D | `API/scripts/generate_badge_svg.js` · `API/scripts/statsUtils.js` · `README.md` |
| E | — (testes via curl/API) |
