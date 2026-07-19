# Pitfalls Research

**Domain:** Internal admin/back-office panel for money-moving fintech operations (WEB + MOBILE, study app on real PostgreSQL-backed API)
**Researched:** 2026-07-19
**Confidence:** MEDIUM (industry best-practice claims are web-sourced/cross-checked; codebase-specific findings are HIGH — verified directly against `API/index.cjs`)

## Critical Pitfalls

### Pitfall 1: No idempotency protection on money-moving admin actions

**What goes wrong:**
An admin double-clicks "Forçar Ciclo de Fatura", "Simular Compra", or "Aprovar Solicitação de Limite" (slow network, impatient re-click, mobile tap registering twice) and the action executes twice — duplicate simulated purchases, a fatura billed twice, a limit increase applied twice.

**Why it happens:**
None of the ~33 `/admin/*` routes in `API/index.cjs` (verified: `/admin/simulate-purchases`, `/admin/users/:cpf/card/purchase/open|closed`, `/admin/invoices/engine/force-cycle`, `/admin/transactions/simulate-mass`, `/admin/requests/limit/:cpf/approve`, etc.) accept or check an idempotency key, and there are no unique constraints preventing a second identical INSERT. Every POST is a plain "run it again" endpoint. This is the same failure mode payment APIs solve with `Idempotency-Key` headers (Stripe-style) — absent here entirely.

**How to avoid:**
- Disable the trigger button immediately on click (optimistic disable) and re-enable only after the response returns or errors — do this in the new admin UI regardless of API changes.
- For the highest-risk actions (force-cycle, simulate mass transactions, card purchase authorization), generate a client-side idempotency key per "intent" (e.g. UUID stored in component state until success) and pass it through; if API changes are in scope for this milestone, add a light dedup check server-side (e.g. reject duplicate `(route, cpf, params-hash)` within N seconds).
- At minimum, treat every mutating button in the new UI as "networked, so it will be double-fired" and design the loading/disabled state accordingly — this is a UI-only mitigation that doesn't require API changes.

**Warning signs:**
- QA sees two identical simulated transactions/faturas after a single admin click during a slow network test.
- No `disabled` state on submit buttons while a request is in flight, in code review.

**Phase to address:**
Phase covering the "Cartões e Autorizações de Compra" group (highest priority per PROJECT.md) and any phase touching Faturamento force-cycle — bake button-level double-submit guards into the shared admin action/mutation hook used by both WEB and MOBILE from the start, so every subsequent phase inherits it for free.

---

### Pitfall 2: Missing confirmation on destructive/high-blast-radius admin actions

**What goes wrong:**
Actions like "Bloquear Usuário", "Forçar Ciclo de Fatura", "Reset de Senha Administrativo", and especially `/admin/reset/users` and `/admin/transactions/simulate-mass` (which by name affect many users at once) execute immediately on click with no "are you sure" step — an admin exploring the new screen for the first time can lock out a real test user or corrupt billing state for many accounts in one misclick.

**Why it happens:**
Admin UIs are built for internal/trusted users, so confirmation dialogs get treated as "not needed since it's just us" — but that reasoning applies less, not more, to bulk/irreversible actions, because internal tools get fewer safety rails from users being careful (they trust the tool).

**How to avoid:**
Apply a friction ladder, not a blanket "confirm everything":
- **Light confirm** (single dialog, named target): block/unblock user, approve/deny limit or password request, adjust a single user's limit.
- **Heavy confirm** (name the CPF/user being affected, state the irreversible consequence explicitly, danger-styled button labeled with the real verb — "Bloquear compras de {nome}", not "OK"): force invoice cycle, reset password, card purchase authorization.
- **Extra guard for mass/global actions**: `/admin/reset/users` and `/admin/transactions/simulate-mass` should require an explicit scope selection (which users / "all users") shown back to the admin before the final confirm, not a single generic "confirm" click — these are the actions with the largest blast radius in the entire admin surface.
- Never auto-focus the destructive confirm button; keep "cancel" as the easy default.

