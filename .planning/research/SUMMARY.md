# Project Research Summary

**Project:** FintechBankApp — Admin/Back-Office Panel milestone
**Domain:** Internal admin/back-office UI for a fintech study app (WEB React + MOBILE Ionic/Capacitor, mirrored, on top of an already-built REST API)
**Researched:** 2026-07-19
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone builds a comprehensive internal admin panel on top of ~33-35 already-built and already-tested `/admin/*` REST routes, spanning four functional groups (Usuários, Cartões e Autorizações de Compra, Faturamento, Solicitações). It is not greenfield: the stack, architecture idiom, and even a partial UI (`Admin.tsx`, 833 lines) already exist and set clear conventions. Experts building this kind of tool compose it from lightweight, headless building blocks (TanStack Table, react-hook-form + zod, native `<dialog>`/`IonAlert`) rather than pulling in a heavy admin framework or component library — matching this project's explicit "no new heavy dependency" constraint. The right approach is a new `AdminPanel.tsx` shell (state-based internal tab switching, not React Router nesting, to match the app's existing `Dashboard.tsx` idiom) hosting four section components, built first on WEB then ported file-for-file to MOBILE, following the codebase's deliberate duplicated-frontend-trees convention.

The recommended approach: extend the existing `admin<Verb><Noun>` API client convention in `services/api.ts` (+ mandatory `mockApi.ts` parity stubs for the GitHub Pages demo build), extract-and-reuse the already-working Solicitações approval flow rather than rebuilding it, and build one shared confirmation/mutation hook from day one that bakes in double-submit protection and refetch-after-mutation. Data tables render as HTML `<table>` + Tailwind on WEB but as `IonList`/`IonItem` on MOBILE — same TanStack Table headless core, different markup per platform's idiom.

The key risk cluster is safety-of-action, not technology: none of the 33 admin routes have idempotency protection, several destructive/mass-blast-radius actions have no confirmation step today, admin routes use a single JWT with no step-up auth (and one route, `/admin/simulate-purchases`, already has an inconsistent auth-check pattern), and 67 places in `API/index.cjs` build SQL via string interpolation with inconsistent escaping. This milestone is explicitly frontend-only (no backend route changes), so mitigation is UI-layer: disabled/loading states, a friction-laddered confirmation component (light vs. heavy vs. scope-preview-for-bulk), client-side input validation as a stopgap for the SQL-interpolation risk, and explicit sign-off recorded in the roadmap for the pitfalls not being fixed this milestone (SQL interpolation, `/admin/simulate-purchases` auth inconsistency, no PIN/step-up on admin routes).

## Key Findings

### Recommended Stack

The existing WEB/MOBILE stack (React 19.2, TypeScript 5.8, Vite 6.2, Tailwind 4.3, Ionic React 8.7 on MOBILE) already covers almost everything needed. Three genuinely new/added libraries fill real gaps: a headless data-table library, a form/validation library, and (on WEB only) parity with MOBILE's existing input-masking library. No component library or admin framework is introduced — that would conflict with the project's Tailwind-first styling and its explicit "no new heavy dependency" constraint.

**Core technologies:**
- TanStack Table `^8.x` (stable, not v9-beta): headless sort/filter/pagination state for admin lists — renders nothing itself, styled with existing Tailwind on WEB, rendered as `IonList`/`IonItem` on MOBILE
- react-hook-form `^7.66.x` + zod `^4.1.x` + `@hookform/resolvers` `^5.2.x`: form state/validation for ~10+ dense admin forms (billing config, limit adjustment, etc.), single schema shared between validation and TypeScript types
- Native `<dialog>` (WEB) / `IonAlert`+`IonActionSheet` (MOBILE, already installed): confirmation dialogs with zero or near-zero new dependency, built-in accessibility (focus trap, `aria-modal`)
- `react-imask` `^7.6.x` (add to WEB to match MOBILE): masked currency/CPF-style inputs, keeping WEB↔MOBILE form-input parity

### Expected Features

Feature scope is fixed by the existing API surface (~35 routes across 4 groups) and PROJECT.md's explicit "build all four groups in one pass, no priority slicing" decision — though Cartões e Autorizações is called out as highest-priority since zero UI exists for it today.

**Must have (table stakes):**
- CPF/user search + lookup feeding a consolidated detail view (prerequisite for ~20 of 35 routes)
- Grouped navigation matching the 4 API tag groups (replaces the flat 833-line `Admin.tsx` shape)
- Confirmation dialog on every mutating action, with read-only current-state display before the action
- Success/error feedback per action, loading/disabled states during in-flight requests
- Role gate at menu + route level, WEB↔MOBILE parity for every screen

