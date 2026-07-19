# Architecture Research

**Domain:** Internal admin panel UI added to an existing mirrored WEB (React 19 + Vite) / MOBILE (Ionic/Capacitor) fintech study app
**Researched:** 2026-07-19
**Confidence:** HIGH — every finding below is derived directly from reading the current codebase (`WEB/App.tsx`, `WEB/components/Dashboard.tsx`, `WEB/components/BottomNavBar.tsx`, `WEB/components/Admin.tsx`, `WEB/context/AuthContext.tsx`, `WEB/services/api.ts`, and their `MOBILE/src/` mirrors, plus `API/index.cjs` route definitions), not external sources. No web research was needed — this is a "fit the new feature into the existing pattern" question, not an ecosystem question.

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  AuthContext (WEB & MOBILE, same shape)                             │
│  user, view: string, navigateTo(view), login/logout/updateUser      │
└───────────────┬───────────────────────────────────────────────────────┘
                │ view === 'dashboard' → renders <Dashboard />
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard.tsx (WEB: WEB/components/Dashboard.tsx,                  │
│                 MOBILE: MOBILE/src/components/Dashboard.tsx)         │
│  Internal state machine — NOT react-router nested routes:            │
│    type View = 'home' | 'cards' | ... | 'admin' | ...               │
│    const [currentView, setCurrentView] = useState<View>('home')     │
│    switch (currentView) { case 'home': ... case 'admin': <Admin/> } │
│                                                                       │
│  ┌───────────────┐   ┌──────────────────────────────────────────┐  │
│  │ BottomNavBar   │   │  <NEW> AdminPanel.tsx shell                │  │
│  │ (5 fixed items,│   │  role-guarded (user.role === 'admin')      │  │
│  │  admin-gated   │   │  internal tab/section state:               │  │
│  │  6th item)     │   │   'users' | 'cardsAuth' | 'billing' |      │  │
│  └───────────────┘   │   'requests'                                │  │
│                       │  ┌────────────┐┌────────────┐┌───────────┐│  │
│                       │  │AdminUsers  ││AdminCards   ││AdminBilling││ │
│                       │  │            ││Auth (NEW,   ││(NEW)       ││ │
│                       │  │            ││ priority)   ││            ││ │
│                       │  │            │└────────────┘└───────────┘│ │
│                       │  │ ┌──────────────────────┐               │ │
│                       │  │ │ AdminRequests         │  ← extracted  │ │
│                       │  │ │ (reused from old      │    from       │ │
│                       │  │ │  Admin.tsx, not       │    Admin.tsx  │ │
│                       │  │ │  rebuilt)             │               │ │
│                       │  │ └──────────────────────┘               │ │
│                       └──────────────────────────────────────────┘  │
└───────────────┬───────────────────────────────────────────────────────┘
                │ every admin*() call
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WEB/services/api.ts (+ mockApi.ts mirror)                          │
│  MOBILE/src/services/api.ts (+ mockApi.ts mirror)                   │
│  Existing convention: admin<Verb><Noun>() functions, JWT bearer     │
└───────────────┬───────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API — /admin/* routes in API/index.cjs (already built & tested,    │
│  ~34 routes, bearerAuth() + authenticateAdmin)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| `AdminPanel.tsx` (NEW, WEB + MOBILE mirrored) | Shell/router for the admin experience; role-guards entry (redirect if `user.role !== 'admin'`); owns internal tab state across the 4 functional groups; hosts an overview using the existing `StatCard` pattern from `Admin.tsx` | State-based tab switcher inside a single component, matching the `Dashboard.tsx` `switch(currentView)` idiom already used everywhere else in this app — do not introduce React Router nested routes here, it would be inconsistent with the rest of the app |
| `AdminUsers.tsx` (NEW section, partially ports logic from `Admin.tsx`) | CPF search, deposit, block/unblock, PIX/credit limit adjustment, admin password reset | Calls `adminGetUserByCpf`, `adminDeposit`, `adminBlockUser`/`adminUnblockUser` (new), `adminUpdatePixLimit`/`adminUpdateCreditLimit` (new), `adminResetPassword` (new) |
| `AdminCardsAuth.tsx` (NEW, highest priority per PROJECT.md) | Purchase authorization simulation (credit + debit), card detail lookup, delivery status, mass transaction simulation | Calls `adminSimulatePurchase` (open/closed variants), `adminGetCardDetails`, `adminSetDeliveryStatus`, `adminSimulateMassTransactions` — all currently API-only, zero existing frontend code to reuse |
| `AdminBilling.tsx` (NEW) | Billing config, force invoice cycle, adjust due date, account billing status | Calls `adminGetBillingConfig`/`adminUpdateBillingConfig`, `adminForceInvoiceCycle`, `adminUpdateInvoiceDueDate`, `adminGetAccountStatus` |
| `AdminRequests.tsx` (extracted, not rebuilt) | Password-reset and credit/PIX-limit-increase request approval/denial | Directly lifts the already-working logic from `WEB/components/Admin.tsx` lines covering `adminGetPasswordRequests`/`adminApprovePasswordRequest`/`adminDenyPasswordRequest`/`adminGetLimitRequests`/`adminApproveLimitRequest`/`adminDenyLimitRequest` — out of scope to redesign per PROJECT.md |
| `BottomNavBar.tsx` (existing, extended) | Primary navigation surface (5 fixed icons today) | Gains a conditional 6th icon rendered only when `user.role === 'admin'`; requires widening `navItems`'/`onNavigate` prop's view union type in both WEB and MOBILE copies |
| `WEB/services/api.ts` + `mockApi.ts` / `MOBILE/src/services/api.ts` + `mockApi.ts` | Frontend↔API HTTP boundary; already has 13 `admin*` functions for the partial screen | New group needs ~12–14 new `admin*` functions added here, each with a matching `mockApi.ts` stub so the WEB GitHub Pages demo build keeps working |
| `API/index.cjs` `/admin/*` routes | Business logic + persistence for all admin actions | Already built and smoke-tested (per PROJECT.md) — this milestone is frontend-only, no backend changes expected |

## Recommended Project Structure

```
WEB/
├── AdminPanel.tsx                    # NEW top-level screen shell (mirrors Admin.tsx's location convention)
├── components/
│   ├── admin/                        # NEW subfolder — groups the 4 functional sections + shared bits
│   │   ├── AdminUsers.tsx
│   │   ├── AdminCardsAuth.tsx
│   │   ├── AdminBilling.tsx
│   │   ├── AdminRequests.tsx         # logic ported from Admin.tsx, not duplicated by copy-paste-and-diverge
│   │   └── AdminStatCard.tsx         # extracted from Admin.tsx's inline StatCard for reuse across sections
│   ├── Admin.tsx                     # existing partial screen — see "Decision" below on its fate
│   └── BottomNavBar.tsx              # extended: +1 conditional admin-only nav item
├── services/
│   ├── api.ts                        # + ~12-14 new admin* functions
│   └── mockApi.ts                    # + matching mock implementations (demo-build parity is mandatory)
└── context/AuthContext.tsx           # no change needed — `view: string` already untyped/open

MOBILE/src/
├── components/
│   ├── admin/                        # mirrors WEB/components/admin/ 1:1
│   │   ├── AdminUsers.tsx
│   │   ├── AdminCardsAuth.tsx
│   │   ├── AdminBilling.tsx
│   │   ├── AdminRequests.tsx
│   │   └── AdminStatCard.tsx
│   ├── Admin.tsx                     # existing partial screen
│   ├── BottomNavBar.tsx              # extended identically to WEB
│   └── Dashboard.tsx                 # `View` union type gains 'adminPanel' (or similar) entry
├── AdminPanel.tsx                    # NEW, mirrors WEB/AdminPanel.tsx placement
└── services/
    ├── api.ts                        # + same new admin* functions (axios-based)
    └── mockApi.ts
```

### Structure Rationale

- **`components/admin/` subfolder (new):** The 4 functional groups plus the extracted stat-card/requests logic are cohesive and admin-only; grouping them avoids cluttering the flat `components/` root (already ~150 files) and makes the "everything admin" boundary visually obvious to future contributors — this is a light deviation from the project's flat-file convention, justified because 5+ new files sharing one concern is exactly when subfolders become worth it.
- **Top-level `AdminPanel.tsx` (mirrors `Admin.tsx`'s existing placement, not nested under `components/`):** The codebase's convention for a *routed/top-level screen* is a file at the project root (`Login.tsx`, `Dashboard.tsx`, `Admin.tsx`), while `components/` holds things composed *inside* those screens. `AdminPanel` is a new top-level screen (reached via its own nav entry), so it follows the root-level convention, consistent with how `Admin.tsx` itself is already placed at `WEB/components/Admin.tsx` — actually check this against the live file (`Admin.tsx` currently sits in `components/`, not root) and follow whichever placement `Admin.tsx` actually uses today for the new file, to stay internally consistent rather than introducing a second convention.
- **No shared/monorepo package:** The codebase's `CONCERNS.md`/`ARCHITECTURE.md` explicitly documents WEB/MOBILE as two independent npm projects with duplicated component trees by design (not accidental) — introducing a shared package for the admin panel would be a net-new architectural pattern this milestone should not introduce. Follow the existing duplication convention: build in one platform, port to the other, same as every other feature in this app.

## Architectural Patterns

### Pattern 1: State-based internal view switching (not URL routing)

**What:** Both `WEB/App.tsx` and `MOBILE/src/App.tsx` use React Router only for the outermost 5 routes (`/`, `/login`, `/signup`, `/reset-password`, `/dashboard`). Everything inside the authenticated app — including the existing partial Admin screen — is a `useState<View>` string switched inside `Dashboard.tsx`, driven by `AuthContext`'s `view`/`navigateTo`.
**When to use:** For the new admin panel's entry point and its internal tab switching between the 4 functional groups — this is the only pattern used anywhere else in the authenticated app, so consistency strongly outweighs any theoretical benefit of nested routes.
**Trade-offs:** No deep-linkable URLs for admin sub-sections (e.g. can't bookmark "billing tab" directly), but this matches every other screen in the app (Pix, Cards, Statement, etc. are also not deep-linkable) — acceptable for an internal single-admin study tool per PROJECT.md's constraints.

**Example (WEB `Dashboard.tsx` idiom to replicate for admin tabs):**
```typescript
type View = 'home' | 'cards' | ... | 'admin' | /* extend with */ 'adminPanel';
const [currentView, setCurrentView] = useState<View>('home');
// inside AdminPanel.tsx, same idiom one level down:
type AdminSection = 'users' | 'cardsAuth' | 'billing' | 'requests';
const [section, setSection] = useState<AdminSection>('users');
```

### Pattern 2: `admin<Verb><Noun>` API client naming + dual real/mock implementation

**What:** `WEB/services/api.ts` and `MOBILE/src/services/api.ts` already establish `admin`-prefixed function names (`adminGetUserByCpf`, `adminDeposit`, `adminApproveLimitRequest`, ...) that call `/admin/*` routes with the stored JWT. Every one of these has a matching stub in `mockApi.ts` so the WEB GitHub Pages demo build (`VITE_USE_MOCK_API=true`) keeps working without a live backend.
**When to use:** For all ~12–14 new functions needed by the Cartões/Autorizações, Faturamento, and remaining Usuários routes.
**Trade-offs:** Doubles the functions that must be written (real + mock) for every new endpoint, but skipping the mock breaks the existing demo-build capability, which is a real, already-relied-upon feature of this app (not speculative) — do not skip it.

**Example:**
```typescript
// WEB/services/api.ts
export const adminSimulatePurchase = async (
  cpf: string, kind: 'credit' | 'debit', payload: PurchaseSimInput
): Promise<{ success: boolean; message?: string }> => { /* fetch to /admin/users/:cpf/card/purchase/open|closed */ };

