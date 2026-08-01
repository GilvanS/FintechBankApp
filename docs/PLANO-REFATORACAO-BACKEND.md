# Plano de Refatoração do Backend — Estrutura SRC

> **Status**: Planejamento em execução · **Última atualização**: 31/jul/2026
> **Documentos relacionados**: `docs/REGRAS-NEGOCIO-FATURA.md` (regras do motor), `API/README-backend.md`, `SKILL.md`

---

## 1. Objetivo

Transformar o `API/index.cjs` (god file de **6.943 linhas**, 116 definições de rota no arquivo — 114 single-path + 2 alias em array — + 11 já extraídas) em uma estrutura em camadas sob `API/src/`, **sem alterar nenhum comportamento das 127 rotas** e **sem tocar na lógica dos `repositories/` e `utils/` existentes** (fonte de verdade das regras de negócio já testadas).

### 1.1 Estrutura-alvo

```
API/
├── src/
│   ├── config/            ← config/env centralizada (PORT, JWT_SECRET, DB_PROVIDER, scheduler, bootstrap)
│   ├── controllers/       ← 1 arquivo por domínio (handlers com DI)
│   ├── models/            ← schemas/validação de payload (express-validator)
│   ├── routes/            ← 1 arquivo por domínio (registro de rotas)
│   ├── services/          ← serviços de domínio (extraídos do index.cjs)
│   └── utils/             ← helpers puros compartilhados
├── repositories/          ← ✅ PRESERVADO (acesso a dados, sem mudança)
├── utils/                 ← ✅ PRESERVADO (invoiceMath, billing, cardEngine...)
├── services/              ← ✅ PRESERVADO (invoiceEngine, recurringEngine, database/)
├── middlewares/           ← ✅ PRESERVADO (auth.js)
├── migrations/            ← ✅ PRESERVADO
├── tests/
│   ├── unit/              ← ✅ FEITO (15 suítes)
│   └── integration/       ← ✅ FEITO (3 suítes)
├── index.cjs              ← entry-point FINO: bootstrap + listen (após refatoração)
└── jest.config.js         ← ✅ FEITO (projects unit/integration)
```

### 1.2 Princípios não-negociáveis

1. **Compatibilidade total das 127 rotas** — método, path, middlewares e ordem de registro idênticos.
2. **Zero mudança de lógica** — extração é *verbatim*; refatoração de comportamento fica para depois.
3. **`repositories/` e `utils/` intocados** — a extração apenas os *importa* de onde já estão.
4. **DI por factory** — padrão já validado no piloto (invoiceController): o `index.cjs` injeta dependências, o controller só consome.
5. **Cada fase termina verde** — 429 testes passando + `node -c` + smoke de rotas do domínio.
6. **Rotas com alias em array preservadas** — `apiRouter.get(['/a', '/b'], ...)` mantém os 2 paths.

---

## 2. Estado atual (inventário de base)

### 2.1 Arquitetura atual

| Camada | Onde | Observação |
|:-------|:-----|:-----------|
| Entry point | `API/index.cjs` (6.943 linhas) | Bootstrap + 116 rotas (111 apiRouter + 3 app-level bootstrap + 2 swagger docs) + 13 funções de módulo + crons + swagger |
| Rotas | Inline no `index.cjs` (`apiRouter.get/post/...`) | 116 no index (114 single-path + 2 alias) + 11 já em `src/routes/invoice.routes.js` = **127** |
| Rotas de bootstrap | Dentro de `bootstrap().then()` (app-level) | 3 rotas: `POST /api/admin/users/mass`, `POST /api/admin/run-reconciliation-job`, `GET /api/health` — **já contadas nas 116 do index** |
| Controllers | Inline (handlers nas rotas) | Exceto `src/controllers/invoiceController.js` (piloto) |
| Repositories | `API/repositories/` (15 arquivos) | Camada de dados — **preservar** |
| Utils | `API/utils/` (7 arquivos) | Regras puras — **preservar** |
| Services | `API/services/` + `database/` | Engines + providers — **preservar** |
| Middlewares | `API/middlewares/auth.js` | bearerAuth, requireScope, pinGuard, withReqId, auditLog |
| Testes | `API/tests/unit` (15) + `integration` (3) | ✅ já separados |
| Config | `.env` + `knexfile.js` + constantes inline | A extrair para `src/config/` |

