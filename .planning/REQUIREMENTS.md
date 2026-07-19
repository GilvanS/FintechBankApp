# Requirements: FintechBankApp — Painel Admin

**Defined:** 2026-07-19
**Core Value:** Servir como ambiente de estudo realista de operações bancárias/financeiras — a correção e coerência das regras de negócio importa mais que qualquer polimento visual.

## v1 Requirements

Requerimentos derivados de `.planning/PROJECT.md` (Active) + `.planning/research/SUMMARY.md`. Cobrem as ~35 rotas `/admin/*` já existentes na API, expostas via WEB (React) + MOBILE (Ionic/Capacitor).

### SHELL — Casca do painel admin (pré-requisito de tudo abaixo)

- [ ] **SHELL-01**: Usuário com `role: admin` vê uma nova opção dedicada no menu (não dentro do Perfil) que leva ao painel admin
- [ ] **SHELL-02**: Painel admin é bloqueado (redireciona/nega) para qualquer usuário que não seja `role: admin`
- [ ] **SHELL-03**: Painel admin apresenta navegação por grupo funcional (Usuários, Cartões e Autorizações de Compra, Faturamento, Solicitações), espelhando os grupos já definidos no Swagger
- [ ] **SHELL-04**: Toda ação que muda estado (bloqueio, autorização de compra, ajuste de fatura, etc.) exibe confirmação antes de executar e feedback de sucesso/erro depois
- [ ] **SHELL-05**: Toda ação de mutação é protegida contra duplo-clique/duplo-envio (proteção de idempotência no lado do cliente)
- [ ] **SHELL-06**: A mesma cobertura funcional existe em WEB e MOBILE (paridade espelhada, conforme padrão já estabelecido no projeto)

### USERS — Gestão de usuários

- [ ] **USERS-01**: Admin pode buscar um usuário por CPF e ver seus dados (saldo, limites, status de bloqueio, status da conta)
- [ ] **USERS-02**: Admin pode bloquear/desbloquear um usuário
- [ ] **USERS-03**: Admin pode ajustar o limite diário de PIX de um usuário
- [ ] **USERS-04**: Admin pode ajustar o limite de crédito de um usuário
- [ ] **USERS-05**: Admin pode resetar a senha de um usuário (gerar senha temporária)
- [ ] **USERS-06**: Admin pode depositar saldo na conta de um usuário
- [ ] **USERS-07**: Admin pode ver estatísticas gerais do sistema (stats)

### CARDS — Cartões e Autorizações de Compra (prioridade alta — hoje sem UI nenhuma)

- [ ] **CARDS-01**: Admin pode consultar detalhes de cartão de um usuário
- [ ] **CARDS-02**: Admin pode simular/autorizar uma compra a crédito para um usuário
- [ ] **CARDS-03**: Admin pode simular/autorizar uma compra a débito para um usuário
- [ ] **CARDS-04**: Admin pode simular transações em massa para um usuário (`transactions/simulate-mass`)
- [ ] **CARDS-05**: Admin pode consultar/atualizar o status de entrega de um cartão físico

### BILLING — Faturamento

- [ ] **BILLING-01**: Admin pode consultar e editar a configuração do ciclo de cobrança (billing config)
- [ ] **BILLING-02**: Admin pode forçar o avanço do ciclo de fatura de um usuário (force-cycle)
- [ ] **BILLING-03**: Admin pode ajustar a data de vencimento da fatura de um usuário
- [ ] **BILLING-04**: Admin pode consultar o status de conta (adimplente/inadimplente) de um usuário

### REQUESTS — Solicitações (relocação, sem redesenho)

- [ ] **REQUESTS-01**: Admin pode ver e aprovar/negar solicitações de aumento de limite, dentro do novo painel
- [ ] **REQUESTS-02**: Admin pode ver e aprovar/negar solicitações de reset de senha, dentro do novo painel

### SECURITY — Achados do PITFALLS.md tratados como decisão explícita

- [ ] **SECURITY-01**: `/admin/simulate-purchases` passa a usar o mesmo middleware `authenticateAdmin` das demais rotas admin, em vez do check inline `req.user.role !== 'admin'`

## v2 Requirements

Deferred — não fazem parte desta v1, mas ficaram registrados pela pesquisa.

### Segurança (API, fora do escopo deste milestone frontend)

- **SECURITY-02**: Substituir interpolação de string crua por `esc()`/parametrização nas queries admin restantes (débito técnico pré-existente, extenso — fora do escopo deste milestone que é focado em frontend)
- **SECURITY-03**: Decidir se rotas admin money-moving devem exigir PIN/step-up como as rotas user-facing já exigem

### Painel

- **UX-01**: Visualizador inline de resposta JSON para endpoints de simulação (mostrar cálculo de IOF/juros/cashback)
- **UX-02**: View consolidada de "snapshot" da conta de um usuário (composta de 3 GETs existentes)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Múltiplos admins/operadores externos, RBAC granular | Projeto de estudo de uso interno único, não produto multi-operador |
| Redesenho do fluxo de Solicitações | Já funciona — só relocado pro novo painel, não redesenhado |
| Audit-log UI completo, undo/redo, dashboards de analytics | Over-engineering para uma ferramenta interna de estudo — não pedido |
| Nova biblioteca de componentes (MUI/AntD/shadcn) | Stack já tem Tailwind; nova lib visual conflitaria com o resto do app |
| Ações em massa genéricas (multi-select) em endpoints single-CPF (block, limits, reset-password) | API não é batch-shaped para essas rotas — só `simulate-purchases`/`simulate-mass` são |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 1 | Pending |
| SHELL-02 | Phase 1 | Pending |
| SHELL-03 | Phase 1 | Pending |
| SHELL-04 | Phase 1 | Pending |
| SHELL-05 | Phase 1 | Pending |
| SHELL-06 | Phase 1 | Pending |
| USERS-01 | Phase 2 | Pending |
| USERS-02 | Phase 2 | Pending |
| USERS-05 | Phase 2 | Pending |
| USERS-07 | Phase 2 | Pending |
| USERS-03 | Phase 3 | Pending |
| USERS-04 | Phase 3 | Pending |
| USERS-06 | Phase 3 | Pending |
| CARDS-01 | Phase 4 | Pending |
| CARDS-02 | Phase 4 | Pending |
| CARDS-03 | Phase 4 | Pending |
| CARDS-04 | Phase 4 | Pending |
| CARDS-05 | Phase 4 | Pending |
| SECURITY-01 | Phase 4 | Pending |
| BILLING-01 | Phase 5 | Pending |
| BILLING-02 | Phase 5 | Pending |
| BILLING-03 | Phase 5 | Pending |
| BILLING-04 | Phase 5 | Pending |
| REQUESTS-01 | Phase 6 | Pending |
| REQUESTS-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25/25 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-19*
*Last updated: 2026-07-19 after roadmap creation — 25/25 v1 requirements mapped across 6 phases (see .planning/ROADMAP.md)*