// WEB/services/mockApi.ts — required parity stub
export const adminSimulatePurchase = async (...) => ({ success: true, message: 'Simulado (mock)' });
```

### Pattern 3: Extract-and-reuse for the Solicitações group, not copy-and-diverge

**What:** PROJECT.md explicitly marks the approval flow as "already works, out of scope to redesign — just needs to be accessible from the new screen alongside the rest." The existing `Admin.tsx` already has fully working request-approval logic (state, handlers, modal wiring) tied to `adminGetPasswordRequests`/`adminGetLimitRequests` and their approve/deny counterparts.
**When to use:** When building `AdminRequests.tsx`, move/import this logic rather than re-implementing it, and stop rendering it from the old `Admin.tsx` once it lives in the new panel (see Decision below) to avoid two divergent copies of the same approval flow inside the same app.
**Trade-offs:** Requires a small refactor of `Admin.tsx` to extract the requests logic into a reusable component (or shared hook) before it can be dropped into `AdminPanel.tsx` — slightly more upfront work than a blind copy-paste, but prevents the two screens' approval flows drifting apart over time (the exact "duplicated component trees" anti-pattern the project's own `ARCHITECTURE.md` already flags between WEB/MOBILE, just recreated *within* one platform if skipped).

## Data Flow

### Request Flow (per functional group, e.g. Cartões e Autorizações)

```
[Admin taps new nav icon]
    ↓
