# Codebase Structure

**Analysis Date:** 2026-07-19

## Directory Layout

```
FintechBankApp/
├── API/                         # Node.js/Express backend (monolith entry: index.cjs)
│   ├── index.cjs                # App bootstrap + all ~99 routes + cron jobs
│   ├── middlewares/             # auth.js (JWT, scopes, PIN guard, audit log)
│   ├── repositories/            # One file per domain entity, raw SQL access
│   ├── services/
│   │   ├── database/            # DatabaseInterface/Factory + Postgres/Databricks providers
│   │   └── invoiceEngine.js     # Cron-driven billing cycle engine
│   ├── utils/                   # Business logic: billing, cardEngine, subscriptions, reversal
│   ├── migrations/               # Knex migration files (001_initial_schema.js, ...)
│   ├── scripts/                  # One-off/maintenance scripts (seeding, newman test runner)
│   ├── tests/                    # Jest test suites (*.test.js)
│   ├── data/                      # Mock seed data (mockSeed)
│   ├── docs/                      # Backend docs
│   ├── schema*.sql               # Raw SQL schema dumps (Postgres/Databricks variants)
│   ├── swagger.yaml / swagger.json # API contract used by swagger-ui-express at /api-docs
│   └── knexfile.js               # Knex config (migrations only, not runtime queries)
│
├── WEB/                          # React 19 + Vite browser SPA (flat file layout, no src/)
│   ├── index.tsx → App.tsx       # Entry point and router/providers
│   ├── Login.tsx, SignUp.tsx, Dashboard.tsx, Pix.tsx, Statement.tsx, Contacts.tsx,
│   │   Limits.tsx, Admin.tsx     # Top-level screen components at project root
│   ├── components/                # All reusable UI components (~150+ .tsx files)
│   ├── context/                    # AuthContext.tsx
│   ├── contexts/                   # AppStateContext.tsx, GlobalDialogContext.tsx
│   ├── services/                   # api.ts (real fetch client), mockApi.ts (demo fallback)
│   ├── hooks/                      # Custom React hooks
│   ├── utils/                      # Frontend-only helpers/formatters
│   ├── data/                       # Static/mock data
│   ├── styles/                     # CSS/Tailwind
│   ├── server/                     # Legacy/placeholder Express stub (not the real API)
│   ├── tests/                      # Vitest test files
│   ├── volt-fintech/                # Separate embedded Vite sub-project (design exploration)
│   ├── new-base-fintechbank/        # Separate embedded git repo (redesign base, has own .git/.spec)
│   ├── types.ts                     # Shared TS type definitions
│   ├── vite.config.ts               # Dev server, proxy `/api` → :3001, mock-api alias swap
│   └── package.json
│
├── MOBILE/                        # Ionic/React + Capacitor app (Android-targeted)
│   ├── src/
│   │   ├── index.tsx → App.tsx     # Entry point and router/providers
│   │   ├── Login.tsx, SignUp.tsx, Dashboard.tsx, Pix.tsx, ... # Top-level screens
│   │   ├── components/              # Mirrors WEB/components with mobile-specific tweaks
│   │   ├── pages/                   # Ionic page wrappers: Home, Login, PreLoginDashboard, Settings
│   │   ├── context/, contexts/       # Same context pattern as WEB
│   │   ├── services/                 # api.ts (axios-based), mockApi.ts
│   │   ├── apiConfig.ts               # Configurable API base IP for device/emulator testing
│   │   ├── theme/                     # Ionic CSS variables
│   │   └── utils/                     # AppVersion.ts, accessibilityEnhancer.ts, formatters.ts
│   ├── android/                    # Native Android project (Capacitor-generated/managed)
│   ├── capacitor.config.json       # Capacitor app config
│   ├── resources/, icons/          # App icons/splash assets
│   ├── scripts/                    # APK build/adb helper scripts (PowerShell/JS)
│   ├── server/                     # Legacy/placeholder Express stub (not the real API)
│   ├── tests/                      # Vitest test files
│   └── package.json
│
├── docs/                          # Project-wide docs, ADRs, plans
├── .planning/                     # GSD planning artifacts (this document's home)
├── .spec/                         # Spec docs per app (api/mobile/web)
└── scripts/                       # Repo-root maintenance scripts
```

