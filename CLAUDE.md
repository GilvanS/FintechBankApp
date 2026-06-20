# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to commits
- Keep files under 500 lines
- Validate input at system boundaries

---

## Project Structure

Monorepo with three independent modules, each with their own `package.json`:

```
FintechBankApp/
├── API/        — Node.js + Express backend (port 3001)
├── MOBILE/     — Capacitor + React + Vite (Android APK)
├── WEB/        — React + Vite frontend (port 5173)
└── docker-compose.yml  — PostgreSQL via Docker (port 5432, db: fintech, schema: fintech)
```

---

## Commands

### API (Node.js + Express)
```bash
cd API
npm run dev           # node --watch index.cjs
npm test              # Jest (all test files in tests/)
npx jest tests/billing.test.js   # single suite
npm run test:coverage
```

### MOBILE (Capacitor + React)
```bash
cd MOBILE
npm run dev           # Vite dev server
npm run build         # vite build → dist/
npm test              # vitest run
.\GERAR-APK-DO-ZERO.ps1   # full APK build + optional adb install
```

### WEB (React + Vite)
```bash
cd WEB
npm run dev           # port 5173
npm test              # vitest run
```

### Database (PostgreSQL via Docker)
```bash
docker compose up -d              # start pgdb container
cd API && .\RECRIAR-BANCO.ps1    # drop + recreate fintech schema
```

---

## Architecture

### API (`API/index.cjs`)
Single-file entry point (~3800 lines). All routes mounted on both `/api` and `/api/v1`:

```
app.use('/api',    apiRouter);
app.use('/api/v1', apiRouter);
```

**Key internals:**
- `DatabaseFactory` (`services/database/`) — selects SQLite or PostgreSQL based on `DB_PROVIDER` env var. All queries go through `databricksService.executeQuery(sql)`. Table names use `databricksService.fq('table')` → `"fintech"."table"`.
- `initializeDatabase()` — bootstraps all tables (`CREATE TABLE IF NOT EXISTS`) on startup. Add new tables here.
- `normalizeUser(row)` — converts DB snake_case → camelCase for API responses.
- `bearerAuth()` — JWT middleware; sets `req.user = { cpf, role }`.
- `authenticateAdmin` — inline middleware checking `req.user.role === 'admin'`.
- `asyncHandler(fn)` — wraps async route handlers to forward errors.

**Route groups** (all under `apiRouter`):

| Prefix | Purpose |
|--------|---------|
| `/auth` | login, signup, password reset |
| `/users` | `/me` (full profile + billing), `/:cpf`, statement |
| `/pix` | transfer, keys, contacts |
| `/cards` | invoice pay/parcel/anticipate |
| `/shop` | products, checkout |
| `/billing` | `/invoice-status` (authenticated user) |
| `/admin/*` | user management, billing config, stats |
| `/debug/*` | requires admin scope |

**Repositories** (`API/repositories/`) — thin SQL wrappers; no business logic. Each exposes named functions imported directly into `index.cjs`.

**Billing system** (`API/utils/billing.js`):
- `computeCurrentCycle(cfg, now?)` — returns `{ cycleStatus, invoiceRef, closeDate, dueDate, overdueDeadline }`. Status: `aberta → fechada → vencida → inadimplente`.
- `calcCharges(invoiceAmount, daysOverdue)` — multa 2% + juros 0.0333%/dia.
- Tables: `billing_config` (single-row global params) and `billing_charges` (per-user per-cycle charges).

### MOBILE (`MOBILE/src/`)

**Stack:** Capacitor 7 + React 18 + Vite + Ionic React + Tailwind CSS.

**App shell** (`src/App.tsx`):
- Manages a single `view` state string (no router).
- `restoreSession()` on mount: tries `localStorage.getItem('authToken')` → `GET /users/me` → sets user and view.
- Back button: `CapApp.addListener('backButton', ...)` → `minimizeApp()` if can't go back.
- `AuthContext` exposes `{ user, login, logout, updateUser, view, navigateTo }`.

**API layer** (`src/services/api.ts`):
- `initializeApi()` — detects platform (Android/iOS/web) and sets base URL dynamically.
- On Android APK: uses `http://10.0.2.2:3001` (emulator) or detected LAN IP.
- All calls include `Authorization: Bearer <token>` from `localStorage.getItem('authToken')`.

