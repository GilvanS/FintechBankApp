# Plan-Orchestrate Result

**Plan**: `docs/plans/PLANO-CONSOLIDADO.md`
**Lang**: `typescript`
**ECC mode**: `plugin` (prefixo `ecc` — marketplace instalado como `ecc`, não `everything-claude-code`; agentes confirmados como `ecc:tdd-guide`, `ecc:code-reviewer` etc em `%USERPROFILE%\.claude\plugins\marketplaces\ecc\agents\`)
**Steps**: 10
**Scope**: all

## Steps overview

| # | Título | Tags | Chain |
|---|---|---|---|
| 1 | P0 — Segurança Notion | n/a | — (owner: usuário, fora do escopo de `/orchestrate`) |
| 2 | Fase A — Recorrência `/shop` | impl | `ecc:tdd-guide,ecc:typescript-reviewer` |
| 3 | Fase B — Comprovante rico | impl | `ecc:tdd-guide,ecc:typescript-reviewer` |
| 4 | P2 — Auditoria das 13 regras | db, review | `ecc:database-reviewer,ecc:typescript-reviewer,ecc:code-reviewer` |
| 5 | Fase C — Log Telegram | impl, db | `ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer` |
| 6 | Fase D — Badge vs validador | docs | `ecc:doc-updater` |
| 7 | Gate — Fase E validação | test | `ecc:tdd-guide,ecc:e2e-runner` |
| 8 | Fase 3 — Correções pós-auditoria | impl | `ecc:tdd-guide,ecc:typescript-reviewer` |
| 9 | Fase 4 — Runbook regressão IOF | migration | `ecc:architect,ecc:tdd-guide,ecc:typescript-reviewer` |
| 10 | Fase 5 — Split final de documentação | docs | `ecc:doc-updater` |

---

## Step 1 — P0: Segurança Notion

**Intent**: rotacionar 4 credenciais expostas e apagar blocos no Notion.
**Tags**: n/a
**Chain rationale**: não é trabalho de engenharia neste repositório — nenhum agente do catálogo se aplica. Owner é o usuário.

*(sem comando — executar manualmente)*

---

## Step 2 — Fase A: Recorrência `/shop`

**Intent**: habilitar débito recorrente na Loja do cliente final, hoje exclusivo do painel admin.
**Tags**: impl
**Chain rationale**: implementação full-stack (toggle no front + ramo novo no handler) fechada por `typescript-reviewer`, que cobre TS e JS do catálogo.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-2] Adicionar toggle Débito Recorrente em WEB/components/ShopView.tsx (payload paymentMethod=ACCOUNT_DEBIT, type=SUBSCRIPTION, frequency) e implementar ramo SUBSCRIPTION+ACCOUNT_DEBIT no handler /shop/checkout (API/index.cjs:2319), espelhando o simulador admin (~linha 4610): INSERT recurring_bills + sendPurchaseEvent, sem debitar saldo no cadastro, validando PIN antes; Acceptance: POST /shop/checkout com paymentMethod=ACCOUNT_DEBIT retorna 201 (hoje 400); recurring_bills criado active; payload do toggle contém ACCOUNT_DEBIT/SUBSCRIPTION/frequency"
```

---

## Step 3 — Fase B: Comprovante rico

**Intent**: corrigir rótulo semântico de assinatura no comprovante e exibir campos art. 52 CDC no app.
**Tags**: impl
**Chain rationale**: mesma área de código do Step 2; `typescript-reviewer` fecha o ciclo.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-3] Ajustar rótulo do comprovante para assinaturas: exibir Débito automático em conta em vez de compra à vista em buildPurchaseComprovanteMsg, generatePurchaseReceiptPDF e sendSubscriptionChargeEvent quando tipoPagamento contém Assinatura; renderizar campos art. 52 CDC (juros, taxa efetiva, total c/financiamento) em WEB/components/TransactionReceipt.tsx apenas quando jurosTotal > 0; Acceptance: cobrança Netflix/Plano Premium no tópico mostra Débito automático em conta; compra 13x com juros exibe bloco art.52 no app; compra 6x sem juros não exibe o bloco"
```

---

## Step 4 — P2: Auditoria das 13 regras

**Intent**: classificar cada regra extraída do Notion como bug, simplificação consciente ou lacuna, contra o código real.
**Tags**: db, review
**Chain rationale**: `db` (schema `fintech.users`/`fintech.cards` citado) vence `review` na ordem da tabela e vira primária; `database-reviewer` valida a leitura de schema, `typescript-reviewer`+`code-reviewer` cobrem o código de aplicação.

```bash
/ecc:orchestrate custom "ecc:database-reviewer,ecc:typescript-reviewer,ecc:code-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-4] Auditar as 13 regras de negócio extraídas do Notion (tabela em docs/plans/PLANO-CONSOLIDADO.md) contra o código: regras 1-4 em API/services/invoiceEngine.js e API/repositories/cardRepo.js, regras 5-9 em API/repositories/usersRepo.js e schema fintech.users/fintech.cards, regra 10 (conflito de BIN entre Notion e docs/regras-bins-cartoes-credito.md) e regras 11-13 (fatura fechada, ordenação, câmbio); classificar cada uma; Acceptance: cada uma das 13 regras tem classificação registrada (bug/simplificação/lacuna); conflito de BIN da regra 10 tem decisão documentada; nenhuma alteração de código feita nesta etapa, só classificação"
```

---

## Step 5 — Fase C: Log Telegram

**Intent**: persistir histórico de envios do bot Telegram, hoje só no log efêmero da API.
**Tags**: impl, db
**Chain rationale**: regra de composição `impl+db` → `tdd-guide,database-reviewer,<lang>-reviewer`.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-5] Criar tabela telegram_message_log (id, cpf, topic_id, category, message_type, message_id, ok, error, created_at) e API/repositories/telegramMessageLogRepo.js (add/listByCpf/listRecent); gravar registro em telegramService.send()/sendDocument() apos cada envio (try/catch nao-bloqueante); expor GET /admin/telegram/log?cpf=&category=&limit= com authenticateAdmin; Acceptance: compra na massa gera linha na tabela com topic_id/category/message_id; GET /admin/telegram/log devolve historico mesmo apos restart da API; falha de log nao bloqueia o envio"
```

