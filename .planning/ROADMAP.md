# Roadmap: FintechBankApp — Painel Admin

## Overview

Este milestone constrói um painel administrativo completo (WEB + MOBILE) sobre as ~35 rotas `/admin/*` já existentes e testadas na API. A jornada começa pela casca do painel e pela infraestrutura compartilhada de confirmação/idempotência (Fase 1), que todas as fases seguintes herdam. Em seguida, o fluxo cobre a gestão de usuários em duas fatias — acesso/identidade e ajustes financeiros (Fases 2-3), já que ambas dependem da mesma busca por CPF. Depois vem o grupo de maior prioridade e risco, Cartões e Autorizações de Compra, hoje sem nenhuma UI (Fase 4). Faturamento segue como quinta fatia (Fase 5). Por fim, a relocação do fluxo de Solicitações — já funcional, sem redesenho — fecha o milestone consolidando o painel único e decidindo o destino do antigo `Admin.tsx` (Fase 6).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Admin Shell + Shared Action Infrastructure** - Painel admin com acesso dedicado, navegação por grupo, confirmação e proteção contra duplo-envio
- [ ] **Phase 2: Busca de Usuário e Controle de Acesso** - Busca por CPF, visão consolidada, bloqueio/desbloqueio, reset de senha, stats
- [ ] **Phase 3: Ajustes Financeiros do Usuário** - Ajuste de limite PIX/crédito e depósito de saldo
- [ ] **Phase 4: Cartões e Autorizações de Compra** - Detalhes de cartão, simulação/autorização de compra crédito/débito, simulação em massa, status de entrega
- [ ] **Phase 5: Faturamento** - Configuração de cobrança, avanço de ciclo, ajuste de vencimento, status de conta
- [ ] **Phase 6: Solicitações no Novo Painel + Consolidação** - Aprovação/negação de solicitações relocada para o painel novo, consolidação do ponto de entrada admin

## Phase Details

### Phase 1: Admin Shell + Shared Action Infrastructure
**Goal**: Admin users have a dedicated, role-gated entry point into a grouped admin panel where every mutating action confirms before executing and is protected against double-submission.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06
**Success Criteria** (what must be TRUE):
  1. Admin user sees a new dedicated menu item (not inside Perfil) that opens the admin panel, on both WEB and MOBILE
  2. A non-admin user who tries to reach the admin panel is redirected or denied access
  3. The admin panel shows navigation across the four functional groups (Usuários, Cartões e Autorizações de Compra, Faturamento, Solicitações)
  4. Any state-changing action in the panel shows a confirmation prompt before executing and a success/error message after
  5. Rapidly double-clicking/double-tapping a mutating action executes it only once
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [ ] 01-01-PLAN.md — WEB: shared confirmation/mutation hook (useAdminAction + GlobalDialogContext danger variant), TDD
- [ ] 01-02-PLAN.md — WEB: AdminPanel shell, role gate, 4-group nav, BottomNavBar + Dashboard wiring
- [ ] 01-03-PLAN.md — MOBILE: port of 01-02 (AdminPanel shell, role gate, 4-group nav)
- [ ] 01-04-PLAN.md — MOBILE: port of 01-01 (useAdminAction + GlobalDialogContext danger variant), TDD
- [ ] 01-05-PLAN.md — Human-verify checkpoint: admin shell end-to-end on WEB + MOBILE

### Phase 2: Busca de Usuário e Controle de Acesso
**Goal**: Admin can find any user by CPF and manage their access/identity (view details, block/unblock, reset password) from within the panel.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: USERS-01, USERS-02, USERS-05, USERS-07
**Success Criteria** (what must be TRUE):
  1. Admin can search a user by CPF and see balance, limits, block status, and account status
  2. Admin can block or unblock the user, and the new status is reflected immediately after confirmation
  3. Admin can reset the user's password and see the generated temporary password
  4. Admin can view general system statistics from the panel
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 02-01: TBD (refined during /gsd-plan-phase)

