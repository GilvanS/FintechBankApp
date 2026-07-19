# Codebase Concerns

**Analysis Date:** 2026-07-19

## Tech Debt

**Monolithic API entry point:**
- Issue: `API/index.cjs` is 5,702 lines — routes, validation, CORS, rate limiting, JWT signing, and business logic all live in one file instead of `API/routes/`, `API/services/`, `API/repositories/` layers that partially exist.
- Files: `API/index.cjs`
- Impact: Very hard to review, high merge-conflict risk, no clear module boundaries; new features keep getting appended to this file (e.g. subscriptions/card-engine work below adds separate repos/utils but the routes likely still land back in `index.cjs`).
- Fix approach: Extract route groups (auth, cards, pix, billing, admin) into `API/routes/*.js` files mounted on `apiRouter`; move inline validation/CORS/rate-limit config into `API/middlewares/`.

**Repo root cluttered with planning/scratch artifacts:**
- Issue: Dozens of top-level `.md` planning docs (`ANALISE-E-PLANO.md`, `BUGS-2025-11-26.md`, `PLANO-CORRECAO-BACKEND.md`, `CONFIG-IP-FIXO-WINDOWS.md`, etc.), a Windows `.exe` (`Gerador de CPF.exe`), and garbage-named files (`,+,`, `0,+`, `{,+`, `,`) are committed to the repo root.
- Files: repo root (`F:\GITHUB\FintechBankApp\`)
- Impact: Repo is hard to navigate, obscures which docs are current, and the stray files (empty/odd names) suggest broken shell redirections were accidentally committed. `git status` at session start also shows deleted stray files (`API/({,+`, `API/{`) still tracked.
- Fix approach: Move planning docs into `.planning/` or `docs/archive/`, delete the `.exe` and garbage files, add `.gitignore` rules to prevent redirection artifacts from being committed again.

**WEB frontend has no `src/` structure:**
- Issue: `WEB/` has all components (`App.tsx`, `Dashboard.tsx`, `Login.tsx`, `Pix.tsx`, `Statement.tsx`, etc.) flat in the project root alongside build scripts (`fix.js`, `fix_modals.cjs`, `port_all_components.py`, `port_home_view.py`) and zip archives (`volt-fintech.zip`, `volt-fintech (1).zip`).
- Files: `WEB/*.tsx`, `WEB/fix.js`, `WEB/fix_modals.cjs`, `WEB/port_all_components.py`
- Impact: No conventional React project layout; one-off migration/porting scripts sit next to production code, and a filename `WEB/origin.startsWith(o))` (invalid JS fragment used as a filename) and `WEB/bash.exe.stackdump` indicate a crashed shell/tool accidentally wrote artifacts into the tree.
- Fix approach: Reorganize into `WEB/src/{components,pages,services}`, delete port/fix scripts and zip archives once migration is verified complete, remove the malformed filename and stackdump.

**Duplicated mock API logic between MOBILE and WEB:**
- Issue: `MOBILE/src/services/mockApi.ts` (1,014 lines) duplicates API-shape logic that likely also exists for WEB (per recent commit `e37de05c fix(web): exports faltantes no mockApi para o build demo do GitHub Pages`), risking drift between mock and real API contracts.
- Files: `MOBILE/src/services/mockApi.ts`, `MOBILE/src/services/api.ts` (1,344 lines)
- Impact: Demo/GitHub Pages builds can silently diverge from real backend behavior; missing-export bugs (as the recent commit shows) recur when the two aren't kept in sync.
- Fix approach: Extract a shared mock-data/contract package or generate mocks from the same TypeScript types used by `api.ts`.

**Oversized React components (MOBILE):**
- Issue: Several components exceed the project's own 500-line guideline (`CLAUDE.md`: "Keep files under 500 lines") by 2-6x.
- Files: `MOBILE/src/components/HomeView.tsx` (2,793 lines), `MOBILE/src/components/CardsView.tsx` (1,300), `MOBILE/src/components/LimitView.tsx` (1,250), `MOBILE/src/components/Header.tsx` (1,063), `MOBILE/src/components/Dashboard.tsx` (950), `MOBILE/src/components/ShopView.tsx` (902), `MOBILE/src/components/Admin.tsx` (833), `MOBILE/src/components/Profile.tsx` (810)
- Impact: Hard to test, review, or safely modify; likely mixes multiple concerns (UI, state, API calls) in a single file.
- Fix approach: Split into subcomponents/hooks (e.g. `useCardsView`, `CardsList`, `CardsFilters`) following patterns already used in smaller components.

**New in-progress feature not yet wired in cleanly:**
- Issue: `API/repositories/subscriptionsRepo.js`, `API/utils/subscriptions.js`, `API/utils/cardEngine.js`, and their tests (`API/tests/subscriptions.test.js`, `API/tests/cardEngine.test.js`) plus `API/scripts/create-subscriptions-table.js` are untracked/uncommitted in git status.
- Files: listed above (all currently untracked per `git status`)
- Impact: Work-in-progress feature (subscriptions/card engine) risks being lost, and there's no visibility into whether routes in `index.cjs` actually call these new modules.
- Fix approach: Confirm integration into `index.cjs` routes, add to git, and commit as a coherent feature slice.

## Known Bugs

**Password validation error message bug:**
- Symptoms: In the express-validator error handler, `errors.array().map(err => err.msg || err.msg)` — both sides of the `||` reference the same property, so any custom fallback message intended for malformed error objects can never apply.
- Files: `API/index.cjs` (handleValidationErrors, ~line 246)
- Trigger: Any validation failure with a non-standard error shape (e.g. from a custom validator) — falls through to the same `.msg`, which may be `undefined`.
- Workaround: None currently; message defaults to `undefined` string in the joined error list when `.msg` is missing.

## Security Considerations

**Password reset scripts with hardcoded default committed to repo:**
- Risk: `API/reset_all_to_admin999.cjs` bulk-resets every user's password in the database to the literal string `admin999`, connects with DB credentials that default to `postgres`/`postgres` if env vars are missing, and is committed alongside `API/reset_passwords.cjs` and `API/set_password.cjs`.
- Files: `API/reset_all_to_admin999.cjs`, `API/reset_passwords.cjs`, `API/set_password.cjs`
- Current mitigation: None visible — no guard against running in production, no confirmation prompt, defaults silently fall back to weak credentials.
- Recommendations: Move these to a `scripts/dev-only/` directory excluded from production deploys, require an explicit `--confirm-prod` flag or environment check (`NODE_ENV !== 'production'`), and never allow credential fallback to hardcoded `postgres`/`postgres`.

**CORS allows any localhost/private-network origin plus prefix-matching bypass risk:**
- Risk: `corsOptions.origin` in `API/index.cjs` allows any origin starting with `http://localhost`, `capacitor://localhost`, `http://192.168.`, or `http://10.0.2.2`, and uses `.startsWith()` against `ALLOWED_ORIGINS` rather than exact match (e.g. `https://GilvanJSSousa.github.io.evil.com` would NOT match with `startsWith` unless origin equals exactly the prefix — but `startsWith` on `origin.startsWith(o)` for private IP ranges is broad: any host on the `192.168.x.x` or `10.0.2.2` range, not just the app's dev machine).
- Files: `API/index.cjs` (ALLOWED_ORIGINS / corsOptions, ~lines 217-235)
- Current mitigation: `credentials: true` combined with broad localhost/private-IP allowances is scoped to dev-like origins, reducing production risk somewhat.
- Recommendations: Gate the localhost/private-IP allowances behind `NODE_ENV !== 'production'`; in production, only allow the exact GitHub Pages origin and configured mobile app origins.

**Env files present in working tree (contents not inspected, existence noted only):**
- Risk: `API/.env`, `MOBILE/.env`, `MOBILE/.env.local` exist locally; if any were ever committed to git history, secrets (DB credentials, JWT secret) could be exposed.
- Files: `API/.env`, `MOBILE/.env`, `MOBILE/.env.local` (existence only — contents not read)
- Current mitigation: `.gitignore` present at repo root; `API/.env.example` exists as a template, suggesting real `.env` is meant to stay untracked.
- Recommendations: Verify with `git log --all -- API/.env` that these were never committed; rotate `JWT_SECRET` and DB credentials if history shows any prior commit of `.env` files.

**Verbose request/body logging on validation failure:**
- Risk: `handleValidationErrors` in `API/index.cjs` logs `JSON.stringify(req.body)` on every validation failure via `console.log`, which can include sensitive fields (passwords, CPF, card data) submitted by the client.
- Files: `API/index.cjs` (~lines 244-251)
- Current mitigation: None — logs unconditionally regardless of environment.
- Recommendations: Redact sensitive fields (password, cpf, card numbers) before logging, or gate verbose logging behind `NODE_ENV === 'development'`.

## Performance Bottlenecks

**Single 5,702-line request-handling file:**
- Problem: All routes are parsed/loaded in one module at boot; no code-splitting by route domain.
- Files: `API/index.cjs`
- Cause: Monolithic structure (see Tech Debt above) rather than a genuine runtime bottleneck — but it increases cold-start parse time and makes profiling per-domain performance difficult.
- Improvement path: Split into per-domain route modules; this also enables lazy-loading rarely used admin routes.

## Fragile Areas

**`API/index.cjs` as single point of failure:**
- Files: `API/index.cjs`
- Why fragile: Auth, CORS, validation, rate limiting, and all business routes are interleaved in one 5,700-line file; a syntax error or bad edit anywhere breaks the entire API, not just one feature.
- Safe modification: Add new routes at the end of existing route groups matching established patterns; avoid modifying shared middleware (`corsOptions`, `handleValidationErrors`, `loginLimiter`) without full regression testing via `API/tests/`.
- Test coverage: `API/tests/` has 20 files including `security.test.js`, `middlewares.test.js`, `billing.test.js`, `migration_endpoints.test.js` — reasonable breadth, but with the route logic concentrated in one file, test-to-code traceability is harder to verify.

**MOBILE `HomeView.tsx` (2,793 lines):**
- Files: `MOBILE/src/components/HomeView.tsx`
- Why fragile: Extreme size for a single component suggests deeply nested state/conditional rendering; any change risks unintended side effects across unrelated UI sections.
- Safe modification: Add new sections as extracted subcomponents rather than inline additions; write component-level tests before refactoring given MOBILE has only 5 test files total.
- Test coverage: Only 5 test files found under `MOBILE` (vs. 20 in `API`) — component-level coverage for large files like `HomeView.tsx`, `CardsView.tsx`, `LimitView.tsx` is likely minimal to none.

## Scaling Limits

**Not assessed:** No load-testing artifacts, connection-pool sizing docs, or capacity numbers found in this pass. `API/index.cjs` uses `pg`/`knex`/`@databricks/sql` simultaneously (three data-access libraries) — worth confirming whether all three are actively used or represent leftover experimentation, since maintaining three DB client stacks multiplies scaling/ops complexity.

## Dependencies at Risk

**Three separate database client libraries in API:**
- Risk: `API/package.json` depends on `pg` (PostgreSQL), `mysql2` (MySQL), and `@databricks/sql` simultaneously, alongside `knex` as query builder.
- Impact: Unclear which are live vs. vestigial; each adds attack surface, install size, and potential version-conflict risk without clear ownership.
- Migration plan: Audit actual usage (`grep -r "require('pg')\|require('mysql2')\|@databricks/sql"` across `API/`) and remove unused clients; standardize on one primary DB driver (PostgreSQL, per the user's memory notes referencing `pgdb`).

## Test Coverage Gaps

**MOBILE component tests:**
- What's not tested: Large UI components (`HomeView.tsx`, `CardsView.tsx`, `LimitView.tsx`, `Header.tsx`, `Dashboard.tsx`, `Admin.tsx`) have no evident dedicated test files given only 5 total `.test.*` files exist under `MOBILE`.
- Files: `MOBILE/src/components/*.tsx`
- Risk: UI regressions (broken flows like PIX, card management, limits) can ship undetected.
- Priority: High — these are core banking flows (cards, limits, PIX, admin).

**WEB frontend test coverage:**
- What's not tested: Only 6 `.test.*` files found under `WEB`, and the directory structure itself is non-standard (flat, no `src/`), making it unclear whether tests exist for most top-level components (`Dashboard.tsx`, `Pix.tsx`, `Statement.tsx`, `Login.tsx`, `SignUp.tsx`).
- Files: `WEB/*.tsx`
- Risk: Same class of undetected regressions as MOBILE, compounded by unclear project structure.
- Priority: Medium-High.

**New subscriptions/card-engine feature:**
- What's not tested: Tests exist (`API/tests/subscriptions.test.js`, `API/tests/cardEngine.test.js`) but the feature files themselves are untracked in git — coverage may not reflect what actually ships if these files are lost or only partially committed.
- Files: `API/repositories/subscriptionsRepo.js`, `API/utils/subscriptions.js`, `API/utils/cardEngine.js`
- Risk: Untracked work can be lost or diverge from what reviewers see in PRs.
- Priority: Medium — resolve by committing the feature as a whole.

---

*Concerns audit: 2026-07-19*