### 2.2 Inventário de rotas por domínio (do `index.cjs`)

| Domínio | Qtd | Linhas (bloco principal) | Observação |
|:--------|:---:|:-------------------------|:-----------|
| **AUTH** | 5 | 1093–1366 | Contíguo, sem closure pesado |
| **USERS** | 13 | 1396–1680 + 4799 | 2 blocos |
| **PIX** | 12 | 2272–2523 + 4196 + 4856 | 1 bloco grande + 2 órfãs |
| **SHOP** | 2 | 1826–1831 | Minúsculo |
| **RECURRING** | 4 | 4949–4987 | Contíguo, repo próprio |
| **SUBS** | 7 | 4141–4163 + 5922–5957 | 6 user + 1 admin force-cycle (4141) |
| **CARDS** | 8 | 3342–3932 | 7 user + 1 admin delivery-status (3914) |
| **ADMIN** | 47 | 1690–1776, 2616–3278, 3442–4720, 5985–6765 | puro (45 single-path + 2 alias); 55 no total do index: +4 faturas +1 subs +1 cards +2 bootstrap |
| **INVOICES** | 15 | — | ✅ **11 já extraídas** + 4 admin no index (4085, 4133, 4172, 6713) |
| **MISC** | 9 | 863–1044, 4813–4996, 6814–6854 | health, debug, test/reset, stories, proxy/news, financial-health, statement/export, transactions/cancel, vouchers |

**Total: 116 definições reais no index.cjs (114 single-path + 2 alias em array nas linhas 4317 e 4714) + 11 extraídas = 127 rotas.**
- Das 116 no index: **3 são app-level dentro de `bootstrap().then()`** (`POST /api/admin/users/mass`, `POST /api/admin/run-reconciliation-job`, `GET /api/health`) — **já contadas nas 116, não somar de novo** — e **2 são endpoints de documentação** (`/api-docs/swagger.json`, `/api-docs/swagger.yaml`), fora do escopo de negócio.
- **Rotas de negócio: 122** (111 apiRouter no index + 11 extraídas).
- A linha 1494 é um **comentário** que duplica a rota real 1495 — não conta.

> ⚠️ **Rotas com alias em array** (2 URLs por registro, contam como 2 paths no inventário de verificação):
> - Linha 4317: `GET ['/admin/billing/accounts-status', '/admin/billing/status']`
> - Linha 4714: `POST ['/admin/billing/validate-all', '/admin/billing/run-cycle']`

### 2.3 Funções de escopo de módulo (dependências de closure)

Funções definidas no corpo do `index.cjs` que os handlers usam — **serão movidas ou injetadas**:

| Função | Linha | Uso principal | Destino | Observação |
|:-------|:-----:|:--------------|:--------|:-----------|
| `normalizeUser` | 125 | Payload /users | `src/services/userService.js` (ou injetada) | Compartilhada (users, cards, admin) → injetar |
| `enrichUserCreditCardData` | 187 | Payload cartão/faturas | `src/services/creditCardService.js` (ou injetada) | Compartilhada (cards, invoices, admin) → injetar |
| `toLocalSqlTimestamp`, `toISO`, `normalizeTransaction`, `normalizeContact`, `escapeSQL` | 702–749 | Helpers de formatação | `src/utils/` | Uso amplo |
| `handleValidationErrors` | 794 | Middleware de validação | `src/models/` ou `middlewares/` | Compartilhado |
| `authenticateAdmin` | 811 | Middleware admin | `middlewares/auth.js` (já existe padrão) | Compartilhado |
| `generateCardNumber`, `formatExpiry` | 3332–3334 | Rotas cards | injetadas via cardEngine | Só cards |
| `runBillingValidation` | 4383 | Cron admin billing | `src/services/billingService.js` | Chamado por cron + rota admin |
| `syncInvoiceDiasAtraso` | 4683 | Cron admin | `src/services/billingService.js` | Cron |
| `fetchUnpaidClosedInvoices` | 4784 | Admin + invoices | `src/services/` (hoje no index) | ⚠️ Rota admin `/admin/invoice-payment-distribution` usa — manter no index e injetar, OU mover e injetar nos 2 |
| `initializeDatabase`, `ensureAdminUser`, `seedDatabase` | 5048–5750 | Bootstrap | `src/config/bootstrap.js` | Só bootstrap |
| `bootstrap` | 5826 | Entry point | `src/config/bootstrap.js` | Só entry point |
| `chargeSubscription`, `runSubscriptionBilling` | 5860–5899 | Subs | `src/services/subscriptionService.js` | Só subs |
| `runOrphanPaymentFix` | 6028 | Admin audit | `src/services/auditService.js` | Admin |
| `applyTransactionCancellation` | 6786 | Cancela transação | `src/services/transactionService.js` | ⚠️ **USO CRUZADO**: rota admin 3620 (`/admin/transactions/:cpf/:id/cancel`) E rota usuário 6814 (`/transactions/:cpf/:id/cancel`) — mover na Fase 7 (admin) e injetar na Fase 8 (misc), OU manter no index e injetar nos dois |

