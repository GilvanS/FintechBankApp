# Technology Stack

**Analysis Date:** 2026-07-19

## Languages

**Primary:**
- JavaScript (CommonJS) - API backend, `API/index.cjs` (~5700 lines), `API/repositories/*.js`, `API/utils/*.js`, `API/middlewares/*.js`
- TypeScript - WEB frontend (`WEB/*.tsx`, `WEB/services/*.ts`) and MOBILE frontend (`MOBILE/src/**/*.tsx`)

**Secondary:**
- SQL - PostgreSQL schema/migrations (`API/migrations/*.js` via Knex, `API/schema_pg.sql`, `API/schema_pg_fintech.sql`, `API/schema_invoice_lifecycle.sql`), plus a Databricks-flavored schema (`API/databricks_schema.sql` mirrored in `WEB/databricks_schema.sql`, `MOBILE/databricks_schema.sql`)
- Shell/PowerShell - build/dev scripts (`MOBILE/scripts/*.ps1`, `MOBILE/GERAR-APK-DO-ZERO.ps1`)

## Runtime

**Environment:**
- Node.js (API uses `--watch` flag in dev script, requiring Node 18+)
- Browser (WEB) via Vite dev server / static build
- Android via Capacitor WebView (MOBILE), packaged as APK (`MOBILE/android/`)

**Package Manager:**
- npm (all three apps: `API/package.json`, `WEB/package.json`, `MOBILE/package.json`)
- Lockfiles present: `API/package-lock.json`, `WEB/package-lock.json`, `MOBILE/package-lock.json`

## Frameworks

**Core (API):**
- Express 4.21 - HTTP server, all routes defined in `API/index.cjs`
- Knex 3.2 - SQL migration runner only (`API/knexfile.js`); NOT used as query builder at runtime
- Custom `DatabaseFactory` (`API/services/database/DatabaseFactory.js`) - abstracts PostgreSQL vs Databricks providers (`PostgresProvider.js`, `DatabricksProvider.js`, `DatabaseInterface.js`)

**Core (WEB):**
- React 19.2 + React Router DOM 7.18 - SPA routing (`WEB/App.tsx`)
- Vite 6.2 - dev server / bundler (`WEB/vite.config.ts`)
- Tailwind CSS 4.3 (via `@tailwindcss/vite`) - styling
- Recharts 3.9, D3 7.9 - data visualization (Dashboard charts)
- Motion 12.41 (Framer Motion successor) - animations

**Core (MOBILE):**
- Ionic React 8.7 + Ionic React Router 8.7 - mobile UI shell (`MOBILE/src/`)
- Capacitor 7.4 (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/preferences`) - native Android bridge, config in `MOBILE/capacitor.config.json`
- `@aparajita/capacitor-biometric-auth` 10.0 - native biometric login
- React Router DOM 5.3 (older major than WEB's 7.18 — divergent versions between the two frontends)
- React 19.2, Vite 6.2, Tailwind 4.3 - same base tooling as WEB
- Axios 1.13 - HTTP client (WEB uses native `fetch` instead, see `WEB/services/api.ts`)

**Testing:**
- Jest 29.7 + Supertest 6.3 - API tests (`API/tests/*.test.js`, config `API/jest.config.js`)
- Newman 6.1 (+ `newman-reporter-html`) - Postman collection API tests (`API/scripts/run-newman-tests.js`)
- Vitest 4.0 + Testing Library (React/DOM/jest-dom) - WEB and MOBILE unit tests (`WEB/tests/`, `MOBILE/tests/`)
- Appium (referenced extensively in `MOBILE/*.md` docs) - Android E2E/UI automation, selectors documented but harness files not centrally located in `package.json`

**Build/Dev:**
- Vite (WEB, MOBILE) - `vite.config.ts` in each
- TypeScript 5.8 compiler - type checking for WEB/MOBILE
- `swagger-autogen` 2.23 + `swagger-ui-express` 5.0 - API docs generation (`API/swagger-generate.js` → `API/swagger.json`/`swagger.yaml`, served at `/api-docs`)

## Key Dependencies

**Critical (API):**
- `@databricks/sql` 1.12 - Databricks SQL client, used by `DatabricksProvider.js` when `DB_PROVIDER=databricks`
- `pg` 8.16 - PostgreSQL client, used by `PostgresProvider.js` and Knex migrations
- `mysql2` 3.9 - present in dependencies but no evident active MySQL provider (unused/legacy)
- `jsonwebtoken` 9.0 - JWT auth issuance/verification (`API/middlewares/auth.js`, cookie-based `token`)
- `bcryptjs` 3.0 - password hashing
- `helmet` 8.2 - HTTP security headers (`app.use(helmet(...))` in `API/index.cjs:237`)
- `express-rate-limit` 8.5 - login rate limiting (`loginLimiter`, `API/index.cjs:270`)
- `express-validator` 7.3 - request body validation
- `node-cron` 4.6 - scheduled invoice engine runs (`API/services/invoiceEngine.js` invoked via cron)
- `cookie-parser` 1.4 - reads httpOnly `token` cookie for auth

**Infrastructure:**
- `docker-compose.yml` present in `API/` - local DB/service orchestration
- `dotenv` 16.6 - environment variable loading (`API/index.cjs:1`)

## Configuration

**Environment:**
- `.env` file present in `API/` (contents not read — see forbidden files policy); `.env.example` present as template
- Key env vars referenced in code: `PORT`, `JWT_SECRET` (required, app throws at startup if unset), `DB_PROVIDER`/`DB_DIALECT` (`postgres` vs `databricks`), `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_SCHEMA`, `POSTGRES_CONNECTION_STRING`, `NODE_ENV`
- WEB/MOBILE likely use Vite `import.meta.env` vars (`.env` files not enumerated here; check `WEB/vite.config.ts` / `MOBILE/vite.config.ts` for `VITE_*` prefix conventions)

**Build:**
- `API/jest.config.js` - Jest test config
- `API/knexfile.js` - Knex migration config (development/production, PostgreSQL only)
- `WEB/vite.config.ts`, `MOBILE/vite.config.ts` - Vite build config
- `WEB/tsconfig.json`, `MOBILE/tsconfig.json` - TypeScript config
- `MOBILE/capacitor.config.json` - Capacitor native app config (`appId: com.fintechbank.app`, `webDir: dist`)

## Platform Requirements

**Development:**
- Node.js + npm for all three apps
- PostgreSQL (or Databricks workspace credentials) for API
- Android SDK/Gradle for MOBILE native builds (`MOBILE/android/`)
- Windows-oriented dev scripts observed (`.ps1` files, `bash.exe.stackdump` artifacts in API/WEB/MOBILE roots suggest Git Bash usage on Windows)

**Production:**
- API: Node process (`node index.cjs`), Express server on `PORT` (default 3001), PostgreSQL or Databricks backend
- WEB: Static build (`vite build` → `WEB/dist/`) - deployable to static hosting (GitHub Pages artifacts referenced in recent commits: "exports faltantes no mockApi para o build demo do GitHub Pages")
- MOBILE: Capacitor-wrapped Android APK (`MOBILE/android/`), built via `npm run build:mobile` + Gradle

---

*Stack analysis: 2026-07-19*
