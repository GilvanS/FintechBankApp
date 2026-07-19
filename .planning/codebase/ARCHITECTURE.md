<!-- refreshed: 2026-07-19 -->
# Architecture

**Analysis Date:** 2026-07-19

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATIONS                      │
├──────────────────────────────┬────────────────────────────────┤
│   WEB (React 19 + Vite)      │   MOBILE (Ionic/React +        │
│   `WEB/App.tsx`               │   Capacitor, Android)          │
│   `WEB/components/*.tsx`      │   `MOBILE/src/App.tsx`         │
│                               │   `MOBILE/src/components/*.tsx`│
└───────────────┬───────────────┴───────────────┬────────────────┘
                │  fetch() via services/api.ts    │
                │  (WEB: Vite proxy `/api` →      │
                │   MOBILE: axios + apiConfig.ts) │
                ▼                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                 API — Express monolith                       │
│                 `API/index.cjs` (5700+ lines)                │
│  bearerAuth / requireScope / pinGuard / auditLog middleware  │
│  `API/middlewares/auth.js`                                    │
├─────────────────────────────────────────────────────────────┤
│  Route handlers (apiRouter.get/post/...) inline in index.cjs │
│  delegate to:                                                │
│    Utils (business logic) `API/utils/*.js`                   │
│    Services (cron/engine) `API/services/invoiceEngine.js`    │
└───────────────┬───────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│           Repository Layer  `API/repositories/*.js`          │
│  usersRepo, cardRepo, invoiceRepo, transactionsRepo, pixRepo, │
│  subscriptionsRepo, recurringBillsRepo, vouchersRepo, ...     │
│  All call `getDb()` from `API/repositories/context.js`        │
└───────────────┬───────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│      Database Abstraction  `API/services/database/`          │
│  DatabaseInterface (contract) → DatabaseFactory (selects      │
│  provider via DB_PROVIDER env) → PostgresProvider /           │
│  DatabricksProvider (concrete SQL execution)                  │
└───────────────┬───────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│      PostgreSQL (default) or Databricks SQL warehouse         │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| API entry/router | Boots Express, registers ~100 routes, cron jobs, error handler | `API/index.cjs` |
| Auth middleware | JWT verification, scope checks, PIN guard, request-id, audit log | `API/middlewares/auth.js` |
| Repositories | One file per domain entity; raw SQL via `db.executeQuery` | `API/repositories/*.js` |
| Repo context | Holds the active DB service singleton + SQL-escaping helper `esc()` | `API/repositories/context.js` |
| Database Factory | Picks Postgres vs Databricks provider based on env | `API/services/database/DatabaseFactory.js` |
| Database Interface | Abstract contract (`connect`, `executeQuery`, `fq`, ...) | `API/services/database/DatabaseInterface.js` |
| Postgres Provider | Concrete Postgres implementation of the interface | `API/services/database/PostgresProvider.js` |
| Databricks Provider | Concrete Databricks SQL implementation | `API/services/database/DatabricksProvider.js` |
| Invoice engine | Cron-driven billing cycle / overdue recalculation | `API/services/invoiceEngine.js` |
| Business logic utils | Billing math, card engine, subscriptions, reversal logic | `API/utils/*.js` |
| WEB app shell | Route table, auth context wiring, lazy-loaded Dashboard | `WEB/App.tsx` |
| WEB API client | Fetch wrapper calling `/api/*`, re-exports mock fallback | `WEB/services/api.ts` |
| WEB mock API | Local in-memory implementation used for GitHub Pages demo builds | `WEB/services/mockApi.ts` |
| MOBILE app shell | Same route table as WEB, Capacitor-aware bootstrapping | `MOBILE/src/App.tsx` |
| MOBILE API client | Axios-based client, IP-configurable for device/emulator testing | `MOBILE/src/services/api.ts`, `MOBILE/src/apiConfig.ts` |

## Pattern Overview

**Overall:** Monolithic layered backend (routes → utils → repositories → DB provider abstraction) serving two independently-deployed, near-duplicate React SPA frontends (WEB for browser, MOBILE for Capacitor/Android via Ionic).