## Directory Purposes

**`API/repositories/`:**
- Purpose: Encapsulate all SQL access per domain entity
- Contains: `usersRepo.js`, `cardRepo.js`, `invoiceRepo.js`, `invoiceLifecycleRepo.js`, `transactionsRepo.js`, `pixRepo.js`, `subscriptionsRepo.js`, `recurringBillsRepo.js`, `vouchersRepo.js`, `notificationsRepo.js`, `shopRepo.js`, `limitRequestsRepo.js`
- Key files: `context.js` (shared `getDb()`/`esc()` helpers — all repos import from here)

**`API/services/database/`:**
- Purpose: Database provider abstraction
- Contains: `DatabaseInterface.js` (contract), `DatabaseFactory.js` (env-based provider selection), `PostgresProvider.js`, `DatabricksProvider.js`

**`API/utils/`:**
- Purpose: Pure/near-pure business logic reused across routes and the invoice engine
- Contains: `billing.js` (cycle/charge/installment math), `cardEngine.js` (card number/limit logic), `subscriptions.js`, `transactionReversal.js`, `billingMockSeeder.js`, `checkPostgresContainers.js`

**`WEB/components/` and `MOBILE/src/components/`:**
- Purpose: All reusable presentational and feature components (modals, views, dashboards)
- Contains: ~150+ `.tsx` files per platform, largely 1:1 named pairs between WEB and MOBILE (e.g., `Pix.tsx`, `Cards.tsx`, `Dashboard.tsx`)
- Key files: Naming mirrors the domain feature it renders (e.g., `PixKeyManagement.tsx`, `InvoiceInstallmentPlan.tsx`)

**`WEB/volt-fintech/` and `WEB/new-base-fintechbank/`:**
- Purpose: Nested, independently-buildable design/redesign sub-projects with their own `package.json`, `vite.config.ts`, and (for `new-base-fintechbank`) their own embedded `.git` repo
- Note: Not part of the main WEB build; treat as separate experimental workspaces unless a task explicitly targets them

**`MOBILE/android/`:**
- Purpose: Native Android project generated/managed by Capacitor for building the APK
- Generated: Partially (Capacitor sync regenerates parts of it); do not hand-edit generated files without checking `capacitor.config.json` first

## Key File Locations

**Entry Points:**
- `API/index.cjs`: Express app bootstrap, DB connect, all route registrations, cron scheduling, `app.listen`
- `WEB/index.tsx`: WEB SPA root render, mounts `App.tsx`
- `MOBILE/src/index.tsx`: MOBILE SPA root render, mounts `App.tsx` (Capacitor-aware)

**Configuration:**
- `API/.env` (not committed): `JWT_SECRET`, `DB_PROVIDER`/`DB_DIALECT`, Postgres/Databricks connection vars, `PORT`
- `API/knexfile.js`: Knex migration configuration
- `WEB/vite.config.ts`: dev server port 3000, `/api` proxy to `:3001`, mock-API alias swap via `VITE_USE_MOCK_API`
- `MOBILE/vite.config.ts`, `MOBILE/src/apiConfig.ts`: dev server port 3002, configurable API host IP for device testing
- `MOBILE/capacitor.config.json`: Capacitor native app config

**Core Logic:**
- `API/repositories/*.js`: Data access per entity
- `API/utils/billing.js`: Billing cycle/interest/installment calculations
- `API/services/invoiceEngine.js`: Daily cron invoice lifecycle engine
- `WEB/services/api.ts` / `MOBILE/src/services/api.ts`: Frontend-to-backend HTTP clients

**Testing:**
- `API/tests/*.test.js`: Jest backend tests (run via `npm test` in `API/`)
- `WEB/tests/`, `MOBILE/tests/`: Vitest frontend tests (run via `npm test` in each app)
- `API/scripts/run-newman-tests.js`: Postman/Newman collection runner against `swagger.yaml`/`swagger.json`

## Naming Conventions