---

## 3. Padrão de extração (validado no piloto)

### 3.1 Contrato do controller

```js
// src/controllers/<dominio>Controller.js
module.exports = function createXController(deps) {
    const { repo, service, helper } = deps;
    const handler = async (req, res) => { /* código VERBATIM do index.cjs */ };
    return { handler, helpers: { ... } };
};
```

### 3.2 Contrato do router

```js
// src/routes/<dominio>.routes.js
module.exports = function registerXRoutes({ apiRouter, bearerAuth, asyncHandler, controller }) {
    apiRouter.get('/...', bearerAuth(), asyncHandler(controller.handler));
    // MESMA ordem do index.cjs
};
```

### 3.3 Regras de extração verbatim

1. **Copiar, não reescrever** — extrair o bloco exato do handler com um script Node (preservando CRLF), como feito no piloto de faturas (`_tmp_extract_invoice_routes.cjs`).
2. **Mover helpers usados por 1 domínio** junto com o domínio; **injetar** os compartilhados (via `deps`).
3. **Path de `require` corrigido** — `'../../utils/...'` a partir de `src/controllers/`.
4. **Posição de registro preservada** — chamar `registerXRoutes(...)` no MESMO ponto do arquivo onde as rotas estavam (ordem do Express importa para rotas com parâmetros).
5. **`__dirname`-dependente** — caminhos de arquivo (ex.: gerador Python) são calculados no `index.cjs` e **injetados** (não recalculados no controller).
6. **Alias em array** — `apiRouter.get(['/a', '/b'], ...)` deve ser copiado com os 2 paths intactos no array.

---

## 4. Roadmap em fases

> Ordem escolhida: **menores e independentes primeiro** → o `index.cjs` encolhe de forma incremental e estável; o ADMIN (47 registros, o maior domínio) fica por último, quando o padrão já estiver maduro.

### ✅ Fase 0 — Piloto (FEITO)

- Extraídas **11 rotas de fatura/pagamento** → `src/routes/invoice.routes.js` + `src/controllers/invoiceController.js`
- 5 helpers movidos (distributePaymentAmongInvoices, markFullyPaidInvoices, settleClosedInvoices, getClosedInvoiceDebt, generatePaymentCodesFallback)
- `jest.config.js` com projects unit/integration; testes reorganizados (15 unit + 3 integration)
- **Resultado**: index.cjs de 7.801 → 6.943 linhas; 429/429 testes verdes

### 🥇 Fase 1 — AUTH (5 rotas) · ~1h

**Escopo**: `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/request-password-reset`, `/auth/reset-password` (linhas 1093–1366).

**Cria**:
- `src/routes/auth.routes.js`
- `src/controllers/authController.js`
- `src/models/authSchemas.js` (signupValidationRules, resetPasswordValidationRules, loginValidationRules — hoje inline)

**Move**: `handleValidationErrors` → `src/models/` (ou mantém em middlewares).
**Injeta**: `usersRepo`, `repoContext`, `bcrypt`, `jwt`, `JWT_SECRET`, limiter/validators.

**Critério de conclusão**: `npm test` verde + `node -c` + login/signup smoke via curl + `node -e require('./src/controllers/authController')` OK.

### 🥈 Fase 2 — SHOP (2 rotas) + RECURRING (4 rotas) · ~1h