**Key Characteristics:**
- Single massive Express file (`API/index.cjs`) rather than modular route files — all ~100 endpoints and most request-handling logic live inline in one file.
- Repository pattern isolates SQL from route handlers, but repositories build raw SQL strings with a hand-rolled escaper (`esc()`) instead of parameterized queries or an ORM (a Knex config exists but is only used for migrations, not runtime queries).
- Database-agnostic design via `DatabaseInterface` + `DatabaseFactory`, selected at boot by `DB_PROVIDER`/`DB_DIALECT` env var — supports Postgres (primary/local dev, per user memory: pgdb) and Databricks SQL (cloud/production alternative).
- WEB and MOBILE are two separate npm projects with near-identical component trees (`WEB/components/*.tsx` mirrored in `MOBILE/src/components/*.tsx`), not a shared monorepo package — code is duplicated rather than shared via a common library.
- MOBILE additionally wraps the SPA in Capacitor/Ionic (`MOBILE/capacitor.config.json`, `MOBILE/android/`) to produce a native Android APK from the same React codebase (WebView-hosted).
- Cron-driven background jobs (`node-cron`) inside `index.cjs` run the invoice engine and billing/overdue validation once per day.

## Layers

**Route/Controller Layer:**
- Purpose: HTTP endpoint definitions, request validation (`express-validator`), auth enforcement, response shaping
- Location: `API/index.cjs` (apiRouter.get/post/put/delete/patch — ~99 routes)
- Contains: Inline async handlers wrapped in `asyncHandler`
- Depends on: Middlewares, Utils, Repositories
- Used by: HTTP clients (WEB, MOBILE)

**Middleware Layer:**
- Purpose: Cross-cutting request concerns — auth, request IDs, audit logging
- Location: `API/middlewares/auth.js`
- Contains: `bearerAuth()`, `requireScope()`, `pinGuard()`, `withReqId()`, `auditLog()`
- Depends on: `jsonwebtoken`
- Used by: Route handlers in `API/index.cjs`

**Business Logic / Utils Layer:**
- Purpose: Domain calculations (billing cycles, IOF/interest, installments, card limits, subscriptions, reversal)
- Location: `API/utils/*.js` (`billing.js`, `cardEngine.js`, `subscriptions.js`, `transactionReversal.js`, `billingMockSeeder.js`)
- Depends on: Repositories (for reads), pure math otherwise
- Used by: Route handlers, invoice engine

**Repository Layer:**
- Purpose: Data access per domain entity, encapsulates SQL
- Location: `API/repositories/*.js`
- Contains: Async functions returning plain rows/objects
- Depends on: `context.js` (`getDb()`, `esc()`)
- Used by: Route handlers, utils, invoice engine

**Database Provider Layer:**
- Purpose: Abstracts SQL execution across Postgres/Databricks
- Location: `API/services/database/*.js`
- Depends on: `pg`/`@databricks/sql` drivers
- Used by: Repositories (indirectly via `getDb()`)

**Frontend Presentation Layer (WEB & MOBILE):**
- Purpose: Screens/components, local UI state, contexts
- Location: `WEB/components/*.tsx` + `WEB/*.tsx` (top-level screens); `MOBILE/src/components/*.tsx` + `MOBILE/src/*.tsx`
- Depends on: `services/api.ts` (real) or `services/mockApi.ts` (demo/offline)
- Used by: `App.tsx` router

**Frontend Service Layer (WEB & MOBILE):**
- Purpose: HTTP calls to the API, token handling, mock fallback
- Location: `WEB/services/api.ts`, `WEB/services/mockApi.ts`; `MOBILE/src/services/api.ts`, `MOBILE/src/services/mockApi.ts`
- Depends on: `fetch`/`axios`, `localStorage` for JWT
- Used by: Components via imports

## Data Flow

### Primary Request Path (e.g., PIX transfer)