BottomNavBar.onNavigate('adminPanel') → Dashboard.setCurrentView('adminPanel')
    ↓
AdminPanel mounts → role guard checks user.role === 'admin' (redirect home if not)
    ↓
AdminPanel.section === 'cardsAuth' → renders <AdminCardsAuth />
    ↓
AdminCardsAuth form submit → adminSimulatePurchase(cpf, kind, payload)  [services/api.ts]
    ↓
fetch/axios → JWT bearer header → /admin/users/:cpf/card/purchase/open  [API/index.cjs]
    ↓
bearerAuth() + authenticateAdmin middleware → route handler → repositories/*.js
    ↓
JSON response ← AdminCardsAuth updates local state, shows toast/result
```

### State Management

```
AuthContext (user, view)
    ↓ (user.role read once at AdminPanel mount, and again per-section if needed)
AdminPanel (section: AdminSection)
    ↓ (props/local state only — no new global store needed)
AdminUsers / AdminCardsAuth / AdminBilling / AdminRequests
    (each owns its own local useState for form inputs, search results, loading/toast state —
     matches the existing Admin.tsx pattern of fully local component state, no Redux/Zustand/Context
     introduced for admin data)
```

### Key Data Flows

1. **Role gating flow:** `user.role` (from `AuthContext`, populated at login from the JWT-backed `/login` response) gates both (a) whether the new nav icon renders in `BottomNavBar`, and (b) a redirect-if-not-admin guard inside `AdminPanel` itself (defense in depth — same double-check pattern already used for the existing `admin` view in `Dashboard.tsx`'s `useEffect` at line ~152-155).
2. **CPF-scoped admin actions flow:** Most admin routes are scoped by `:cpf` in the URL (users, cards, invoices). `AdminUsers` should own the CPF search/selection UI (reusing `Admin.tsx`'s existing CPF search pattern) and the selected user/CPF should be passed down to `AdminCardsAuth`/`AdminBilling` if those groups act on the same selected user, avoiding 3 separate CPF search boxes — this is a UX/component-boundary decision the roadmap should make explicit in the relevant phase.

## Scaling Considerations

Not applicable in the traditional sense — PROJECT.md explicitly scopes this as a single-admin, internal study tool with "no need to support multiple simultaneous admins, i18n, or production hardening beyond what already exists." Skip standard scaling analysis; the only "scale" concern worth naming:

| Concern | Current state | Note |
|---------|---------------|------|
| `API/index.cjs` size | ~5700 lines, all ~34 admin routes already added inline | Adding a frontend consumer for existing routes requires no backend route changes — do not be tempted to refactor `index.cjs` into modules as part of this milestone, it's explicitly out of scope and a large, separate undertaking (flagged in `CONCERNS.md`) |
| WEB `components/` flat-file count | ~150+ files already | The new `components/admin/` subfolder (see Structure Rationale) keeps this milestone from making the flat-file sprawl worse |

## Anti-Patterns

### Anti-Pattern 1: Rebuilding the Solicitações (requests) approval UI from scratch

**What people do:** Since the new panel needs a "Solicitações" section anyway, it's tempting to write a fresh component for it alongside the 3 genuinely new groups.
**Why it's wrong:** PROJECT.md explicitly says this flow "already works" and is out of scope to redesign — rebuilding it risks introducing new bugs into a flow QA has already implicitly validated (it's in production use via `Admin.tsx`), and creates a second, subtly different implementation of the same feature inside the same platform.
**Do this instead:** Extract the existing logic/JSX from `Admin.tsx` into `AdminRequests.tsx` and have both the old entry point (if kept) and the new `AdminPanel` render the same component.

### Anti-Pattern 2: Introducing a shared WEB/MOBILE package for admin code

**What people do:** Noticing that `AdminUsers`/`AdminCardsAuth`/`AdminBilling`/`AdminRequests` will be near-identical between WEB and MOBILE, it's tempting to extract them into a shared package to "finally fix" the duplication.
**Why it's wrong:** This is a genuine, deliberate architectural characteristic of the whole app (documented in `.planning/codebase/ARCHITECTURE.md`'s Anti-Patterns section as an accepted trade-off, not an oversight), not something specific to the admin panel. Introducing a shared package for just this one feature would create an inconsistent, half-migrated architecture and a much larger, riskier change than this milestone calls for.
**Do this instead:** Build in WEB first (or whichever platform the team treats as primary), then port file-for-file to MOBILE, exactly as `STRUCTURE.md`'s "Where to Add New Code" section already prescribes for every other feature in this app.

### Anti-Pattern 3: Skipping the `mockApi.ts` mirror for new admin functions

**What people do:** Since the admin panel is "internal only," it's tempting to skip writing mock implementations and only wire the real `api.ts` calls.
**Why it's wrong:** `WEB/services/api.ts` re-exports `mockApi.ts` and overrides only specific functions — if a new `admin*` function has no mock counterpart, the GitHub Pages demo build (`VITE_USE_MOCK_API=true`) will either throw at runtime or silently fall through to a real `fetch` that fails against no backend, breaking a build mode the project already relies on.
**Do this instead:** Every new function added to `WEB/services/api.ts` gets a same-signature stub added to `WEB/services/mockApi.ts` in the same change.

## Integration Points

### External Services

None — the admin panel milestone is frontend-only, consuming already-built and already-tested internal API routes. No new external services are introduced.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `BottomNavBar` ↔ `Dashboard` | Props (`onNavigate` callback, `currentView`) | Both WEB and MOBILE copies need their `navItems`/view-union types widened identically; do this as one small, mirrored change before building the panel itself |
| `Dashboard` ↔ `AdminPanel` | Dashboard renders `<AdminPanel onClose={...} />` when `currentView === 'adminPanel'`, same callback-based pattern `Admin.tsx` already uses (`onClose: () => void`) | Reuse the existing `onClose` convention rather than inventing a new navigation callback shape |
| `AdminPanel` ↔ 4 section components | Props only (selected CPF, section-switch callback) | No new Context needed; sections are siblings under one parent, not deeply nested |
| Admin components ↔ `services/api.ts` | Direct function imports, same as every other screen in the app | No new HTTP client/axios instance; MOBILE continues using its existing axios-based client with `apiConfig.ts`'s configurable IP, WEB continues using its existing `fetch`-based client with the Vite `/api` proxy |
| Old `Admin.tsx` (Profile-reachable) ↔ new `AdminPanel.tsx` | **Decision needed in roadmap, not resolved by this research:** once `AdminRequests.tsx` is extracted and reused, either (a) keep `Admin.tsx` as a thin wrapper that also renders the extracted sub-components (minimal risk, some redundant navigation), or (b) redirect `Profile`'s "Admin" button to `navigateTo('adminPanel')` and retire `Admin.tsx` entirely once the new panel covers everything it did. Recommend (b) once `AdminPanel` reaches feature parity with `Admin.tsx`, to avoid maintaining two admin entry points long-term — but sequence this as a final cleanup phase, not the first phase, so there is no window where admin functionality regresses. |

## Sources

- `WEB/App.tsx`, `MOBILE/src/App.tsx` — outer React Router route tables (5 top-level routes each)
- `WEB/components/Dashboard.tsx`, `MOBILE/src/components/Dashboard.tsx` — internal `View` union + `switch(currentView)` navigation pattern, `topLevelView`/role-guard `useEffect`
- `WEB/components/BottomNavBar.tsx` — fixed 5-item nav array and typed `onNavigate` union
- `WEB/context/AuthContext.tsx` — `view`/`navigateTo` shape (untyped `string`, no change needed)
- `WEB/components/Admin.tsx` — existing partial admin screen: imports/state/handlers for the 13 already-wired `admin*` API functions, `StatCard` component, CPF search + modal + toast patterns to reuse
- `WEB/services/api.ts` — existing `admin<Verb><Noun>` naming convention (13 functions found, lines 419-762)
- `API/index.cjs` (lines ~2476-5541) — full list of ~34 `/admin/*` route definitions, confirming natural grouping by URL prefix: `/admin/users/*` (Usuários), `/admin/users/:cpf/card/*` + `/admin/cards/*` + `/admin/simulate-purchases` + `/admin/transactions/simulate-mass` (Cartões e Autorizações), `/admin/invoices/*` + `/admin/billing/*` (Faturamento), `/admin/requests/*` (Solicitações)
- `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` — project constraints (WEB↔MOBILE parity requirement, no multi-admin/i18n/production-hardening needs, existing duplicated-frontend-trees anti-pattern already accepted as a trade-off)

---
*Architecture research for: internal admin panel addition to a mirrored WEB/MOBILE fintech study app*
*Researched: 2026-07-19*