**Escopo**: `/shop/products`, `/shop/checkout` (1826–1831); `/recurring-bills/:cpf` CRUD (4949–4987).

**Cria**: `shop.routes.js` + `shopController.js`; `recurring.routes.js` + `recurringController.js`.
**Move**: nada crítico; `recurringBillsRepo` e `shopRepo` já existem.
**Injeta**: `shopRepo`, `recurringBillsRepo`, `repoContext`.

### 🥉 Fase 3 — PIX (12 rotas) · ~2h

**Escopo**: keys, contacts, transfer, transfer-credit, recipient-info, limit/request, categorize (2272–2523 + 4196 + 4856).

**Cria**: `pix.routes.js` + `pixController.js`; `src/services/pixService.js` (lógica de transferência hoje inline).
**Move**: `normalizeContact` → `src/utils/`.
**Injeta**: `pixRepo`, `usersRepo`, `transactionsRepo`, `pinGuard`, `repoContext`.

### Fase 4 — SUBS (7 rotas) · ~1.5h

**Escopo**: plans + assinaturas CRUD + force-cycle admin (4141–4163, 5922–5957).

**Cria**: `subscriptions.routes.js` + `subscriptionsController.js`.
**Move**: `chargeSubscription`, `runSubscriptionBilling` → `src/services/subscriptionService.js`.
**Injeta**: `subscriptionsRepo`, `plansRepo`, `runEngine`, `pinGuard`.

### Fase 5 — CARDS (8 rotas) · ~2h

**Escopo**: activate, my-cards, billing-cycle, virtual/generate, toggle-block, delete, delivery-status (3342–3932).

**Cria**: `cards.routes.js` + `cardsController.js`.
**Move**: `generateCardNumber`, `formatExpiry` → `src/utils/cardFormat.js` (ou injeta cardEngine direto).
**Injeta**: `cardRepo`, `cardEngine`, `usersRepo`.

### Fase 6 — USERS (13 rotas) · ~2h

**Escopo**: me, profile, balance, statement, notifications, purchases, pix-daily (1396–1680 + 4799).

**Cria**: `users.routes.js` + `usersController.js`.
**Move**: `normalizeUser`, `normalizeTransaction`, `toLocalSqlTimestamp`, `toISO` → `src/services/userService.js` + `src/utils/`.
**Injeta**: `usersRepo`, `transactionsRepo`, `notificationsRepo`, `enrichUserCreditCardData`.

### Fase 7 — ADMIN (47 registros: 45 puros + 2 aliases; 55 no total do index contando admin-* de outros domínios e 2 de bootstrap) · ~1 dia (a maior, dividida em 7 sub-domínios)

**Cria** (1 arquivo de rotas + 1 controller por sub-domínio):

| Sub-domínio | Rotas | Arquivos |
|:------------|:-----:|:---------|
| `adminUsers` | 14 | `admin/users.routes.js` + `adminUsersController.js` |
| `adminNotifications` | 3 | `admin/notifications.routes.js` + `adminNotificationsController.js` |
| `adminBilling` | 6 + 2 aliases | `admin/billing.routes.js` + `adminBillingController.js` |
| `adminAudit` | 7 | `admin/audit.routes.js` + `adminAuditController.js` |
| `adminRequests` | 6 | `admin/requests.routes.js` + `adminRequestsController.js` |
| `adminTransactions` | 8 | `admin/transactions.routes.js` + `adminTransactionsController.js` |
| `adminMassa` | 1 (reset/users) + 2 bootstrap | `admin/massa.routes.js` (ou migra na Fase 9) |

**Move**: `runBillingValidation`, `syncInvoiceDiasAtraso`, `runOrphanPaymentFix`, `fetchUnpaidClosedInvoices` → `src/services/` (billingService, auditService). **Atenção**: nesta fase, `applyTransactionCancellation` é usado pela rota admin 3620 — mover para `src/services/transactionService.js` AQUI e injetar na Fase 8 (misc), para não criar dependência invertida.
**⚠️ Alias em array**: as rotas `['/admin/billing/accounts-status', '/admin/billing/status']` (4317) e `['/admin/billing/validate-all', '/admin/billing/run-cycle']` (4714) devem manter os 2 paths.
**Injeta**: `authenticateAdmin`, `usersRepo`, `databricksService`, `repoContext`, todos os services recém-criados.

