# FintechBankApp

## What This Is

Aplicativo de banco digital fictício (WEB + MOBILE + API) usado como projeto de estudo e teste de conceitos financeiros. Simula PIX, cartão de crédito/débito, faturas com parcelamento e encargos reais, assinaturas recorrentes, cancelamento/estorno de transações, gamificação (saúde financeira, streak semanal) e um marketplace interno — tudo sobre uma API Node.js/Express com PostgreSQL.

## Core Value

Servir como ambiente de estudo realista de operações bancárias/financeiras (cobrança, faturamento, estorno, autorização) — a correção e coerência das regras de negócio importa mais que qualquer polimento visual.

## Requirements

### Validated

- ✓ Autenticação JWT + PIX (transferências, chaves, contatos) — existing
- ✓ Cartão de crédito: fatura, parcelamento (2x-12x com IOF+juros reais), pagamento flexível (total/mínimo/valor livre) — existing
- ✓ Motor de cobrança (billing engine): ciclo de fatura, encargos por atraso, cron diário — existing
- ✓ Assinaturas recorrentes (mensal/anual, débito/crédito) com cobrança automática, e cancelamento que estorna a última cobrança — existing
- ✓ Cancelamento/estorno de transações (débito e crédito) com credit voucher para fatura já fechada — existing
- ✓ Motor de cartões com 12 BINs reais (Master/Visa/Elo) — existing
- ✓ Marketplace interno (produtos, checkout, cashback) — existing
- ✓ Gamificação: Saúde Financeira, Weekly Streak — existing
- ✓ Painel admin parcial (Profile → Admin): aprovação de solicitações de limite/senha, stats básicos, controles de cenário de billing mock — existing

### Active

- [ ] Nova opção de menu, visível só para `role: admin`, dando acesso a uma tela dedicada (WEB + MOBILE) cobrindo TODAS as funções administrativas da API (~33 rotas em 4 grupos: Usuários, Cartões e Autorizações de Compra, Faturamento, Solicitações)
- [ ] Grupo "Cartões e Autorizações de Compra" — prioridade alta: simulação/autorização de compra (crédito e débito), consulta de detalhes de cartão, status de entrega, simulação de transações em massa — hoje só existe via API/Swagger, sem UI nenhuma
- [ ] Cobertura das rotas de Faturamento (config de cobrança, forçar ciclo de fatura, ajustar vencimento, status de conta) que hoje faltam na UI
- [ ] Cobertura das rotas de Usuários (bloqueio/desbloqueio, ajuste de limite pix/crédito, reset de senha administrativo) que hoje faltam na UI

### Out of Scope

- Múltiplos admins/operadores externos — projeto de estudo de uso interno único, não um produto multi-operador
- Redesenho do fluxo de aprovação já existente (Solicitações) — já funciona; só precisa ficar acessível na nova tela junto com o resto

## Context

- Projeto brownfield maduro: 80+ sessões de desenvolvimento anteriores a este bootstrap do GSD.
- Stack: API Node.js/Express monolítico (`API/index.cjs`, ~5700 linhas) + PostgreSQL; WEB em React; MOBILE em Ionic/Capacitor — arquitetura espelhada WEB↔MOBILE (mesmos componentes, adaptados por plataforma).
- Acesso admin já existe hoje via `Profile.tsx` → botão visível quando `user.role === 'admin'` → `WEB/components/Admin.tsx` / `MOBILE/src/components/Admin.tsx` (833 linhas cada, espelhados). Cobre só uma fatia das rotas `/admin/*`. Usuário pediu explicitamente algo novo em vez de só estender essa tela.
- Ver `.planning/codebase/` (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS) para o mapeamento completo do codebase gerado nesta sessão.
- CONCERNS.md já registra: `API/index.cjs` monolítico (5700+ linhas), `HomeView.tsx` do MOBILE grande (2793 linhas), credenciais fracas em script de reset, cobertura de teste fraca em WEB/MOBILE vs API.
- As ~33 rotas admin já existem, foram testadas via smoke test nesta sessão, e estão documentadas/organizadas por tag no Swagger (`Admin - Usuários`, `Admin - Cartões e Autorizações de Compra`, `Admin - Faturamento`, `Admin - Solicitações`).

## Constraints

- **Paridade WEB↔MOBILE**: toda funcionalidade nova precisa existir nos dois frontends, seguindo o padrão espelhado já estabelecido no projeto.
- **Uso interno/estudo**: sem necessidade de suportar múltiplos admins simultâneos, i18n, ou hardening de produção além do que já existe (JWT, bearerAuth, PIN em ações financeiras).
- **API já pronta**: as ~33 rotas admin já existem; este trabalho é majoritariamente frontend (WEB+MOBILE UI consumindo rotas já prontas).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Nova tela/entrada de menu dedicada em vez de só estender o `Admin.tsx` existente dentro do Perfil | Usuário pediu explicitamente "algo novo" ao ser perguntado sobre o acesso admin já existente | — Pending |
| Cobrir todas as ~33 funções admin na v1, sem fatiar por prioridade | Usuário confirmou: quer tudo funcionando agora, não só o grupo de autorização de compra | — Pending |
| Adotar GSD (roadmap/fases) para este projeto a partir de agora | Usuário confirmou explicitamente, mesmo sabendo do custo de bootstrap num projeto já maduro (brownfield) | — Pending |

---
*Last updated: 2026-07-19 after initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