---

## Step 6 — Fase D: Badge vs validador

**Intent**: alinhar a métrica exibida no badge `rules-coverage.svg` com o gate real de CI (`validate:rules`).
**Tags**: docs
**Chain rationale**: trigger literal é `README`; toca também `generate_badge_svg.js`/`statsUtils.js`, mas nenhum trigger de `impl` casou — `doc-updater` sozinho, fiel ao algoritmo.

```bash
/ecc:orchestrate custom "ecc:doc-updater" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-6] Decidir metrica canonica do badge rules-coverage.svg: opcao recomendada e passar a exibir o score de API/scripts/validate_skill_rules.js (61/92=66%) em vez do pct de cross-references de statsUtils.computeStats(); atualizar generate_badge_svg.js/statsUtils.js e o README conforme a decisao; Acceptance: badge e npm run validate:rules exibem o mesmo numero, ou o badge deixa explicito que e outra metrica; README reflete o significado atual do badge"
```

---

## Step 7 — Gate: Fase E validação

**Intent**: rodar a suíte completa depois de A/B/C/D e revalidar regressão.
**Tags**: test
**Chain rationale**: `test` exime reviewer extra na cauda — `e2e-runner` cobre o force-cycle e a regressão ponta a ponta.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:e2e-runner" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-7] Rodar a suite de validacao apos as fases A/B/C/D: cd API && npm test && npm run validate:rules; cd WEB && npx tsc --noEmit se algum componente foi alterado; forcar cobranca da assinatura Plano Premium Recorrente R$49,90 via POST /admin/subscriptions/engine/force-cycle (cpf=12310012300) e revalidar POST /shop/checkout com paymentMethod=debit; Acceptance: 440+ unit tests e validate:rules passam sem falha; force-cycle debita saldo, gera tx SUBSCRIPTION -49.90 e mensagem+PDF no topico #733, 2a execucao processa 0 (idempotencia); regressao do debito normal no /shop continua OK"
```

---

## Step 8 — Fase 3: Correções pós-auditoria

**Intent**: corrigir só o que o Step 4 classificar como bug.
**Tags**: impl
**Chain rationale**: correção de código = `impl`; `typescript-reviewer` fecha.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-8] Corrigir os itens que a auditoria (Step 4) classificou como bug: candidatos provaveis sao CET ausente na oferta de parcelamento (regra 4), validacao de faixa 01-28 em users.card_due_day (regra 5), BIN fixo em cards.bin (regra 10, apos decisao do conflito) e elegibilidade de parcelamento por adimplencia (regras 2-3); Acceptance: cada bug confirmado pela auditoria tem correcao com teste cobrindo o caso; nenhuma correcao aplicada para itens classificados como simplificacao consciente"
```