**Should have (differentiators):**
- Danger vs. neutral visual treatment for money-moving vs. read actions
- Inline JSON/response viewer for simulation endpoints (serves the app's pedagogical purpose)
- Consolidated account snapshot (composes 3 existing GETs into one card)
- Quick-repeat for simulation forms

**Defer / explicitly out of scope (anti-features):**
- RBAC beyond the single `admin` boolean, full audit-log UI, undo/redo, generic bulk multi-select (only `simulate-mass`/`reset-users` are legitimately bulk), analytics dashboard, low-code platform, i18n, redesigning the existing Solicitações flow

### Architecture Approach

Follow the existing app pattern exactly: an `AdminPanel.tsx` top-level screen (mirrored WEB + MOBILE, role-guarded) hosting internal `useState`-driven tab switching across four section components (`AdminUsers`, `AdminCardsAuth`, `AdminBilling`, `AdminRequests`), reached via a new conditional 6th `BottomNavBar` icon. No React Router nesting, no new global state (Redux/Zustand/Context) — each section owns local component state exactly like the existing `Admin.tsx`. No shared WEB/MOBILE package — build on one platform, port file-for-file to the other, per the project's deliberate duplicated-frontend-trees convention.

**Major components:**
1. `AdminPanel.tsx` (NEW, both platforms) — shell, role guard, tab state, overview stats
2. `AdminUsers.tsx` / `AdminCardsAuth.tsx` / `AdminBilling.tsx` (NEW) — the three functional groups with zero-to-partial existing frontend code
3. `AdminRequests.tsx` (extracted, not rebuilt) — lifts the already-working approval-flow logic out of `Admin.tsx`
4. `services/api.ts` + `mockApi.ts` (extended, both platforms) — ~12-14 new `admin<Verb><Noun>` functions, each with a mandatory mock parity stub

### Critical Pitfalls

1. **No idempotency/double-submit protection on money-moving actions** — none of the 33 routes dedupe; mitigate with a shared mutation hook that disables buttons on click and re-enables on response, built into the first admin-UI phase so every later phase inherits it.
2. **Missing confirmation on destructive/high-blast-radius actions** — apply a friction ladder (light confirm for reversible single-user actions, heavy named-target confirm for irreversible ones, scope-preview confirm for bulk/mass actions like `simulate-mass`/`reset-users`).
3. **Admin routes have no step-up auth and one inconsistent auth pattern** (`/admin/simulate-purchases` skips the shared `authenticateAdmin` middleware) — standardize the middleware on any route touched this milestone; compensate in UI with a visible admin-mode indicator and universal confirmation, since PIN-gating is out of scope.
4. **Raw SQL string interpolation on the exact routes the new UI will drive hardest** — an API-layer issue, not fixable in this frontend-only milestone; mitigate with client-side input validation/whitelisting and record it as accepted, explicit debt in the roadmap.
5. **Stale data across WEB/MOBILE and even within the admin's own list/detail views after a mutation** — bake "refetch affected row after mutation" into the same shared action hook used for idempotency guards.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Admin Shell + Shared Action Infrastructure
**Rationale:** Everything else depends on the navigation shell, role gate, and the shared confirmation/mutation/idempotency hook — building these first means every subsequent phase inherits double-submit protection, confirmation UX, and refetch-after-mutation for free instead of retrofitting it later.
**Delivers:** `AdminPanel.tsx` (WEB + MOBILE), extended `BottomNavBar`, role guard, shared `ConfirmDialog`/`IonAlert` wrapper with light/heavy/scope-preview variants, shared mutation hook (disable-on-click, refetch-on-success)
**Addresses:** Grouped navigation, role gate, confirmation dialogs, loading/disabled states (table stakes)
**Avoids:** Pitfall 1 (idempotency), Pitfall 2 (missing confirmation), Pitfall 5 (stale data) — by centralizing the fix once

### Phase 2: Usuários Group + User Search/Detail
**Rationale:** User search/lookup is a hard prerequisite for ~20 of 35 routes and for the Cartões/Faturamento groups that act on a selected CPF; ships alongside the group PROJECT.md flags as currently missing UI.
**Delivers:** CPF search + consolidated detail view, block/unblock, PIX/credit limit adjustment, password reset/temp password, deposit, card-details lookup (masked)
**Addresses:** User search (table stakes), consolidated account snapshot (differentiator)
**Avoids:** Security Mistake — masking another user's raw CVV/PIN/PAN in the card-details view (never expose beyond what's needed)

### Phase 3: Cartões e Autorizações de Compra
**Rationale:** PROJECT.md's explicit highest-priority group — zero existing frontend code today, and the group with the largest double-submit risk (purchase simulation, mass transaction simulation).
**Delivers:** Purchase authorization simulation (open/closed), delivery-status update, mass transaction simulation with scope preview
**Uses:** Shared mutation hook and confirmation component from Phase 1
**Implements:** `AdminCardsAuth.tsx`
**Avoids:** Pitfall 1 (double-submit on simulate-purchases) and Pitfall 6 (bulk blast radius on simulate-mass)

### Phase 4: Faturamento
**Rationale:** Depends on the same CPF-selection pattern established in Phase 2; force-cycle and due-date adjustment are financially sensitive and benefit from the confirmation infrastructure already in place.
**Delivers:** Billing config view/edit, force invoice cycle, due-date adjustment, account/invoice status views
**Uses:** react-hook-form + zod for the multi-field billing config form
**Avoids:** Pitfall 2 heavy-confirm tier for force-cycle (irreversible, high blast radius)