**Warning signs:**
- Any mutating admin button wired directly to an API call with no intermediate dialog/step.
- Bulk-action routes reachable from a single click with no preview of affected scope (how many users, which ones).

**Phase to address:**
Every phase that ships a mutating admin action needs this as an explicit UAT criterion — define the shared confirmation component (light vs. heavy variant) in the first admin-UI phase so later phases (Faturamento, Usuários, Solicitações) reuse it rather than reinventing ad hoc `window.confirm()` calls per screen.

---

### Pitfall 3: Admin panel becomes the highest-leverage attack surface — no PIN/step-up, one inconsistent authorization pattern already found in code

**What goes wrong:**
User-facing money-moving endpoints in this app require PIN (per project constraints). Admin routes require only `bearerAuth() + authenticateAdmin` — a single JWT, no second factor — yet admin routes can move money, authorize card purchases, force billing cycles, and change any user's limits for *any* CPF. Building a full-featured, easy-to-use UI on top of this means a single compromised/weak admin credential (the project's own `CONCERNS.md` already flags a hardcoded `admin999` reset script with `postgres`/`postgres` DB fallback) goes from "attacker has to hand-craft raw HTTP requests via Swagger" to "attacker has a polished UI with buttons for every money-moving action." **Also found directly in code:** `/admin/simulate-purchases` (API/index.cjs:2951) does NOT use the shared `authenticateAdmin` middleware like the other 24 admin routes — it only has `bearerAuth()` plus an inline `if (req.user.role !== 'admin')` check. Functionally equivalent today, but it's a second, hand-rolled authorization pattern sitting next to the standard one — exactly the kind of inconsistency that gets copy-pasted into a new route later and shipped without the check.

**Why it happens:**
"It's just a study app / internal tool" reasoning is used to justify skipping step-up auth, and once one route uses an ad hoc check instead of the shared middleware, future routes copy whichever example the author finds first in the file.

**How to avoid:**
- Do not silently accept `bearerAuth()`-only patterns as equivalent to `authenticateAdmin` — if any new/adjusted admin route is touched in this milestone, standardize it on the shared middleware.
- Since PIN-gating admin routes is out of scope per PROJECT.md constraints (no production hardening beyond what exists), compensate in the UI layer: session timeout for the admin screen, a visible "you are in admin mode" banner, and routing every mutating action through the confirmation component from Pitfall 2 — these are cheap mitigations that don't touch the API.
- Flag the `admin999` reset script risk to the user explicitly if the new UI makes admin login the single point of failure for the whole money-moving surface (it does).

**Warning signs:**
- Any new/edited admin route in this milestone that doesn't chain `bearerAuth(), authenticateAdmin` in that order.
- No visible UI affordance indicating "these actions move real (test) money and are not reversible via UI."

**Phase to address:**
Address in the discovery/setup phase before building the Cartões e Autorizações screens (highest financial risk group) — decide explicitly whether to fix the `/admin/simulate-purchases` middleware inconsistency as part of this milestone or document it as accepted debt.

---

### Pitfall 4: Raw SQL string interpolation on the exact routes the new UI will drive hardest

**What goes wrong:**
`API/index.cjs` builds SQL via template-literal string interpolation in 67 places, including admin routes taking `cpf`, `targetCpf`, `scenario`, `dueDate`, `invoiceDueDate` directly from `req.params`/`req.body` (e.g. `/admin/simulate-purchases` interpolates `targetCpf` straight into a `SELECT ... WHERE cpf = '${targetCpf}'`; `/admin/users/:cpf/card-details` interpolates `dueDate`/`invoiceDueDate` with only ad hoc `.replace(/'/g, "''")` escaping on some fields and none on others). Building a comprehensive UI that exercises every one of these routes constantly, from every admin session, doesn't create the SQL injection risk (it already exists) — but it dramatically increases how often these code paths execute and how much surface a compromised/careless admin session can reach in one workflow.