---

## Step 9 — Fase 4: Runbook regressão IOF

**Intent**: portar o método de regressão antes/depois de IOF para um runbook reutilizável.
**Tags**: migration
**Chain rationale**: "portar" casa literalmente com o trigger `port` de `migration` → chain padrão `architect,tdd-guide,<lang>-reviewer`.

```bash
/ecc:orchestrate custom "ecc:architect,ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-9] Portar o metodo de regressao antes/depois de IOF (comparacao da aliquota de producao 0,0082 antes e depois de mudanca) para um runbook reutilizavel, usando API/scripts/validate_skill_rules.js como base de validacao automatizada; Acceptance: runbook documentado e executavel reproduz o metodo antes/depois; validate_skill_rules.js cobre a checagem de IOF descrita no runbook"
```

---

## Step 10 — Fase 5: Split final de documentação

**Intent**: separar documentação versionada (fonte da verdade) da versão Notion (leitura externa).
**Tags**: docs

```bash
/ecc:orchestrate custom "ecc:doc-updater" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-10] Separar a documentacao final das regras de negocio em duas trilhas: versao versionada no repositorio (docs/REGRAS-NEGOCIO-FATURA.md como fonte da verdade, atualizada com o resultado da auditoria) e versao do Notion voltada para leitura externa/onboarding; Acceptance: docs/REGRAS-NEGOCIO-FATURA.md reflete o resultado final da auditoria das 13 regras; pagina do Notion esta sincronizada como resumo para leitura externa"
```

---

## Batch execution

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-2] Adicionar toggle Débito Recorrente em WEB/components/ShopView.tsx (payload paymentMethod=ACCOUNT_DEBIT, type=SUBSCRIPTION, frequency) e implementar ramo SUBSCRIPTION+ACCOUNT_DEBIT no handler /shop/checkout (API/index.cjs:2319), espelhando o simulador admin (~linha 4610): INSERT recurring_bills + sendPurchaseEvent, sem debitar saldo no cadastro, validando PIN antes; Acceptance: POST /shop/checkout com paymentMethod=ACCOUNT_DEBIT retorna 201 (hoje 400); recurring_bills criado active; payload do toggle contém ACCOUNT_DEBIT/SUBSCRIPTION/frequency"

/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-3] Ajustar rótulo do comprovante para assinaturas: exibir Débito automático em conta em vez de compra à vista em buildPurchaseComprovanteMsg, generatePurchaseReceiptPDF e sendSubscriptionChargeEvent quando tipoPagamento contém Assinatura; renderizar campos art. 52 CDC (juros, taxa efetiva, total c/financiamento) em WEB/components/TransactionReceipt.tsx apenas quando jurosTotal > 0; Acceptance: cobrança Netflix/Plano Premium no tópico mostra Débito automático em conta; compra 13x com juros exibe bloco art.52 no app; compra 6x sem juros não exibe o bloco"