### Fase 8 — MISC (9 rotas) · ~1.5h

**Escopo**: health, debug, test/reset, stories, proxy/news, financial-health, statement/export, transactions/cancel, vouchers (863–1044, 4813–4996, 6814–6854).

**Cria**: `misc.routes.js` + `miscController.js`; `src/utils/formatters.js` (toISO, escapeSQL, normalizeTransaction).
**Move**: `applyTransactionCancellation` (se ainda no index; na Fase 7 já deve ter sido movido) → injetar `transactionService` aqui.

### Fase 9 — Bootstrap fino + Config (sem mudança de rotas) · ~3h

**Cria**:
- `src/config/env.js` — carrega dotenv e exporta `{ PORT, JWT_SECRET, DB_PROVIDER }`
- `src/config/bootstrap.js` — `initializeDatabase`, `ensureAdminUser`, `seedDatabase`, `bootstrap()`
- `src/config/scheduler.js` — registra TODOS os `cron.schedule` (invoiceEngine 00:00, runBillingValidation, recurringEngine, syncInvoiceDiasAtraso) — hoje os agendamentos rodam no load do módulo; ao mover as funções para services, os schedules vão para cá
- `src/app.js` — factory `createApp()` com middlewares globais (helmet, cors, json, cookieParser, withReqId) + monta routers

**⚠️ Rotas de bootstrap**: as 3 rotas app-level (`POST /api/admin/users/mass`, `POST /api/admin/run-reconciliation-job`, `GET /api/health`) são registradas dentro de `bootstrap().then()` (dependem do banco conectado) — devem migrar para `src/config/bootstrap.js` na MESMA posição (após `connect()`), não para um router comum.

**⚠️ Ordem dos middlewares de erro**: o error handler atual está na linha 5033 (NO MEIO do arquivo) e o 404 no final após bootstrap. No `createApp()`: error middleware (assinatura 4-arg) deve ficar **APÓS todas as rotas**, e o 404 **por último** — senão rotas registradas depois do error handler mudam de comportamento de erro.

**`index.cjs` final** (~50 linhas): `createApp()` → `bootstrap()` → `app.listen()`. Todos os `require` de serviços/utils/repositories migram para os módulos `src/`.

### Fase 10 — Models (schemas) · ~1h (contínua)

- Mover todos os `*ValidationRules` e `handleValidationErrors` do `index.cjs` para `src/models/` por domínio (`authSchemas.js`, `userSchemas.js`, `pixSchemas.js`...).
- **Não criar camada de ORM/entities** — `repositories/` continua sendo a camada de dados. `models/` aqui = validação de payload.

### Fase 11 — Limpeza final · ~1h

