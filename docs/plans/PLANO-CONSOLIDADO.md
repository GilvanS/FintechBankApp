# Plano Consolidado — Regras de Negócio + Implementações Pendentes

**Data:** 2026-08-07 · **Auditado contra o código:** 2026-08-08
**Fontes:** [`PLANO-SUGESTOES-IMPLEMENTACOES-2026-08-08.md`](../PLANO-SUGESTOES-IMPLEMENTACOES-2026-08-08.md) (Fases A–E) + [`plans/planoNotion.md`](./planoNotion.md) (Fases 0–6)
**Status:** consolidação finalizada; extração do Notion **encerrada** (Fase 6 lida, 0 regras novas, 4 achados de segurança)

> **Auditoria de 2026-08-08:** a versão anterior deste plano foi escrita a partir do
> `PLANO-SUGESTOES-IMPLEMENTACOES-2026-08-08.md` **sem conferir o código**. A verificação
> mostrou que a Fase A já estava pronta, que a regra 5 já é cumprida, e que **todos os
> caminhos de arquivo estavam desatualizados** — o backend foi modularizado de
> `API/index.cjs` para `API/src/routes/*.js` (commit `d4a62093`).

## Grounding no código (verificado em 2026-08-08)

| Categoria | Fonte | Padrão |
|---|---|---|
| Rotas | `API/src/routes/*.routes.js` | **modularizado** — `shop.routes.js`, `cards.routes.js`. `index.cjs` ainda tem rotas admin |
| Validação de entrada | `API/src/routes/cards.routes.js:122-124` | `express-validator`: `body('x').isInt({min,max})` + `handleValidationErrors` |
| Repositório | `API/repositories/*.js` | `cardRepo.js`, `usersRepo.js` — funções nomeadas, query via `dbService` |
| Regras versionadas | `docs/REGRAS-NEGOCIO-FATURA.md` (2141 linhas) | fonte da verdade atual; `SKILL.md` referencia por seção |
| Validação de regra | `API/scripts/validate_skill_rules.js` | gate de CI, `npm run validate:rules` |
| Testes | `API/tests/unit`, `API/tests/integration` | Jest, 440+ unit |

## Placar real

| Item | Plano dizia | Verificado no código | Estado |
|---|---|---|---|
| Fase A — Recorrência `/shop` | ❌ pendente | toggle + handler existem | ✅ **FEITA** |
| Fase B1 — rótulo assinatura | ❌ pendente | feito na rota, falta no PDF | 🟡 **PARCIAL** |
| Fase B2 — art. 52 no app | ❌ pendente | zero ocorrências no WEB | ❌ pendente |
| Fase C — log Telegram | ❌ pendente | zero ocorrências | ❌ pendente |
| Fase D — badge vs validador | ❌ pendente | ainda usa `computeStats()` | ❌ pendente |
| Regra 5 — vencimento 01–28 | bug provável | `isInt({min:1,max:28})` | ✅ **CUMPRIDA** |
| Fase 6 — resto do Notion | pendente | lida 2026-08-07 | ✅ **FEITA** (0 regras novas) |
| Botões PDF/Resumo Telegram | não estava no plano | restaurado do stash de sexta | ✅ **FEITO** hoje |
| **Ciclo de vida da fatura** | não estava no plano | 39 de 54 massas sem encargos | 🔴 **P0 ABERTO** — [plano próprio](./PLANO-CICLO-VIDA-FATURA.md) |

## Ordem consolidada

```
P0  Segurança Notion — 4 achados, owner: usuário       — hoje, não bloqueia nada
P0  Ciclo de vida da fatura — 6 defeitos, 3 deles P0   — ver PLANO-CICLO-VIDA-FATURA.md
P1  Fase B (resto) — PDF + art. 52 no app              — único P1 que sobrou
P2  Fase 1+2 (Notion) — Reconciliar + auditar 13 regras
P2  Resolver conflito de BIN (regra 10 × regras-bins-cartoes-credito.md)
P3  Fase C — Log persistente Telegram
P3  Fase D — Métrica badge vs validador
GATE Fase E — Suíte de validação (após cada bloco)
P4  Fase 3 — Correções pós-auditoria
P4  Fase 4 — Runbook regressão IOF
P5  Fase 5 — Split final de documentação
```

Fase A e Fase 6 saíram da fila — já executadas.

## P0 — Segurança (owner: usuário, 4 achados)

| Página no Notion | Exposição | Risco |
|---|---|---|
| `KNOWLEDGE BASE` | 2 pares e-mail+senha corporativo | credencial de terceiros ativa |
| `Transação Internacional` | PAN completo, CPF, senha de cartão, e-mail nomeado | **PCI-DSS + LGPD** |
| `Cartões recebidos embossadoras` (database) | inventário real: número de cartão, CVV, senha por linha | **PCI-DSS** — dado vivo, não regra |
| `AUTOMAÇÃO` | 2 pares e-mail+senha corporativo (Jira/Slack) | credencial de terceiros ativa |

- [ ] Rotacionar as 4 senhas expostas
- [ ] Apagar os blocos (histórico de versão do Notion guarda)
- [ ] Avisar segurança das empresas envolvidas se ativo
- [ ] Revisar acesso ao workspace

## ✅ Fase A — Recorrência `/shop` (CONCLUÍDA)