/ecc:orchestrate custom "ecc:database-reviewer,ecc:typescript-reviewer,ecc:code-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-4] Auditar as 13 regras de negócio extraídas do Notion (tabela em docs/plans/PLANO-CONSOLIDADO.md) contra o código: regras 1-4 em API/services/invoiceEngine.js e API/repositories/cardRepo.js, regras 5-9 em API/repositories/usersRepo.js e schema fintech.users/fintech.cards, regra 10 (conflito de BIN entre Notion e docs/regras-bins-cartoes-credito.md) e regras 11-13 (fatura fechada, ordenação, câmbio); classificar cada uma; Acceptance: cada uma das 13 regras tem classificação registrada (bug/simplificação/lacuna); conflito de BIN da regra 10 tem decisão documentada; nenhuma alteração de código feita nesta etapa, só classificação"

/ecc:orchestrate custom "ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-5] Criar tabela telegram_message_log (id, cpf, topic_id, category, message_type, message_id, ok, error, created_at) e API/repositories/telegramMessageLogRepo.js (add/listByCpf/listRecent); gravar registro em telegramService.send()/sendDocument() apos cada envio (try/catch nao-bloqueante); expor GET /admin/telegram/log?cpf=&category=&limit= com authenticateAdmin; Acceptance: compra na massa gera linha na tabela com topic_id/category/message_id; GET /admin/telegram/log devolve historico mesmo apos restart da API; falha de log nao bloqueia o envio"

/ecc:orchestrate custom "ecc:doc-updater" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-6] Decidir metrica canonica do badge rules-coverage.svg: opcao recomendada e passar a exibir o score de API/scripts/validate_skill_rules.js (61/92=66%) em vez do pct de cross-references de statsUtils.computeStats(); atualizar generate_badge_svg.js/statsUtils.js e o README conforme a decisao; Acceptance: badge e npm run validate:rules exibem o mesmo numero, ou o badge deixa explicito que e outra metrica; README reflete o significado atual do badge"

/ecc:orchestrate custom "ecc:tdd-guide,ecc:e2e-runner" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-7] Rodar a suite de validacao apos as fases A/B/C/D: cd API && npm test && npm run validate:rules; cd WEB && npx tsc --noEmit se algum componente foi alterado; forcar cobranca da assinatura Plano Premium Recorrente R$49,90 via POST /admin/subscriptions/engine/force-cycle (cpf=12310012300) e revalidar POST /shop/checkout com paymentMethod=debit; Acceptance: 440+ unit tests e validate:rules passam sem falha; force-cycle debita saldo, gera tx SUBSCRIPTION -49.90 e mensagem+PDF no topico #733, 2a execucao processa 0 (idempotencia); regressao do debito normal no /shop continua OK"

/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-8] Corrigir os itens que a auditoria (Step 4) classificou como bug: candidatos provaveis sao CET ausente na oferta de parcelamento (regra 4), validacao de faixa 01-28 em users.card_due_day (regra 5), BIN fixo em cards.bin (regra 10, apos decisao do conflito) e elegibilidade de parcelamento por adimplencia (regras 2-3); Acceptance: cada bug confirmado pela auditoria tem correcao com teste cobrindo o caso; nenhuma correcao aplicada para itens classificados como simplificacao consciente"

/ecc:orchestrate custom "ecc:architect,ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-9] Portar o metodo de regressao antes/depois de IOF (comparacao da aliquota de producao 0,0082 antes e depois de mudanca) para um runbook reutilizavel, usando API/scripts/validate_skill_rules.js como base de validacao automatizada; Acceptance: runbook documentado e executavel reproduz o metodo antes/depois; validate_skill_rules.js cobre a checagem de IOF descrita no runbook"

/ecc:orchestrate custom "ecc:doc-updater" "[Plan: docs/plans/PLANO-CONSOLIDADO.md#step-10] Separar a documentacao final das regras de negocio em duas trilhas: versao versionada no repositorio (docs/REGRAS-NEGOCIO-FATURA.md como fonte da verdade, atualizada com o resultado da auditoria) e versao do Notion voltada para leitura externa/onboarding; Acceptance: docs/REGRAS-NEGOCIO-FATURA.md reflete o resultado final da auditoria das 13 regras; pagina do Notion esta sincronizada como resumo para leitura externa"
```