1. User submits a form in a component, e.g. `WEB/components/Pix.tsx` / `MOBILE/src/components/PixView.tsx`
2. Component calls a function from `WEB/services/api.ts` (or MOBILE equivalent), which does `fetch('/api/pix/transfer', ...)` with JWT bearer token from `localStorage`
3. Vite dev proxy (WEB `vite.config.ts`) or absolute URL (MOBILE `apiConfig.ts`) forwards the request to `API/index.cjs` on port 3001
4. `bearerAuth()` + `requireScope('customer')` + `pinGuard()` middleware run (`API/middlewares/auth.js`)
5. Matching `apiRouter.post('/pix/transfer', ...)` handler in `API/index.cjs` validates input, calls `pixRepo` / `usersRepo` functions
6. Repository builds SQL via `esc()` helper and executes through `getDb()` → active `DatabaseProvider.executeQuery()`
7. Response JSON returned to the frontend service function, component updates local/context state

### Invoice/Billing Cron Flow

1. `node-cron` schedule (`0 0 * * *`) in `API/index.cjs` fires daily
2. `runEngine()` from `API/services/invoiceEngine.js` closes/opens invoice cycles per user via `invoiceRepo`/`invoiceLifecycleRepo`
3. `runBillingValidation()` (defined in `index.cjs`, uses `API/utils/billing.js`) recalculates IOF/interest/penalties for overdue closed invoices
4. Results are persisted back through the repository layer to the DB

**State Management:**
- Frontend: React Context (`AuthContext`, `AppStateContext`, `GlobalDialogContext`) for cross-component state; JWT stored in `localStorage`
- Backend: No server-side session store; each request is stateless and authenticated via JWT bearer/cookie

## Key Abstractions

**DatabaseInterface / DatabaseFactory:**
- Purpose: Swap SQL backend (Postgres vs Databricks) without touching repositories
- Examples: `API/services/database/DatabaseInterface.js`, `API/services/database/DatabaseFactory.js`, `API/services/database/PostgresProvider.js`, `API/services/database/DatabricksProvider.js`
- Pattern: Factory + common interface, selected by `DB_PROVIDER`/`DB_DIALECT` env var at boot

**Repository Context Singleton:**
- Purpose: Share one DB connection/service instance across all repository modules without dependency injection
- Examples: `API/repositories/context.js` (`setDb`, `getDb`, `esc`)
- Pattern: Module-level singleton set once at bootstrap in `index.cjs`

**Mock API Parity Layer:**
- Purpose: Let WEB build a fully static GitHub Pages demo without a live backend
- Examples: `WEB/services/mockApi.ts`, toggled via `VITE_USE_MOCK_API` alias swap in `WEB/vite.config.ts`
- Pattern: Same function signatures as `api.ts`; `api.ts` re-exports `mockApi.ts` then overrides specific functions with real fetch calls

## Entry Points

**API Server:**
- Location: `API/index.cjs`
- Triggers: `npm start` (`node index.cjs`) or `npm run dev` (`node --watch index.cjs`)
- Responsibilities: Env loading, DB bootstrap, middleware registration, all route definitions, cron scheduling, `app.listen(PORT)`

**WEB SPA:**
- Location: `WEB/index.tsx` → `WEB/App.tsx`
- Triggers: `npm run dev` (Vite dev server on port 3000, proxies `/api` to 3001) or `npm run build` for static output
- Responsibilities: Router setup, auth/context providers, lazy Dashboard loading

**MOBILE SPA/App:**
- Location: `MOBILE/src/index.tsx` → `MOBILE/src/App.tsx`
- Triggers: `npm run dev:mobile` (Vite on port 3002) for browser testing, or `npm run build:mobile` + Capacitor sync (`MOBILE/android/`) for APK builds
- Responsibilities: Same as WEB plus Capacitor plugin bootstrapping (biometric auth, app state) and IP-configurable API base for physical devices/emulators (`MOBILE/src/apiConfig.ts`)