### Phase 5: Solicitações Relocation + Cleanup
**Rationale:** Explicitly out of scope to redesign — sequence last since it's pure extraction/porting, and finalizing the old `Admin.tsx` retirement decision only makes sense once the new panel has full feature parity (avoids a window where admin functionality regresses).
**Delivers:** `AdminRequests.tsx` extracted from `Admin.tsx` and wired into `AdminPanel`; decision on retiring/redirecting the old `Admin.tsx` entry point
**Addresses:** Solicitações group (table stakes, no redesign)
**Avoids:** Anti-Pattern 1 (rebuilding a working flow from scratch)

### Phase Ordering Rationale

- User search/detail (Phase 2) must precede Cartões and Faturamento since both groups act on a selected CPF and should reuse one search box rather than three.
- The shared confirmation/mutation hook is built once in Phase 1 specifically so pitfalls 1, 2, and 5 don't need re-solving in every later phase — this is the single highest-leverage architectural decision from the research.
- Cartões e Autorizações is sequenced before Faturamento to match PROJECT.md's explicit priority ordering (currently zero UI exists there) despite the "build everything" scope.
- Solicitações relocation is last because it's a pure extraction with no new backend dependency and its cleanup decision (retire old `Admin.tsx`?) is safest to finalize once the new panel has full parity.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Cartões e Autorizações):** highest financial/security risk group (double-submit, purchase-authorization semantics) — worth a focused pitfall/UAT review during `/gsd-plan-phase --research-phase`.
- **Phase 1 (Shared infrastructure):** the shared mutation/confirmation hook design has no existing precedent in this codebase (existing `Admin.tsx` has no such hook) — worth validating the hook's API shape before it's used across 4 phases.

Phases with standard patterns (skip research-phase):
- **Phase 2, 4, 5:** directly extend already-established patterns (`admin<Verb><Noun>` API convention, CPF search UI already in `Admin.tsx`, extract-not-rebuild for Solicitações) — low ambiguity, well-documented in ARCHITECTURE.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Version numbers and compatibility cross-checked via web search against official docs/GitHub releases; installed-dependency facts are HIGH (read directly from package.json) |
| Features | MEDIUM-HIGH | Grounded directly in the project's own ~35 existing routes and PROJECT.md; external UX pattern claims are well-established industry consensus |
| Architecture | HIGH | Derived entirely from direct codebase inspection (App.tsx, Dashboard.tsx, Admin.tsx, AuthContext.tsx, api.ts, API/index.cjs) — no external research needed |
| Pitfalls | MEDIUM | Codebase-specific findings (missing middleware, SQL interpolation, missing idempotency) are HIGH confidence, verified directly in `API/index.cjs`; general best-practice claims are MEDIUM, web-sourced |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Old `Admin.tsx` fate (keep as thin wrapper vs. retire/redirect):** Architecture research explicitly flags this as unresolved — decide in Phase 5 planning, not before, to avoid an admin-functionality regression window.
- **SQL-interpolation and `/admin/simulate-purchases` auth-inconsistency fixes:** both are API-layer issues outside this milestone's frontend-only scope — the roadmap should record an explicit "accepted as debt, not fixing this milestone" decision rather than silently inheriting the risk.
- **Whether `/admin/users` supports pagination:** Performance Traps section flags this as unconfirmed — verify before building the Usuários list UI in Phase 2, add client-side pagination if the API doesn't support it server-side.
- **Whether existing end-user screens (Profile/HomeView) already refetch-on-focus:** needed to know whether stale-data mitigation (Pitfall 5) is purely an admin-side concern or also needs end-user-side verification — check during Phase 2/4 planning.

## Sources

### Primary (HIGH confidence)
- Direct inspection of `WEB/package.json`, `MOBILE/package.json` — installed dependency versions
- Direct inspection of `WEB/App.tsx`, `MOBILE/src/App.tsx`, `Dashboard.tsx`, `BottomNavBar.tsx`, `Admin.tsx`, `AuthContext.tsx`, `services/api.ts` — existing architecture/navigation/API-client patterns
- `API/index.cjs` (lines ~2476-5541) — full `/admin/*` route inventory, auth middleware inconsistency, SQL interpolation instances
- `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONCERNS.md` — project constraints and known tech debt

### Secondary (MEDIUM confidence)
- TanStack Table, react-hook-form, `@hookform/resolvers`, Ionic Framework official docs — version/compatibility/API behavior
- Native `<dialog>` element browser-support and accessibility articles
- Bulk-action UX, audit-trail best practice, admin-panel UX pattern articles (Eleken, Refine, Basedash, UX Planet)
- Idempotency-in-payments and destructive-action confirmation UX articles (Cockroach Labs, GitLab Pajamas, LogRocket, SaaS UI Design)
- PCI DSS PAN/CVV masking guidance articles

---
*Research completed: 2026-07-19*
*Ready for roadmap: yes*