**Home view** (`src/components/HomeView.tsx`):
- Displays balance, limits, billing status banner, quick actions, news, banners.
- Account status banner: red for `inadimplente`, yellow for `suspenso`, subtle green/yellow reminders for `fechada`/`vencida` cycle status.

**Capacitor Android specifics:**
- `MOBILE/index.html` — must have `viewport-fit=cover` for safe area.
- `src/theme/variables.css` — `html, body, #root { height: 100% }` required for layout chain.
- `BottomNavBar` uses `paddingBottom: env(safe-area-inset-bottom)` with `height: auto`.
- CORS: Capacitor WebView sends `Origin: http://localhost` on Android.

### WEB (`WEB/`)
React + Vite SPA. Shares some utility patterns with MOBILE but is independent.

---

## Database

**PostgreSQL schema** — canonical source: `API/schema_pg.sql`. Schema prefix: `fintech`.

Key tables: `users`, `transactions`, `pix_keys`, `pix_contacts`, `notifications`, `limit_increase_requests`, `invoices`, `purchased_items`, `installment_plans`, `billing_config`, `billing_charges`.

`billing_config` is a single-row table (`id=1`). Always query with `WHERE id = 1`.

Users table has billing columns: `account_status` (default `'adimplente'`), `days_overdue`, `credit_card_due_day`, `invoice_last_closed_date`.

**Adding a new table:** add DDL to `schema_pg.sql` AND add `CREATE TABLE IF NOT EXISTS` block inside `initializeDatabase()` in `index.cjs` (before the `🎉` log line at the end of the function).

---

## Testing

| Module | Framework | Location |
|--------|-----------|----------|
| API | Jest + Supertest | `API/tests/*.test.js` |
| MOBILE | Vitest + Testing Library | `MOBILE/src/**/__tests__/` |
| WEB | Vitest + Testing Library | `WEB/src/**/__tests__/` |

API tests create isolated Express apps with mocked DB calls — they don't require a running database. See `API/tests/billing.test.js` for the pattern.

Run a single API test file:
```bash
cd API && npx jest tests/billing.test.js --no-coverage
```

---

## Environment Variables (API)

```env
DB_PROVIDER=postgres          # sqlite | postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=pwd123
DB_NAME=fintech
DB_SCHEMA=fintech
JWT_SECRET=<long-random-string>
PORT=3001
```

JWT secret must come from env — no hardcoded fallback.

---

## Spec-Driven Development

Specs ficam em `.spec/`. Leia o spec relevante antes de implementar qualquer feature.

| Path | Conteúdo |
|------|---------|
| `.spec/PROJECT.md` | Arquitetura, decisões locked, convenções |
| `.spec/api/BILLING.md` | Regras de billing, ciclo, encargos |
| `.spec/api/AUTH.md` | Auth, JWT, middleware |
| `.spec/api/PIX.md` | PIX, chaves, limite diário |
| `.spec/api/CARDS.md` | Cartão, faturas, parcelamento |
| `.spec/mobile/FATURAS.md` | UI da tela de faturas (issue #36) |
| `.spec/mobile/HOME.md` | Home screen, billing banner |
| `.spec/mobile/NAVIGATION.md` | State machine de views, AuthContext |

Fluxo: atualizar `.spec/` → `/gsd-spec-phase` → `/gsd-plan-phase` → `/gsd-execute-phase` → `/gsd-verify-work`

---

## Agent Comms (SendMessage-First Coordination)

Named agents coordinate via `SendMessage`, not polling or shared state.

```
Lead (you) ←→ architect ←→ developer ←→ tester ←→ reviewer
```

### Rules
- ALWAYS name agents — `name: "role"` makes them addressable
- Spawn ALL agents in ONE message with `run_in_background: true`
- After spawning: STOP, tell user what's running, wait for results
- NEVER poll status — agents message back or complete automatically

### When to Swarm
- **YES**: 3+ files, new features, cross-module refactoring, API changes, security
- **NO**: single file edits, 1-2 line fixes, config changes, questions

---

## MCP Tools (use `ToolSearch("keyword")` to discover)

| Category | Key Tools |
|----------|-----------|
| **Memory** | `memory_store`, `memory_search` |
| **Swarm** | `swarm_init`, `swarm_status` |
| **Agents** | `agent_spawn`, `agent_list` |
| **Hooks** | `hooks_route`, `hooks_post-task` |