**Alternate/Placeholder Server:**
- Location: `WEB/server/index.js`, `MOBILE/server/index.js`
- Note: Minimal Express stub with a single `/api/v1/health` route and a `TODO` to implement swagger-defined routes — not the actively used API (the real API is `API/index.cjs`). Treat as legacy/scaffold, not part of the live request path.

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop for the API; no worker threads or clustering observed.
- **Global state:** Module-level DB singleton in `API/repositories/context.js` (`let db = null`); DB provider instance held as a top-level const in `API/index.cjs` (`dbService`/`databricksService`).
- **Monolith file size:** `API/index.cjs` is ~5700 lines containing route definitions, error handling, cron setup, and CORS config together — any change requires navigating a single large file rather than isolated route modules.
- **SQL injection surface:** Repositories interpolate values into SQL strings via a custom `esc()` escaper (`API/repositories/context.js`) instead of parameterized queries; correctness depends entirely on every call site using `esc()` consistently.
- **Duplicated frontend codebases:** WEB and MOBILE maintain separate copies of nearly all components (`WEB/components/*.tsx` vs `MOBILE/src/components/*.tsx`) — no shared package; fixes must be applied twice.

## Anti-Patterns

### Monolithic route file

**What happens:** All ~99 API routes, middleware wiring, cron jobs, and the global error handler live in one 5700-line file, `API/index.cjs`.
**Why it's wrong:** High merge-conflict risk, hard to locate a specific route, no enforced module boundaries between features (auth, pix, cards, invoices all interleaved).
**Do this instead:** When adding new endpoints, group related routes near their existing feature's routes in `index.cjs` (e.g., pix routes near other `apiRouter.*('/pix...')` calls) and keep handler bodies thin by delegating to `utils/`/`repositories/` — do not introduce fully new patterns until the file is deliberately split.

### Hand-rolled SQL escaping instead of parameterized queries

**What happens:** Repositories build query strings with template literals and an `esc()` helper (`API/repositories/context.js`) rather than using placeholders (`$1`, `?`) with driver-level parameter binding.
**Why it's wrong:** Any call site that forgets to wrap a value in `esc()` introduces a SQL injection vulnerability; also bypasses type-safety of parameterized drivers.
**Do this instead:** Always wrap interpolated values with `esc()` when touching existing repositories; for new repository functions prefer the provider's native parameterized query support if available in `PostgresProvider.js`/`DatabricksProvider.js`.

### Duplicated component trees across WEB and MOBILE

**What happens:** Nearly identical `.tsx` components exist in both `WEB/components/` and `MOBILE/src/components/` (e.g., `Pix.tsx`, `Dashboard.tsx`, `Cards.tsx`) with platform-specific tweaks.
**Why it's wrong:** Bug fixes and feature changes must be manually ported between the two trees; drift between them is already visible in different mock/real API strategies and IP-config handling.
**Do this instead:** When fixing a bug found in one platform's component, check the equivalent path (`MOBILE/src/components/<Name>.tsx` ↔ `WEB/components/<Name>.tsx`) and apply the same fix unless the platforms have diverged intentionally.

## Error Handling

**Strategy:** Centralized Express error-handling middleware plus `asyncHandler` wrapper around route handlers.

**Patterns:**
- Route handlers are wrapped in `asyncHandler(async (req, res) => {...})` in `API/index.cjs` to forward rejected promises to Express's error pipeline.
- Global error handler registered near line 4608 of `API/index.cjs` (`app.use((err, req, res, next) => {...})`) formats a consistent JSON error response.
- Frontend `WEB/services/api.ts`/MOBILE equivalent: `apiCall()` throws on non-OK response after attempting to parse a JSON error body; callers catch and return `{ success: false, message }` shapes.
- `WEB/ErrorBoundary.tsx` / `MOBILE/src/ErrorBoundary.tsx` provide React-level error boundaries around the app tree.

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.error` throughout `API/index.cjs` and repositories; `auditLog(req, action, level, meta)` in `API/middlewares/auth.js` for structured audit entries on sensitive actions.
**Validation:** `express-validator` (`body(...)`, `validationResult`) used at route level in `API/index.cjs`; frontend forms do local validation before calling API services.
**Authentication:** JWT via `jsonwebtoken`, verified in `bearerAuth()` (`API/middlewares/auth.js`); token carried as `Authorization: Bearer` header or `token` cookie; role-based scopes (`admin`, `customer`) mapped via `mapScopesFromRole()`.

---

*Architecture analysis: 2026-07-19*