### Phase 3: Ajustes Financeiros do Usuário
**Goal**: Admin can adjust a selected user's PIX/credit limits and deposit balance into their account.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2 (reuses CPF search/detail view)
**Requirements**: USERS-03, USERS-04, USERS-06
**Success Criteria** (what must be TRUE):
  1. Admin can adjust the user's PIX daily limit, with confirmation before the change applies
  2. Admin can adjust the user's credit limit, with confirmation before the change applies
  3. Admin can deposit balance into the user's account and see the updated balance
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD (refined during /gsd-plan-phase)

### Phase 4: Cartões e Autorizações de Compra
**Goal**: Admin can inspect a user's card, simulate/authorize credit and debit purchases, run mass transaction simulations, and manage physical card delivery status, all through a properly authenticated admin route.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2 (reuses CPF search/detail view)
**Requirements**: CARDS-01, CARDS-02, CARDS-03, CARDS-04, CARDS-05, SECURITY-01
**Success Criteria** (what must be TRUE):
  1. Admin can look up a user's card details from the panel
  2. Admin can simulate/authorize a credit purchase and a debit purchase for a user, each requiring confirmation before executing
  3. Admin can simulate a batch of transactions for a user, with a scope preview shown before execution
  4. Admin can view and update a card's delivery status
  5. A request to the purchase-simulation route without a valid admin JWT is rejected by the same `authenticateAdmin` middleware used elsewhere (SECURITY-01)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD (refined during /gsd-plan-phase)

### Phase 5: Faturamento
**Goal**: Admin can view/adjust billing configuration and a user's billing cycle/status from within the panel.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2 (reuses CPF search/detail view)
**Requirements**: BILLING-01, BILLING-02, BILLING-03, BILLING-04
**Success Criteria** (what must be TRUE):
  1. Admin can view and edit the billing cycle configuration
  2. Admin can force a user's invoice cycle to advance, behind a heavy confirmation step given the financial impact
  3. Admin can adjust a user's invoice due date
  4. Admin can view a user's account status (adimplente/inadimplente)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD (refined during /gsd-plan-phase)

### Phase 6: Solicitações no Novo Painel + Consolidação
**Goal**: Admin can review and resolve limit-increase and password-reset requests inside the new panel, and the admin experience is consolidated into a single entry point.
**Mode:** mvp
**Depends on**: Phase 1 (panel shell); sequenced last so the old `Admin.tsx` retirement decision is made only once the new panel has full feature parity (Phases 2-5 complete)
**Requirements**: REQUESTS-01, REQUESTS-02
**Success Criteria** (what must be TRUE):
  1. Admin can see pending limit-increase requests inside the new panel and approve or deny each one
  2. Admin can see pending password-reset requests inside the new panel and approve or deny each one
  3. The previously separate admin entry point (Profile → Admin) no longer duplicates functionality — it is retired or redirects into the new panel (decision resolved during this phase's planning, not tied to a specific REQ-ID; carried from research gap)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 06-01: TBD (refined during /gsd-plan-phase)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Admin Shell + Shared Action Infrastructure | 0/5 | Not started | - |
| 2. Busca de Usuário e Controle de Acesso | 0/TBD | Not started | - |
| 3. Ajustes Financeiros do Usuário | 0/TBD | Not started | - |
| 4. Cartões e Autorizações de Compra | 0/TBD | Not started | - |
| 5. Faturamento | 0/TBD | Not started | - |
| 6. Solicitações no Novo Painel + Consolidação | 0/TBD | Not started | - |

## v2 / Deferred (not in this milestone's phases)

Recorded from REQUIREMENTS.md for visibility — not planned, not scheduled:

- SECURITY-02: substituir interpolação de string crua por `esc()`/parametrização nas queries admin restantes (débito técnico de API, fora de escopo — frontend-only milestone)
- SECURITY-03: decidir se rotas admin money-moving devem exigir PIN/step-up
- UX-01: visualizador inline de resposta JSON para endpoints de simulação
- UX-02: view consolidada de "snapshot" da conta (composta de 3 GETs existentes)

---
*Roadmap created: 2026-07-19*
*Granularity: fine — 6 phases derived from 25 v1 requirements across 5 natural categories, with Usuários split into two vertical slices (acesso/identidade vs. financeiro) along a genuine risk/UX boundary.*