**Why it happens:**
Pre-existing pattern in a monolithic 5,700-line file (already flagged in `CONCERNS.md` as tech debt) — escaping is applied inconsistently, field by field, wherever someone happened to think of it.

**How to avoid:**
- This is primarily an API-layer fix (parameterized queries / `repoContext.esc()` consistently, per the one place in the file that already does it correctly at line 2879), not a UI fix — flag it as a candidate for a dedicated hardening phase or at minimum route-by-route as each admin group is wired into the new UI.
- At minimum, when building the new UI, validate/whitelist input client-side (CPF format, numeric fields, enum values like `scenario`) before submission — this doesn't fix the server but shrinks the practical exploit surface reachable through the new UI specifically.

**Warning signs:**
- Any new admin UI field that free-types a value later interpolated server-side without validation.
- Code review of any admin route touched in this milestone shows string interpolation instead of parameterized queries or the `esc()` helper.

**Phase to address:**
Not a blocker for UI work, but should be an explicit "known risk, not fixing in this milestone" decision recorded in ROADMAP/PROJECT.md rather than silently inherited — call it out in the phase that first touches Faturamento or Usuários routes (highest density of string-interpolated fields).

---

### Pitfall 5: Stale data across WEB/MOBILE after an admin action

**What goes wrong:**
An admin blocks a user, approves a limit request, or forces an invoice cycle from the new admin screen. The affected end-user's own WEB or MOBILE session (or the admin's own other open tab/device) keeps showing the pre-action state — user still sees their card as unblocked, or the old limit — until a manual refresh, because there's no push/invalidation channel between the API mutation and other open clients.

**Why it happens:**
This app already has a mirrored WEB↔MOBILE architecture with independent state per client and no evident real-time invalidation layer; each admin mutation is a fire-and-forget POST with no broadcast to affected sessions. This is a standard multi-frontend staleness problem, worse here because the *purpose* of several admin actions (block user, approve limit) is to change what the affected user is immediately allowed to do.

**How to avoid:**
- Do not promise or design for real-time cross-session sync in this milestone (out of scope per PROJECT.md — single internal admin, no multi-operator requirement) — but do make sure the *admin's own* UI reflects the action immediately (refetch the affected user's row/list after every mutation rather than relying on optimistic local state alone).
- For the affected end-user's own session, rely on existing polling/refetch-on-focus patterns already in the app rather than introducing a new sync mechanism — verify what already exists (e.g. does `Profile.tsx`/`HomeView.tsx` refetch on screen focus?) before assuming it's fine.
- Document this as a known limitation ("action takes effect on next user refresh/login") rather than letting QA discover it as a bug.

**Warning signs:**
- Admin blocks a user, then re-opens the same user's detail row in the admin list and still sees "not blocked" without a manual reload.
- End-to-end test flow: admin approves a limit request in one session, user's own session doesn't reflect it without refresh — decide if that's acceptable and say so explicitly.

**Phase to address:**
Address at minimum for the admin's own UI (list/detail consistency) in each phase that ships a mutating action — make "refetch after mutation" part of the shared action hook from Pitfall 1, not each screen's own responsibility.

---

### Pitfall 6: Bulk/mass-action routes with no scoping preview

**What goes wrong:**
`/admin/transactions/simulate-mass` and `/admin/reset/users` operate on many users in one call. Without a preview of exactly who/what will be affected before confirming, an admin can trigger a much larger blast radius than intended — e.g. resetting more test users than expected, or generating mass simulated transactions across the whole user base instead of a target subset.

**Why it happens:**
Mass-action endpoints are convenient for bulk test-data generation, but the UI temptation is to expose them as a single button with a generic "Run" action, since "it's just test data."

