# Coding Conventions

**Analysis Date:** 2026-07-19

## Naming Patterns

**Files:**
- API: `snake_case`/`lowerCamel.js` mixed at repo root (legacy scripts like `check_installment_plans.js`, `reset_all_to_admin999.cjs`), but structured code is `camelCase.js` — repositories use `<domain>Repo.js` (e.g. `API/repositories/subscriptionsRepo.js`), utils use `<domain>.js` (e.g. `API/utils/subscriptions.js`, `API/utils/cardEngine.js`).
- WEB/MOBILE: React components in `PascalCase.tsx` (`WEB/components/Login.tsx`, `WEB/Dashboard.tsx`), custom hooks in `use*.ts` (`WEB/hooks/`), tests mirror source name + `.test.ts(x)` in `tests/` (e.g. `WEB/tests/Login.test.tsx`, `MOBILE/tests/formatters.test.ts`).
- Legacy/root-level `.md` and one-off scripts are numerous and inconsistently named — do not use these as a pattern reference; follow `API/repositories`, `API/utils`, `API/tests`, `WEB/components`, `WEB/tests` instead.

**Functions:**
- `camelCase` throughout — API (`computeNextBillingDate`, `isSubscriptionDue`, `validateSubscriptionPayload` in `API/utils/subscriptions.js`) and WEB/MOBILE (`formatCPF`, `formatCurrency`, `parseCurrency` in `WEB/utils/formatters.ts` / `MOBILE/src/utils/formatters.ts`).
- Boolean predicates prefixed `is*`/`has*` (`isValidFrequency`, `isValidPaymentMethod`, `isSubscriptionDue`).
- Repository functions use short CRUD-style verbs without domain prefix since the module name provides context: `create`, `findById`, `listByCpf`, `cancel`, `findDue` in `API/repositories/subscriptionsRepo.js`.

**Variables:**
- `camelCase` for JS/TS variables; database columns and payload fields stay `snake_case` to match SQL schema (`next_billing_date`, `payment_method`, `last_billing_date`) — this snake_case leaks into JS objects representing DB rows/API payloads intentionally, do not convert to camelCase when touching persistence code.

**Types:**
- WEB `types.ts` and MOBILE `types.ts` hold shared domain types (`User`, `Transaction`, `CreditCard`, etc.) in `PascalCase`. Project convention (per `WEB/CLAUDE.md`) explicitly forbids `any` — use these central types instead.

## Code Style

**Formatting:**
- No `.prettierrc` or `.eslintrc` found in `API/`, `WEB/`, or `MOBILE/` (checked via glob — none present). There is no enforced formatter/linter config; match surrounding code style manually (4-space indentation, single quotes in JS/TS observed consistently).

**Linting:**
- Not configured. No ESLint config files exist in the repo. Do not assume `npm run lint` exists — it is absent from `API/package.json`, `WEB/package.json`, and `MOBILE/package.json` scripts.

## Import Organization

**API (CommonJS):**
- `require()` at top of file, project-relative modules (`./context`, `../utils/subscriptions`) after any core/npm modules. Example from `API/repositories/subscriptionsRepo.js`:
```js
const { getDb, esc } = require('./context');
const { computeNextBillingDate } = require('../utils/subscriptions');
```
- `API/index.cjs` is a single large entry file (5700+ lines) that mounts all routes — new routes should generally be added there unless refactoring into `services/`/`repositories/`.

**WEB/MOBILE (ESM/TS):**
- External libs first, then relative imports, then type-only or mock declarations. Example from `WEB/tests/Login.test.tsx`:
```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Login from '../components/Login';
import { AuthContext } from '../context/AuthContext';
```

**Path Aliases:**
- WEB/MOBILE Vite configs define `@` → project root (`WEB/vite.config.ts`: `{ find: '@', replacement: path.resolve(__dirname, '.') }`). WEB additionally aliases `./services/api` → `./services/mockApi.ts` when `VITE_USE_MOCK_API=true`, enabling demo mode without touching source imports.

## Error Handling

**API:**
- Routes wrap logic in `try { ... } catch (err) { ... }` and respond with `res.status(500).json({ success: false, message: '<pt-BR message>' })` on failure (`API/index.cjs`, dozens of occurrences). Domain validation errors are thrown as `throw new Error('<message>')` and caught by the surrounding handler rather than a global error middleware.
- All user-facing error/success messages are in Portuguese (pt-BR) — match this language when adding new endpoints.
- Repositories return `null`/`{ cancelled: false, notFound, forbidden }`-style result objects instead of throwing for expected "not found"/"forbidden" conditions (see `cancel()` in `API/repositories/subscriptionsRepo.js`); throwing is reserved for genuinely exceptional/programmer errors.

**WEB/MOBILE:**
- `WEB/components/ErrorBoundary.tsx` provides a top-level React error boundary.
- API calls in components are wrapped and mapped to UI error state (`showError`/toast pattern) rather than thrown further; see `Login.test.tsx` asserting `login-error-message` testid content on API failure.

## Comments

**When to Comment:**
- Sparse, purposeful comments explaining *why*, especially around security-sensitive or non-obvious logic — e.g. `API/repositories/subscriptionsRepo.js`: `// Toda query usa esc() — nunca interpolar valores crus (anti SQL injection).` and `// Cancela por posse: só cancela se o id pertence ao cpf (defesa em profundidade...)`.
- Comments are written in Portuguese, matching the domain/business language of the app.

**JSDoc:**
- Pure utility/business-logic functions in API `utils/` use JSDoc blocks documenting params and return types (see `computeNextBillingDate`, `isSubscriptionDue` in `API/utils/subscriptions.js`) even though the codebase is plain JS (not TypeScript) on the API side.

## Function Design

**Size:** Utility functions are small and single-purpose (a few lines each), consistent with the "pure logic separated from persistence" split described below.

**Module Design (API):**
- Explicit separation: `API/utils/<domain>.js` holds pure business logic (validation, date math) with no I/O; `API/repositories/<domain>Repo.js` holds all persistence (SQL via `esc()`-escaped template queries, no raw interpolation); `API/index.cjs` wires routes to repositories/utils. When adding a new domain feature, follow this three-layer split (utils → repositories → index.cjs route).
- All repository queries use the `esc()` helper (`require('./context')`) to escape values — never interpolate raw user input into SQL strings.

**Module Design (WEB/MOBILE):**
- `services/api.ts` is the real backend client; `services/mockApi.ts` is a parallel localStorage-backed implementation with the same exported function signatures, swapped via Vite alias for demo builds. New API functions must be added to both files to keep demo mode functional.
- Components receive navigation via either parent callbacks (`onNavigateToSignUp`, `onNavigateToPreLogin`) or `useNavigate()` — see `WEB/CLAUDE.md`. Match whichever pattern the containing screen already uses.
- No `any` types — use/extend `types.ts` in WEB and MOBILE respectively.

## Language/Locale Convention

- All user-facing strings, error messages, and code comments are Portuguese (pt-BR). Test descriptions (`describe`/`it`/`test` labels) are also written in Portuguese across both API Jest tests and WEB/MOBILE Vitest tests (e.g. `'monthly avança 1 mês'`, `'exibe formulário com campos CPF, senha e botão'`). Follow this convention for all new test names and UI copy.

---

*Convention analysis: 2026-07-19*