**Files:**
- Backend: camelCase for repositories/utils (`usersRepo.js`, `cardEngine.js`), `index.cjs` uses `.cjs` extension explicitly (CommonJS in an otherwise unspecified `"type": ""` package)
- Frontend: PascalCase for React components (`Dashboard.tsx`, `PixKeyManagement.tsx`), camelCase for services/utils (`api.ts`, `formatters.ts`)
- Tests: `*.test.js` (API, Jest), co-located or under `tests/` (WEB/MOBILE, Vitest)

**Directories:**
- Backend: lowercase, purpose-named (`repositories/`, `middlewares/`, `services/`, `utils/`, `migrations/`, `scripts/`)
- Frontend: lowercase (`components/`, `context/`, `contexts/`, `services/`, `hooks/`, `utils/`, `data/`, `styles/`)
- Note: Both `context/` (singular) and `contexts/` (plural) exist side by side in WEB and MOBILE — `context/` holds `AuthContext.tsx`, `contexts/` holds `AppStateContext.tsx` and `GlobalDialogContext.tsx`. Follow this existing split rather than consolidating without being asked.

## Where to Add New Code

**New API Endpoint:**
- Route handler: add near related routes inside `API/index.cjs` (`apiRouter.get/post/put/delete/patch(...)`)
- Data access: add a function to the relevant file in `API/repositories/` (or create a new `*Repo.js` following the existing pattern: `require('./context')`, use `getDb()`/`esc()`)
- Business logic: add to `API/utils/` if it's pure calculation reused elsewhere
- Auth: wrap route with `bearerAuth()`, `requireScope('admin'|'customer')`, and/or `pinGuard()` from `API/middlewares/auth.js` as needed
- Tests: add `*.test.js` under `API/tests/`

**New Frontend Screen/Feature (WEB):**
- Component: `WEB/components/<Name>.tsx` (or top-level `WEB/<Name>.tsx` if it's a routed page, matching existing pattern of `Login.tsx`, `Dashboard.tsx`, etc.)
- Route registration: `WEB/App.tsx`
- API calls: add functions to `WEB/services/api.ts`, with a matching mock implementation in `WEB/services/mockApi.ts` to keep the demo build working
- Apply the equivalent change to `MOBILE/src/components/<Name>.tsx` / `MOBILE/src/App.tsx` / `MOBILE/src/services/api.ts` unless the feature is explicitly WEB-only or MOBILE-only

**New Frontend Screen/Feature (MOBILE):**
- Component: `MOBILE/src/components/<Name>.tsx`, Ionic page wrapper (if full-screen) under `MOBILE/src/pages/<Feature>/`
- Route registration: `MOBILE/src/App.tsx`
- API calls: `MOBILE/src/services/api.ts` (axios-based) + `MOBILE/src/services/mockApi.ts`

**Utilities:**
- Backend shared helpers: `API/utils/`
- Frontend shared helpers: `WEB/utils/` or `MOBILE/src/utils/` (formatters, accessibility, version helpers)

**Database Schema Changes:**
- Add a new Knex migration file under `API/migrations/` (follow `00N_description.js` numbering seen in `001_initial_schema.js`, `002_invoice_lifecycle.js`)
- Update `API/schema_pg.sql`/`API/schema_pg_fintech.sql` reference dumps if they are kept in sync manually

## Special Directories

**`API/migrations/`:**
- Purpose: Knex-managed schema migrations
- Generated: No (hand-written)
- Committed: Yes

**`MOBILE/android/`, `MOBILE/dist/`, `WEB/dist/`:**
- Purpose: Build/native output
- Generated: Yes (Capacitor sync / Vite build)
- Committed: Partially — `android/` project files are typically committed for Capacitor apps; `dist/` build output should generally not be relied upon as source

**`WEB/coverage/`, `.claude-flow/`, `.swarm/`, `.taskmaster/`, `graphify-out/`:**
- Purpose: Tooling/test-coverage output and AI-agent tooling caches
- Generated: Yes
- Committed: No (should be treated as disposable)

**`WEB/new-base-fintechbank/` (nested `.git`):**
- Purpose: Embedded separate git repository for a redesign spec/base
- Note: Because it contains its own `.git/`, it is not tracked as part of the main repo's history — do not attempt to `git add` files inside it expecting normal tracking behavior.

---

*Structure analysis: 2026-07-19*