**How to avoid:**
Require the UI to show the resolved scope (count and/or list of affected CPFs) before the final confirm for any bulk action, and use the heavy-confirm pattern from Pitfall 2. Prefer scoped inputs (specific CPFs or an explicit, visible "ALL USERS" toggle) over an implicit "affects everyone" default.

**Warning signs:**
- A bulk-action button with no "this will affect N users" preview text before submit.

**Phase to address:**
Faturamento/Solicitações phase or wherever `/admin/transactions/simulate-mass` and `/admin/reset/users` get UI coverage — treat as the highest-blast-radius actions in the whole admin surface alongside force-cycle.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Skip idempotency keys, rely only on UI disabled-state | Faster to ship | Occasional duplicate test data if UI guard is bypassed (e.g. two tabs) | Acceptable for this study-app milestone if UI-level guard is implemented consistently |
| Reuse existing `Admin.tsx` (Profile→Admin, 833 lines) patterns as reference instead of designing new components | Faster initial screens | Risk of copying the ad hoc, unconfirmed mutation patterns already in that file into the new, more comprehensive screen | Never for the money-moving groups (Cartões/Faturamento) — always add confirmation there even if the old screen lacks it |
| Skip client-side input validation on admin forms, rely on API validation only | Less UI code | Directly widens the practical exploit surface for Pitfall 4 (SQL interpolation) since the UI is now the primary caller | Never for free-text fields (CPF, dates, scenario names) feeding known string-interpolated routes |
| Leave `/admin/simulate-purchases`'s ad hoc auth check as-is rather than migrating to `authenticateAdmin` | Zero API changes needed | Standing inconsistency that could get copy-pasted minus the inline check into a future route | Acceptable only if explicitly documented as accepted debt, not silently ignored |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| WEB ↔ MOBILE mirrored components | Building the new admin screen twice from scratch, independently, causing behavior drift (e.g. confirmation dialog present on WEB, missing on MOBILE) | Design the shared mutation/confirmation/idempotency-guard logic once (as a spec/contract), implement per-platform following the existing "mirrored" pattern the project already uses |
| Old `Admin.tsx` (Profile→Admin) vs. new dedicated admin screen | Two parallel UIs calling the same admin routes with different guardrails (one confirms, one doesn't) | Either retire/redirect the old screen's mutating actions to the new components, or explicitly audit that both apply the same idempotency/confirmation rules — don't leave two independently-evolving front doors to the same money-moving routes |
| Existing verbose request logging (`console.log(JSON.stringify(req.body))` on validation failure, per CONCERNS.md) | Admin actions now routed through polished UI forms will trigger this same logging path on any validation failure, potentially logging generated temp passwords, CPFs, or amounts in plaintext | Treat this as in-scope risk if admin routes hit validation failures often during UI development; redact sensitive fields before logging or fix alongside this milestone if convenient |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Admin list screens (Usuários, Solicitações) fetching full user objects with no pagination | Slow admin screen as test-user count grows | Confirm `/admin/users` supports pagination/filtering before building the list UI around it; add client-side pagination if not | Noticeable once test-user seed data exceeds a few hundred rows — plausible in a long-lived study app with repeated seeding |
| Re-fetching entire user list after every single mutation (per Pitfall 5's fix) | UI feels sluggish on rapid sequential admin actions (e.g. approving many limit requests in a row) | Refetch only the single affected row/user where the API supports it (`GET /admin/users/:cpf`) instead of the whole list | Only relevant once list size grows; low risk at expected internal-tool scale |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating admin routes as equally trusted as user routes despite no PIN/step-up | A single stolen/weak admin session (see `admin999` reset script) can move money, authorize purchases, and block any user with no second factor | Compensate in UI: visible admin-mode indicator, confirmation on all mutations, and flag the weak-credential reset script as a real risk now that a UI makes it exploitable end-to-end, not just via API |
| Inconsistent authorization middleware (`authenticateAdmin` vs. ad hoc inline role check) across admin routes | Future route additions may copy the wrong example and ship without any admin check at all | Standardize on `authenticateAdmin` for every route this milestone touches or adds |
| String-interpolated SQL on routes the new UI will call constantly | SQL injection reachable through admin form fields (CPF, dates, scenario) | Client-side format validation as a stopgap; flag server-side parameterization as separate hardening work |
| Full card data (`card_number`, `cvv`, `pin`) already returned in plaintext by `GET /cards/my-cards` for the card's own owner | Not a new admin-panel risk, but worth confirming the new admin UI does NOT add a way to view another user's raw CVV/PIN — verified no current admin route exposes another user's card_number/cvv/pin in this codebase, so any new "card details" admin screen must not introduce one | When building the "consulta de detalhes de cartão" admin screen (explicitly requested in PROJECT.md), mask PAN/CVV/PIN by default even though a real end-user can already see their own — admin viewing *someone else's* full card secrets is a materially different exposure |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| No visual distinction between "safe" read actions and money-moving actions in a single dense admin screen covering all ~33 routes | Admin misclicks a destructive action while scanning a busy table | Group by risk (per PROJECT.md's own 4 groups), and visually separate/color mutating buttons from read-only ones within each group |
| Generic success/error toasts with no detail on what changed | Admin can't verify the action did what was intended (e.g. did the invoice cycle actually run for the right user?) | Show the concrete result (new due date, new limit value, new block status) in the confirmation/success feedback, not just "Success" |
| Building all ~33 routes in v1 with equal design effort (per PROJECT.md's explicit "no slicing by priority" decision) | Risk of shipping the high-priority Cartões/Autorizações group with less polish/safety if effort is spread evenly instead of risk-weighted | Even though scope is "all at once," sequence *design attention* (confirmation patterns, idempotency guards) toward the money-moving groups first regardless of build order |

## "Looks Done But Isn't" Checklist

- [ ] **Force invoice cycle button:** Often missing a confirmation step and a way to see which invoice/user it will affect before running — verify a preview or named-target confirm exists, not just a bare button.
- [ ] **Block/unblock user:** Often missing feedback loop showing the user is *actually* blocked now (re-fetch after mutation) — verify the admin list/detail view updates immediately, not just a toast.
- [ ] **Simulate/authorize card purchase (credit & debit):** Often missing double-submit protection given it's the highest-priority, most-clicked-during-testing group — verify rapid repeated clicks don't create duplicate transactions.
- [ ] **Mass transaction simulation / reset users:** Often missing scope preview (how many/which users affected) — verify the UI shows resolved scope before the final confirm.
- [ ] **Approve/deny limit & password requests:** Already functional per PROJECT.md, but verify the *new* screen surfacing them doesn't silently drop the existing PIN/validation behavior when re-implemented in the new UI.
- [ ] **Card details view:** Often assumed "read-only, so no risk" — verify it doesn't expose another user's raw CVV/PIN even though the user's own `/cards/my-cards` does.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Duplicate money-moving action from double-submit | LOW | Study-app data — manually delete/adjust the duplicate transaction/invoice row via existing admin tools or direct DB access; no real financial/regulatory exposure |
| Admin accidentally blocks/resets the wrong user | LOW | Unblock/reset again via the same admin screen; low cost since it's reversible through the same UI |
| Mass action run with wrong scope (e.g. reset-users hit more users than intended) | MEDIUM | Requires DB-level restore or re-seeding affected test users; higher cost if seed data isn't easily regenerable |
| SQL injection exploited through an admin form field | HIGH | Full incident response even in a study app if DB integrity/credentials are compromised — treat prevention (Pitfall 4) as cheaper than recovery |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| No idempotency / double-submit protection | First admin-UI phase (shared action/mutation hook), reinforced in Cartões e Autorizações phase | Rapid double-click test on every mutating button; verify only one write occurs |
| Missing confirmation on destructive actions | First admin-UI phase (shared confirmation component), applied per-group | UAT checklist: every mutating action has a light or heavy confirm matching its risk tier |
| Admin-as-highest-leverage-surface / auth inconsistency | Setup/discovery phase, before Cartões e Autorizações | Code review confirms every touched admin route uses `authenticateAdmin`; explicit decision recorded on `admin999` risk |
| Raw SQL interpolation on UI-driven routes | Flagged in setup phase; addressed opportunistically per-group or deferred with explicit sign-off | Client-side validation present on all free-text fields feeding string-interpolated routes; decision documented if deferred |
| Stale data across WEB/MOBILE after action | Baked into shared action hook (refetch-after-mutation) from the first admin-UI phase | Admin list/detail reflects new state immediately after action without manual reload |
| Bulk/mass-action blast radius | Faturamento/Solicitações phase covering `simulate-mass` and `reset/users` | Scope preview shown and confirmed before execution; tested with a deliberately large scope selection |

## Sources

- [Idempotency's role in financial services](https://www.cockroachlabs.com/blog/idempotency-in-finance/) — MEDIUM confidence (cross-checked pattern, industry standard)
- [Idempotency for Payments: Preventing Double Charges](https://medium.com/@tatomoaki/idempotency-for-payments-preventing-double-charges-8e58aed88b93) — MEDIUM confidence
- [SaaS Destructive Actions & Confirmation UX Patterns](https://www.saasui.design/blog/saas-destructive-actions-confirmation-ux-patterns) — MEDIUM confidence
- [Pajamas Design System — Destructive actions (GitLab)](https://design.gitlab.com/patterns/destructive-actions/) — MEDIUM confidence
- [Double-check user actions: warning message UI — LogRocket](https://blog.logrocket.com/ux-design/double-check-user-actions-confirmation-dialog/) — MEDIUM confidence
- [PCI DSS Masking Requirements](https://blog.rsisecurity.com/pci-dss-masking-requirements/) — MEDIUM confidence
- [PCI DSS PAN Masking guide](https://www.strac.io/blog/pci-dss-pan-masking) — MEDIUM confidence
- [7 Best Practices for Privileged User Monitoring](https://www.teramind.co/blog/privileged-user-monitoring/) — MEDIUM confidence
- [Audit Logging Best Practices — Sonar](https://www.sonarsource.com/resources/library/audit-logging/) — MEDIUM confidence
- [Common Caching Problems at Scale](https://medium.com/@stackshala/common-caching-problems-at-scale-a-guide-for-backend-developers-145f680fe10d) — MEDIUM confidence
- Direct codebase inspection (HIGH confidence — verified in this session):
  - `F:\GITHUB\FintechBankApp\API\index.cjs` — all ~25 `/admin/*` route declarations (lines 2476–3621, 5541)
  - `F:\GITHUB\FintechBankApp\API\index.cjs:2951` — `/admin/simulate-purchases` missing `authenticateAdmin` middleware (ad hoc inline check instead)
  - `F:\GITHUB\FintechBankApp\API\index.cjs:2792-2836` — `/admin/users/:cpf/card-details` inconsistent SQL escaping
  - `F:\GITHUB\FintechBankApp\API\index.cjs:2919-2945` — `GET /cards/my-cards` returns raw `card_number`, `cvv`, `pin` to the card's own owner (baseline for comparison against admin routes)
  - `F:\GITHUB\FintechBankApp\API\index.cjs:2541-2594` — `GET /admin/users/:cpf` via `normalizeUser()` (lines 92-152) confirmed to NOT expose raw card_number/cvv/pin
  - `.planning/codebase/CONCERNS.md` — weak default credential reset script, verbose request logging, monolithic `index.cjs`, thin WEB/MOBILE test coverage
  - `.planning/PROJECT.md` — admin route grouping, PIN/bearerAuth+authenticateAdmin constraint, WEB↔MOBILE parity requirement

---
*Pitfalls research for: Internal admin panel, fintech study app (WEB + MOBILE + PostgreSQL API)*
*Researched: 2026-07-19*