Verificado em 2026-08-08, nada a fazer:

- [x] A1 toggle "Débito Recorrente (Mensal)" — `WEB/components/ShopView.tsx:231-243`, payload em `:66-68`
- [x] A2 ramo `SUBSCRIPTION+ACCOUNT_DEBIT` — `API/src/routes/shop.routes.js:226`, `INSERT recurring_bills` em `:251`
- [ ] A3 atualizar `REGRAS §24.6` e `SKILL §19` — a doc ainda diz que recorrência é exclusiva do admin

## P1 — Fase B: Comprovante rico (o que sobrou)

- [x] B1 rótulo na rota — `API/src/routes/shop.routes.js:260` já usa `formaPagamento: 'Débito automático em conta'`
- [ ] **B1 residual** — `API/services/invoicePdfService.js:820` ainda tem `'R$ 0,00 — compra à vista'` hardcoded. O PDF sai com rótulo errado para assinatura
- [ ] B2 campos art. 52 CDC em `WEB/components/TransactionReceipt.tsx`, gate `jurosTotal > 0`
- **Validar:** compra 13x c/ juros mostra bloco; 6x sem juros não mostra; PDF de assinatura não diz "compra à vista"

## P2 — Auditoria das 13 regras

- [ ] Ler `REGRAS-NEGOCIO-FATURA.md`, mapear quais das 13 já constam
- [ ] Auditar regras 1–4 em `invoiceEngine.js`/`cardRepo.js` — **regra 4 (CET) indefinida**: o termo aparece em 36 arquivos, mas quase tudo é `coverage/`, `scratch_*` e massas JSON. Precisa de leitura, não grep
- [x] **Regra 5 — CUMPRIDA**: `API/src/routes/cards.routes.js:123` valida `isInt({ min: 1, max: 28 })`
- [ ] Auditar regras 6–9 em `usersRepo.js`, schema `users`/`cards`
- [ ] Resolver conflito regra 10 (BIN 6 dígitos Notion × whitelist 8 dígitos do repo) antes de mexer em código de BIN
- [ ] Auditar regras 11–13 (fatura fechada, ordenação, câmbio)

As 13 regras são o teto — Fase 6 confirmou que o Notion não tem mais nenhuma.

## P3 — Fase C: Log Telegram

Confirmado inexistente: zero ocorrências de `telegram_message_log` ou `telegramMessageLogRepo` no `API/`.

- [ ] `CREATE TABLE telegram_message_log` + `API/repositories/telegramMessageLogRepo.js`
- [ ] Gravar em `telegramService.send()`/`sendDocument()`, try/catch não-bloqueante
- [ ] `GET /admin/telegram/log`

## P3 — Fase D: Badge vs validador

Confirmado pendente: `API/scripts/generate_badge_svg.js:14,24` ainda importa e usa `computeStats()` de `statsUtils`.

- [ ] Decidir métrica canônica (recomendado: score do `validate_skill_rules.js`)
- [ ] Atualizar `generate_badge_svg.js`/`statsUtils.js`/README

## GATE — Fase E (após cada P1/P2/P3)

- [ ] `cd API && npm test && npm run validate:rules`
- [ ] `cd WEB && npx tsc --noEmit` — **atenção:** o baseline atual já tem **77 erros pré-existentes** (`LimitView`, `Dashboard`, `HomeView`, `CardsView`, `RequestsManagement`). Comparar contra esse número, não contra zero
- [ ] Force-cycle assinatura R$ 49,90 + regressão `/shop` débito normal

## Fora de plano — feito hoje (2026-08-08)

Botões "Enviar p/ Telegram" e "Enviar PDF p/ Telegram" no Gerenciar Cliente, recuperados
do `stash@{0}` de sexta 07/08 20:18 (perdidos por `git stash` sem `-u`, que não captura
arquivos novos não rastreados).

- `WEB/components/Admin/BackofficeInvoiceSection.tsx` — 2 botões usando `searchedUser.cpf` + `selectedBackofficeInvoice`
- `WEB/services/api.ts` — `adminTelegramSendPdf` aceita `'previous'`; `adminTelegramSendTable` envia `{title, headers, rows}` (antes mandava só `title` e o backend devolvia 400)
- `WEB/components/Admin/TelegramManagement.tsx` — call site ajustado à assinatura nova

Ainda **sem validação visual** — não foi testado no navegador.

## P4/P5 — Correção, runbook IOF, split final

Mantidos como em `planoNotion.md`, sem mudança de escopo.

## Riscos

| Risco | Chance | Mitigação |
|---|---|---|
| Planos citarem caminhos de `index.cjs` já modularizados | **Alta** | conferir `API/src/routes/` antes de editar qualquer rota |
| Conflito de BIN vira retrabalho se decidido errado | Média | task dedicada, não decidir dentro de outra |
| Marcar item como pendente sem conferir o código | **Alta** | esta auditoria; repetir antes de cada fase |
| Fase B sem regressão quebra `/shop` débito normal | Baixa | E2 no gate cobre isso |

## Aceite

- [ ] P0 confirmado pelo usuário
- [ ] P1 (Fase B restante) codado e testado
- [ ] P2 com cada uma das 13 regras classificada
- [ ] Gate E sem erros novos acima do baseline de 77