- Remover arquivos de rascunho da raiz (`scratch_*.js`, `check_*.js`, `test_*.js` do root) — mover para `scripts/` ou excluir (conferir uso).
- Atualizar `README-backend.md` e `SKILL.md` com a nova estrutura.
- Atualizar `jest.config.js` `collectCoverageFrom` se necessário (src/** já coberto).
- Regenerar swagger (`npm run swagger`) e conferir que as 127 rotas continuam documentadas.

---

## 5. Matriz de risco e mitigação

| Risco | Impacto | Mitigação |
|:------|:--------|:----------|
| Quebrar ordem de registro do Express (rotas com params conflitam) | Alto | Registrar no MESMO ponto do arquivo; teste de smoke por domínio |
| Helper compartilhado usado por 2+ domínios virar `undefined` | Alto | Inventário de closure por domínio ANTES de mover; injetar via `deps` (ver tabela 2.3 — casos `fetchUnpaidClosedInvoices` e `applyTransactionCancellation`) |
| `require` relativo errado após mover (`./utils` vs `../../utils`) | Alto | Script de extração corrige paths; `node -e require(...)` por módulo |
| CRLF corrompido pelo editor (arquivo é CRLF) | Médio | Extração via script Node preservando bytes; `node -c` |
| `__dirname` muda ao mover (ex.: path do gerador Python) | Médio | Calcular no index.cjs e injetar como `paymentGeneratorScriptPath` |
| Rota admin usa helper que "foi" para outro controller | Médio | `fetchUnpaidClosedInvoices` ficou no index justamente por isso; revisar por sub-domínio |
| **Alias em array perdidos** (2 URLs por registro) | Médio | Copiar array verbatim; verificação por inventário (ver §6, item 1) |
| **Crons somem ao mover funções** (agendados no load do módulo) | Alto | `src/config/scheduler.js` centraliza todos os `cron.schedule` na Fase 9 |
| **Rotas de bootstrap esquecidas** (3 app-level dentro de `bootstrap().then()`) | Alto | Inventariadas na §2.2; migram junto com o bootstrap na Fase 9 |
| **Error handler/404 reordenados** ao criar `createApp()` | Médio | Error handler (4-arg) após todas as rotas; 404 por último |
| **swagger-generate.js** depende do formato atual | Médio | Regenerar swagger a cada fase de domínio; conferir 127 rotas |
| Regressão silenciosa (rota responde, mas com payload diferente) | Alto | Testes de integração por domínio + diff manual do JSON antes/depois |
| Alterar lógica "de quebra" durante a extração | Alto | **Regra dura**: extração verbatim; refatoração de comportamento é tarefa separada |

---

## 6. Critérios de aceite (globais)

1. **127/127 rotas respondem igual (129 paths — os 2 aliases 4317/4714 expõem 4 URLs no total)** — verificado por **script de diff de inventário** (método + path + nº de middlewares por rota, antes/depois), cobrindo também os **2 aliases em array** (4317 e 4714 contam como 2 paths cada) e as **3 rotas de bootstrap app-level**.
2. **`npm test` → 429 testes PASS** (18 suítes: 15 unit + 3 integration) a cada fase.
3. `node -c` em todos os arquivos alterados + `node -e require(...)` dos novos módulos.
4. `index.cjs` final ≤ ~200 linhas (entry-point fino).
5. Zero alteração de comportamento nos `repositories/`, `utils/`, `services/` existentes.
6. Nenhum `.test.js` na raiz de `tests/` (tudo em `unit/` ou `integration/`).
7. Code review (`code-reviewer-deepseek-flash`) sem bloqueios a cada fase.
8. **Swagger regenerado** (`npm run swagger`) e com as 127 rotas documentadas ao final de cada fase de domínio.

---

## 7. Estimativa de esforço

| Fase | Rotas | Esforço |
|:-----|:-----:|:--------|
| 0 — Piloto (faturas) | 11 | ✅ FEITO |
| 1 — AUTH | 5 | ~1h |
| 2 — SHOP + RECURRING | 6 | ~1h |
| 3 — PIX | 12 | ~2h |
| 4 — SUBS | 7 | ~1.5h |
| 5 — CARDS | 8 | ~2h |
| 6 — USERS | 13 | ~2h |
| 7 — ADMIN (7 sub) | 47 (45 + 2 aliases) | ~1 dia |
| 8 — MISC | 9 | ~1.5h |
| 9 — Bootstrap + Config | — | ~3h |
| 10 — Models | — | ~1h |
| 11 — Limpeza | — | ~1h |
| **Total** | **127** (122 negócio + 3 bootstrap + 2 swagger) | **~3-4 dias** |

---

## 8. Ordem recomendada de execução

> O ideal é executar **uma fase por sessão de trabalho**, terminando cada uma com: extração → `node -c` → `npm test` → smoke curl do domínio → code review → commit.

**Sequência**: Fase 0 (feita) → 1 (AUTH) → 2 (SHOP+RECURRING) → 3 (PIX) → 4 (SUBS) → 5 (CARDS) → 6 (USERS) → 7 (ADMIN) → 8 (MISC) → 9 (bootstrap) → 10 (models) → 11 (limpeza).

**A Fase 9 (bootstrap fino) só faz sentido APÓS todas as rotas saírem do index.cjs** — senão o entry-point ainda carrega centenas de linhas. As **3 rotas de bootstrap** (`/api/admin/users/mass`, `/api/admin/run-reconciliation-job`, `/api/health`) devem ser movidas junto com o `bootstrap()` na Fase 9, mantendo a posição (após `connect()`), pois dependem do banco conectado.
