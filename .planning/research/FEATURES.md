# Feature Research

**Domain:** Internal admin / back-office panel for a fintech operations tool (single-operator study project)
**Researched:** 2026-07-19
**Confidence:** MEDIUM-HIGH (grounded directly in the project's own ~35 existing `/admin/*` routes; external UX patterns are well-established industry consensus, not exotic claims)

## Context Grounding

This is not greenfield feature discovery — the API surface already exists and is fixed. Research question is UX structure, not "what features to build." The ~35 `/admin/*` endpoints found in `API/index.cjs` map to PROJECT.md's 4 groups:

- **Usuários** — `GET /admin/users`, `GET /admin/users/:cpf`, `POST /admin/users/:cpf/deposit`, `block`, `unblock`, `PUT pix-limit`, `PUT credit-limit`, `reset-password`, `fix`, `generate-temp-password`, `card-details`
- **Cartões e Autorizações de Compra** — `PUT cards/:cpf/delivery-status`, `POST card/purchase/open`, `POST card/purchase/closed`, `POST simulate-purchases`, `POST transactions/simulate-mass`
- **Faturamento** — `GET/PUT billing/config`, `GET billing/accounts-status`, `POST billing/seed-test-scenarios`, `save-as-mock`, `clear-mock-baseline`, `validate-all`/`run-cycle`, `GET billing/account/:cpf/status`, `invoices/:cpf/:id/status`, `invoices/engine/force-cycle`, `PUT invoices/:cpf/due-date`
- **Solicitações** — `GET/approve/deny` for `requests/limit` and `requests/password` (already has partial UI, out of scope to redesign)

The 833-line existing `Admin.tsx` (WEB + MOBILE mirrored) already proves the "single admin panel, tabbed/sectioned, table + action buttons" pattern works in this codebase — the research below extends that pattern rather than replacing it.

## Feature Landscape

### Table Stakes (Users Expect These)

Features an internal ops/back-office panel is unusable without.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CPF/user search + lookup (typeahead or exact-match input) | Every user-scoped action (block, limits, card details, force cycle) needs to resolve a CPF first; without search, admin must know exact CPF strings | LOW | Reuse existing `GET /admin/users` + `GET /admin/users/:cpf`; a single search box feeding a user detail panel covers ~15 of the 35 routes |
| Grouped navigation matching the 4 API tag groups | Mirrors the Swagger grouping already established (Usuários / Cartões / Faturamento / Solicitações) — reduces cognitive mapping cost between API docs and UI | LOW | Tabs or side-nav sections, not one giant scroll — 833-line flat component is a CONCERNS.md flag already; don't repeat that shape in the new screen |
| Per-action confirmation dialog for state-changing operations | Block/unblock, force billing cycle, reset password, adjust limits all mutate real account state; a fat-fingered click on the wrong CPF row is the single highest-cost failure mode in a table-driven admin UI | LOW-MEDIUM | Simple `window.confirm`-style or lightweight modal is sufficient — full undo/audit infra is not needed (see Anti-Features) |
| Success/error toast or inline feedback per action | 25+ mutating endpoints; silent failure (e.g., a 400 from an invalid due-date) with no visible feedback is the #1 complaint pattern in admin panel UX research | LOW | Existing app likely already has a toast/snackbar pattern from the consumer-facing screens — reuse it, don't build new |
| Read-only status displays before destructive actions (current block status, current limit, current billing cycle state) | Admin needs to see *current* state before deciding to change it — e.g., don't show "block" button without showing "currently: active" | LOW | Comes almost for free from `GET /admin/users/:cpf` and `GET billing/account/:cpf/status` — just needs to render before the action controls |
| Loading/disabled states on buttons during in-flight requests | Purchase simulation, mass transaction simulation, and force-cycle are non-trivial backend operations (not instant); double-click without a disabled state risks duplicate mutating calls | LOW | Standard React pattern already used elsewhere in the codebase |
| Role gate at menu + route level (`role === 'admin'`) | Already a constraint in PROJECT.md; without it the new menu entry is a security regression vs. today's `Profile.tsx` gate | LOW | Mirror the exact gate condition used today, don't reinvent |
| WEB↔MOBILE parity for every screen/action | Hard constraint in PROJECT.md — "toda funcionalidade nova precisa existir nos dois frontends" | MEDIUM | Not a UX pattern per se, but shapes every feature: build shared logic/hooks where the mirrored-component convention allows, to avoid drift between two 800+ line files |
| Sensible defaults / pre-filled forms for simulation and mass-action endpoints | `simulate-purchases`, `transactions/simulate-mass`, `seed-test-scenarios` take multi-field payloads; a blank form with no guidance invites malformed test data | LOW-MEDIUM | Provide plausible default values (amounts, counts, dates) so the common case is "click submit," not "fill 6 fields from memory" |

### Differentiators (Nice-to-Have Polish)

Not required for the panel to be usable, but add real value given this is a study project explicitly meant to teach billing/authorization mechanics.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified "danger" visual treatment (color/icon) for irreversible or money-moving actions (deposit, force-cycle, mass simulate) vs. neutral actions (view details, delivery status) | Helps the single admin operator distinguish "just looking" from "this changes real ledger state" at a glance, especially since deposit/simulate touch fake money but real DB rows | LOW | A consistent badge/color convention (e.g., red for financial mutation, blue for account-state mutation, gray for read) — purely CSS/class-level, no new backend |
| Inline JSON/response viewer for simulation endpoints | `simulate-purchases`, `simulate-mass`, `card/purchase/open|closed` return calculated results (IOF, juros, cashback) that are the actual pedagogical point of this study app — surfacing the raw response teaches the billing engine mechanics | LOW-MEDIUM | A collapsible "ver resposta completa" panel under the result summary; this directly serves the project's stated Core Value ("correção e coerência das regras de negócio importa mais que qualquer polimento visual") |
| Quick-repeat / "run again with same params" for simulation actions | Mass simulation and purchase simulation are used repeatedly while testing billing-cycle edge cases; re-typing the same payload each time is friction for the exact workflow this feature exists for | LOW | Cache last-used form values in local component state, not persisted — resets on navigation is fine |
| Consolidated account snapshot view (status + limits + delivery status + current invoice state in one card) when a CPF is selected | Currently split across `GET /admin/users/:cpf`, `billing/account/:cpf/status`, and card-details as 3 separate calls; combining them into one detail view after search reduces the "click through 3 tabs to understand one user" tax | MEDIUM | Purely a frontend composition of 2-3 existing GETs; no new API needed |
| Keyboard-friendly / fast CPF entry (paste-and-go, auto-format) | Since this is a single-operator internal tool used repeatedly during dev/testing, shaving seconds off the most common action (find a user) compounds | LOW | Minor UX polish, skip if time-constrained — genuinely optional |

### Anti-Features (Commonly Requested, Often Problematic)

Things that look reasonable for "an admin panel" in general but are actively wrong for this project's scope (single internal operator, study app, out-of-scope items already declared in PROJECT.md).

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Role-based access control beyond the single `admin` boolean (operator roles, permission granularity, multi-tenant admin org) | "Real" back-office tools (see research: RBAC, multi-tenancy) always have this | PROJECT.md explicitly rules out multiple admins/operators — building a permission matrix for a single-operator study app is pure scope creep with zero payoff | Keep the existing single `role === 'admin'` boolean gate; nothing more |
| Full audit-log subsystem (immutable event store, who-did-what-when UI, compliance export) | Industry best practice for financial back-office UIs strongly recommends this (see research: audit trails for compliance) | This is a single-operator study project with no compliance requirement and no second admin to audit against — an audit log has no reader | If desired later, `console.log`/server log on mutating admin routes is enough; do not build a UI for it |
| Undo/redo or "soft delete with restore" for destructive actions | Standard bulk-action UX guidance (undo reduces fear of mistakes) | Adds real backend complexity (versioning, reversal endpoints) the existing ~35 routes don't support; most admin actions here (block/unblock, limit changes) are already naturally reversible by re-invoking the opposite action | Rely on confirmation dialogs pre-action + the fact that block/unblock and limit-set are idempotent and reversible via a second click, not a magic undo |
| Bulk multi-select + batch operations across many users at once (e.g., "select 50 rows, block them all") | Table-stakes in true enterprise back-office tools (bulk action UX guidance) | None of the 35 routes are batch-shaped except `simulate-purchases`/`simulate-mass`, which are *already* mass-operation endpoints by design — bulk-selecting arbitrary users for arbitrary admin actions isn't a real workflow here, it's speculative generality | Only expose the mass-simulation endpoints as "bulk," everything else stays single-CPF |
| Rich analytics dashboard / custom report builder on top of admin data | "Admin dashboard" research generically recommends charts, KPIs, trend graphs | PROJECT.md explicitly deprioritizes visual polish over business-rule correctness, and none of the 35 routes are analytics-shaped — building charts on top of `GET /admin/stats` beyond what already exists is unrequested scope | Keep the existing basic stats block as-is; don't expand it into a BI tool |
| Low-code/no-code admin panel builder (Retool/Appsmith-style external tool) | Common industry shortcut for internal tools (see research: build vs. buy for internal tools) | Contradicts the hard constraint that this must be native WEB (React) + MOBILE (Ionic/Capacitor) with mirrored components — an external tool can't satisfy the mobile requirement or the existing app-shell/auth integration | Build in-repo, following the existing mirrored-component convention |
| Real-time/live-updating tables (WebSocket-pushed user status changes) | "Real-time everything" is a common ask for dashboards | Single operator, no concurrent second admin to push updates to; adds infra (sockets) with zero observable benefit for one person clicking sequentially | Simple refetch-on-action (refresh the row/detail after a mutation succeeds) is sufficient |
| i18n / localization framework for the admin screens | Common "future-proofing" ask for admin tools | PROJECT.md explicitly rules out i18n as unnecessary for this internal/study constraint | Hardcode Portuguese (matching the rest of the app) |
| Redesigning the existing Solicitações (approval requests) flow | Tempting to "clean up" while touching adjacent code | PROJECT.md explicitly marks this out of scope — it already works | Only relocate/embed it into the new screen's navigation; don't touch its internals |

## Feature Dependencies

```
User search / CPF lookup (table stakes)
    └──requires──> GET /admin/users, GET /admin/users/:cpf (already exist)
    └──enables──> Consolidated account snapshot (differentiator)
    └──enables──> Every per-user action group: block/unblock, limits, reset-password,
                   card-details, card purchase simulation, billing account status,
                   due-date adjustment

Grouped navigation (4 tabs matching API tag groups) (table stakes)
    └──requires──> nothing new — purely a frontend information-architecture decision
    └──enhances──> discoverability of all 35 routes vs. the current flat 833-line component

Confirmation dialog pattern (table stakes)
    └──requires──> nothing new (reusable component)
    └──applies to──> block/unblock, reset-password, force-cycle, due-date adjustment,
                     deposit, mass simulate

Inline JSON/response viewer (differentiator)
    └──requires──> simulation endpoints already returning structured calc data (they do)
    └──enhances──> pedagogical value of purchase/mass-simulation actions

Consolidated account snapshot (differentiator)
    └──requires──> User search / CPF lookup (table stakes)
    └──composes──> GET /admin/users/:cpf + GET billing/account/:cpf/status + card-details

Bulk multi-select for arbitrary actions (anti-feature)
    └──conflicts with──> the fact that only simulate-purchases/simulate-mass are
                          actually batch-shaped in the API — building generic bulk-select
                          UI has no corresponding backend capability for block/limits/etc.

Audit-log UI (anti-feature)
    └──conflicts with──> single-operator constraint (no second reader for the audit trail)
```

### Dependency Notes

- **Consolidated account snapshot requires User search:** you cannot show a combined status/limits/card/billing card without first resolving a CPF, so search must ship first (or in the same phase).
- **Grouped navigation enhances discoverability but has no hard dependency:** it can be built in parallel with/before the action-level work; it's the shell the other groups slot into.
- **Confirmation dialog is a shared component, not a per-group feature:** build it once, apply it everywhere a mutating call exists (roughly 25 of the 35 routes are mutating).
- **Bulk multi-select conflicts with actual API shape:** this is the clearest anti-feature — the impulse to add "select multiple rows" comes from generic admin-panel intuition, not from what the 35 routes actually support. Only `simulate-purchases`/`simulate-mass` are legitimately bulk.

## MVP Definition

### Launch With (v1)

Matches PROJECT.md's Active requirements — full coverage of all 4 groups in one pass (user explicitly rejected slicing by priority).

- [ ] New admin menu entry (role-gated) → dedicated screen, WEB + MOBILE — entry point is required before anything else is reachable
- [ ] Grouped navigation (4 sections matching Usuários / Cartões / Faturamento / Solicitações) — information architecture that everything else hangs off
- [ ] User search/lookup + consolidated detail view — prerequisite for ~20 of the 35 routes
- [ ] Usuários group: block/unblock, pix-limit, credit-limit, reset-password, generate-temp-password, deposit, card-details, fix — this is explicitly called out as missing in PROJECT.md
- [ ] Cartões e Autorizações group: purchase simulation (open/closed), delivery-status update, mass transaction simulation — PROJECT.md marks this **highest priority**, currently zero UI exists
- [ ] Faturamento group: billing config view/edit, force-cycle, due-date adjustment, account status, invoice status — PROJECT.md marks this as missing in UI today
- [ ] Solicitações group: relocate existing approval-request UI into the new screen (no redesign, per Out of Scope)
- [ ] Confirmation dialogs on all mutating actions
- [ ] Success/error feedback per action

### Add After Validation (v1.x)

- [ ] Inline JSON/response viewer for simulation results — add once the base simulation forms are working and it's clear which fields are most useful to surface
- [ ] Quick-repeat for simulation forms — add if manual re-testing of billing edge cases proves repetitive in practice
- [ ] Visual danger/neutral action treatment — polish pass once the functional surface is complete

### Future Consideration (v2+)

- [ ] Anything from the Anti-Features table — explicitly deferred indefinitely, not just "later." Revisit only if the project's scope constraint changes (e.g., multiple real operators are introduced).

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Admin menu entry + role gate | HIGH | LOW | P1 |
| Grouped navigation shell | HIGH | LOW | P1 |
| User search + detail lookup | HIGH | LOW-MEDIUM | P1 |
| Usuários group actions | HIGH | MEDIUM | P1 |
| Cartões/Autorizações group (simulate/authorize) | HIGH | MEDIUM-HIGH | P1 |
| Faturamento group actions | HIGH | MEDIUM | P1 |
| Solicitações relocation (no redesign) | MEDIUM | LOW | P1 |
| Confirmation dialogs (shared component) | HIGH | LOW | P1 |
| Consolidated account snapshot | MEDIUM | MEDIUM | P2 |
| Inline JSON/response viewer for simulations | MEDIUM | LOW-MEDIUM | P2 |
| Danger/neutral visual treatment | LOW-MEDIUM | LOW | P2 |
| Quick-repeat simulation forms | LOW | LOW | P3 |
| Audit log UI, RBAC granularity, bulk multi-select, analytics dashboard, i18n | LOW (negative — pure cost for this project) | HIGH | Not planned |

**Priority key:**
- P1: Must have for this milestone (matches PROJECT.md Active requirements exactly)
- P2: Should have, adds real value given project's pedagogical Core Value, low-medium cost
- P3: Nice to have, only if time remains

## Competitor Feature Analysis

Not applicable in the traditional sense — this is an internal tool with no market competitors. Instead, comparing against general back-office/admin-panel UX conventions surveyed:

| Pattern | Typical Enterprise Back-Office (e.g., Retool-built ops tools, ERP admin) | This Project's Approach |
|---------|---------------------------------------------------------------------|--------------------------|
| Bulk multi-select actions | Standard, expected | Skip — no matching batch endpoints except simulate-mass |
| Full audit trail with searchable log UI | Standard for compliance | Skip — no compliance need, single operator |
| RBAC with granular permissions | Standard for multi-operator teams | Skip — single `admin` boolean is sufficient per PROJECT.md |
| Grouped/tabbed navigation by domain area | Standard, universally recommended | Adopt — matches existing Swagger tag grouping |
| Confirmation on destructive actions | Standard, universally recommended | Adopt |
| Inline data/result inspection | Common in dev/ops tools, less common in generic CRUD admin | Adopt as differentiator — serves this project's pedagogical purpose (seeing IOF/juros/cashback calculations) |
| Low-code platform (Retool/Appsmith) | Increasingly common for exactly this use case | Skip — hard constraint requires native WEB+MOBILE with existing auth/component conventions |

## Sources

- Project-internal (HIGH confidence): `F:\GITHUB\FintechBankApp\.planning\PROJECT.md`, `F:\GITHUB\FintechBankApp\API\index.cjs` (direct grep of all `/admin/*` route definitions, lines 2476-5541)
- [Bulk action UX: 8 design guidelines with examples for SaaS](https://www.eleken.co/blog-posts/bulk-actions-ux) — MEDIUM confidence, general web
- [What is an Admin Panel? The Complete Guide for 2026 | Refine](https://refine.dev/blog/what-is-an-admin-panel/) — MEDIUM confidence, general web
- [Internal tools in 2026: admin panels, ops dashboards, and back-office automation | Basedash](https://www.basedash.com/blog/internal-tools-in-2026-admin-panels-ops-dashboards-and-back-office-automation) — MEDIUM confidence, general web
- [Best Practices for Managing Audit Trails in ERP | Blu Banyan](https://blubanyan.com/best-practices-for-managing-audit-trails-in-erp/) — MEDIUM confidence, general web (used to inform the audit-log anti-feature rationale, not to justify building one)
- [Best Practices for Usable and Efficient Data Table in Applications | UX Planet](https://uxplanet.org/best-practices-for-usable-and-efficient-data-table-in-applications-4a1d1fb29550) — MEDIUM confidence, general web

---
*Feature research for: internal fintech admin/back-office panel*
*Researched: 2026-07-19*
