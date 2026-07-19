# Testing Patterns

**Analysis Date:** 2026-07-19

## Test Framework

**API (`API/`):**
- Runner: Jest `^29.7.0`
- Config: `API/jest.config.js`
- HTTP assertions: `supertest ^6.3.3` (devDependency)
- Also has Postman/Newman collection-based API tests: `newman ^6.1.2`, `newman-reporter-html`

**WEB (`WEB/`) and MOBILE (`MOBILE/`):**
- Runner: Vitest `^4.0.8`
- Environment: `jsdom ^27.2.0`
- Component testing: `@testing-library/react ^16.3.0`, `@testing-library/dom`, `@testing-library/jest-dom`
- Config: inline `test` block in `WEB/vite.config.ts` / `MOBILE/vite.config.ts` (no separate `vitest.config.ts`)

**Run Commands:**
```bash
# API
cd API
npm test                 # jest
npm run test:watch       # jest --watch
npm run test:coverage    # jest --coverage
npm run test:signup      # jest tests/signup.test.js (single-file example)
npm run test:newman      # Postman/Newman collection run (scripts/run-newman-tests.js)

# WEB / MOBILE
npm test                 # vitest run
npm run test:no-mock     # node scripts/verify-no-mock.js (guards against demo mock leaking into prod build)
```

## Test File Organization

**API:**
- Location: `API/tests/*.test.js`, plus `API/tests/collections/` and `API/tests/helpers/` subdirectories.
- Naming: `<domain>.test.js` (e.g. `subscriptions.test.js`, `billing.test.js`, `billingEngine.test.js`, `cardEngine.test.js`, `security.test.js`, `signup.test.js`, `middlewares.test.js`, `migration_endpoints.test.js`, `transactionReversal.test.js`).
- Jest `testMatch`: `['**/tests/**/*.test.js']` (`API/jest.config.js`).
- Root of `API/` also contains many ad hoc `test_*.js`/`.cjs` debug scripts (e.g. `test_pg.js`, `test_activate.cjs`) — these are NOT part of the Jest suite (outside `tests/`) and are manual debugging scripts, not automated tests. Do not treat them as coverage.

**WEB / MOBILE:**
- Location: `WEB/tests/*.test.{ts,tsx}`, `MOBILE/tests/*.test.{ts,tsx}`.
- Naming mirrors source: `Login.test.tsx`, `HomeView.render.test.tsx`, `InvoiceView.test.tsx`, `Profile.test.tsx`, `mockApi.test.ts`, `api.integration.test.ts` (WEB); `formatters.test.ts`, `hiddenMenu.test.ts`, `ui-components.test.tsx`, `coming-soon.test.tsx`, `api.integration.test.ts` (MOBILE).
- Shared setup file: `tests/setup.ts` in both WEB and MOBILE, referenced via `setupFiles` in the vite `test` config.

## Test Structure

**API (Jest, CommonJS, pt-BR test names):**
```javascript
const { computeNextBillingDate, isSubscriptionDue, validateSubscriptionPayload } = require('../utils/subscriptions');

describe('subscriptions - computeNextBillingDate', () => {
    test('monthly avança 1 mês', () => {
        const next = computeNextBillingDate('monthly', new Date('2026-01-15T00:00:00Z'));
        expect(next.getUTCMonth()).toBe(1);
    });
});
```
- Pure logic (`API/utils/*.js`) is unit-tested directly with `require()`, no mocking needed — this is the preferred style for business-rule tests (dates, validation, whitelists).
- Tests group by function/behavior using nested `describe` blocks (`describe('subscriptions - isSubscriptionDue', ...)`), with edge cases enumerated as separate `test()` calls (due/not-due, cancelled, idempotency, invalid date).

**WEB/MOBILE (Vitest, TSX, pt-BR test names):**
```tsx
describe('Login — renderização', () => {
    it('exibe formulário com campos CPF, senha e botão', () => {
        renderLogin();
        expect(screen.getByTestId('login-input-cpf')).toBeTruthy();
    });
});
```
- Component tests use a local `render<Component>()` helper function that wraps `render()` with required context providers (`AuthContext.Provider`) and default no-op callback props (`vi.fn()`), reducing boilerplate per test case. Follow this pattern for any new component test requiring context.
- Queries use `screen.getByTestId(...)` almost exclusively — components must expose `data-testid` attributes for interactive/error elements (`login-input-cpf`, `login-submit-button`, `login-cpf-error`, `login-error-message`). Check `WEB/LOCATORS_GUIDE.md` for the testid naming convention used across the app (also referenced by MOBILE's Appium/E2E selector docs).
- `beforeEach(() => vi.clearAllMocks())` resets mocks between tests within a `describe` block; auth-flow tests also `localStorage.clear()`.
- Async UI updates are asserted with `await waitFor(() => expect(...))`.

## Mocking

**API:**
- No mocking framework observed in the Jest suite for `utils/` tests — pure functions are tested directly. Supertest is available for HTTP-level integration tests but was not present in the sampled files; check `API/tests/security.test.js` and `API/tests/middlewares.test.js` for handler-level testing patterns before writing new endpoint tests.

**WEB/MOBILE (Vitest):**
```tsx
vi.mock('../services/api', () => ({
    login: vi.fn(),
    getUserMe: vi.fn(),
    getUserStatement: vi.fn(),
    getUserByCpf: vi.fn(),
    requestNewPassword: vi.fn(),
    initializeMockUsers: vi.fn(),
}));

vi.mock('../utils/formatters', () => ({
    formatCPF: (v: string) => v,
}));

vi.mock('../components/Toast', () => ({
    useToast: () => ({ toast: null, showSuccess: vi.fn(), showError: vi.fn(), showInfo: vi.fn(), hide: vi.fn() }),
    ToastContainer: () => null,
}));
```
- `services/api` (and `services/mockApi` where relevant) is always mocked in component tests — never hits the real network.
- `recharts` is globally mocked in `WEB/tests/setup.ts` (and presumably `MOBILE/tests/setup.ts`) to stub chart components (`ResponsiveContainer`, `PieChart`, `BarChart`, etc. all render children or `null`) since chart libraries are slow/unstable in jsdom.
- Mock return values are set per-test with `mockResolvedValueOnce` / `mockReturnValueOnce`, cast via `(api.login as ReturnType<typeof vi.fn>).mockResolvedValueOnce(...)`.

**What to Mock:**
- Network/API service modules, chart libraries, toast/notification hooks, and any external side-effect module.

**What NOT to Mock:**
- Pure utility functions under test (e.g. `formatCPF` tested directly against real implementation in `MOBILE/tests/formatters.test.ts`) — only mock utils when they are dependencies of the component under test, not when they are the test subject.

## Fixtures and Factories

- No dedicated fixtures/factories directory found in WEB/MOBILE tests; test data (mock users, payloads) is inlined per test file as plain object literals (e.g. `const mockUser = { cpf: '11111111111', fullName: 'Admin', ... }` in `WEB/tests/Login.test.tsx`).
- `WEB/data/mockData.ts` / equivalent MOBILE data holds demo/seed users for the mock-API demo mode (CPF `11111111111` / password `1234`) — reusable as reference data but not a formal test factory.
- API has `API/tests/helpers/` and `API/tests/collections/` directories — check these before adding new shared test setup for API tests.

## Coverage

**API:**
```javascript
// API/jest.config.js
collectCoverageFrom: [
    'index.cjs',
    'repositories/**/*.js',
    'middlewares/**/*.js',
    'services/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
],
coverageDirectory: 'coverage',
```
- No enforced coverage threshold configured (no `coverageThreshold` block) — coverage is measured but not gated.
- View: `npm run test:coverage` in `API/`, output in `API/coverage/`.

**WEB/MOBILE:**
- `@vitest/coverage-v8` is a devDependency in WEB (`^4.0.8`); MOBILE's `package.json` does not list a coverage package explicitly — check before assuming coverage tooling exists for MOBILE.
- `WEB/coverage/` directory exists from prior runs, confirming `vitest run --coverage` (or equivalent) has been used, though it's not wired into `package.json` scripts directly — coverage must be invoked manually (`npx vitest run --coverage`).

## Test Types

**Unit Tests:**
- API: pure business logic in `utils/` (date math, validation, whitelists) — no I/O, no mocking.
- WEB/MOBILE: pure utils like `formatCPF`/`formatCurrency`/`parseCurrency` (`MOBILE/tests/formatters.test.ts`).

**Component/Integration Tests:**
- WEB/MOBILE: React component rendering + user interaction via Testing Library (`Login.test.tsx`, `Profile.test.tsx`, `InvoiceView.test.tsx`, `HomeView.render.test.tsx`, `ui-components.test.tsx`).
- `api.integration.test.ts` present in both WEB and MOBILE — exercises the API client layer against expected contracts (check this file directly before adding new endpoints to `services/api.ts`).

**E2E Tests:**
- Not run via Vitest/Jest. MOBILE has extensive Appium-based native/webview E2E documentation (`MOBILE/SELETORES-*.md`, `MOBILE/APPIUM-SELETORES-ANDROID.md`) indicating a separate Appium E2E suite for the packaged Android app — these are documentation-heavy and outside the `npm test` pipeline; treat as a distinct manual/automation track, not part of standard `vitest`/`jest` runs.
- API also has Postman/Newman collection tests (`npm run test:newman`) as a form of black-box API E2E testing, separate from Jest unit tests.

## Common Patterns

**Async Testing (WEB/MOBILE):**
```tsx
await waitFor(() => expect(mockAuthLogin).toHaveBeenCalledWith(mockUser));
expect(localStorage.getItem('authToken')).toBe('jwt-abc');
```

**Error/Failure-path Testing:**
```tsx
(api.login as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false, message: 'CPF ou senha invalida.' });
renderLogin();
// ...trigger submit...
await waitFor(() => {
    const el = screen.getByTestId('login-error-message');
    expect(el.textContent).toContain('CPF ou senha invalida.');
});
expect(mockAuthLogin).not.toHaveBeenCalled();
```

**API date-based logic testing:**
```javascript
const now = new Date('2026-07-19T12:00:00Z');
const sub = { status: 'active', next_billing_date: '2026-07-18T00:00:00Z' };
expect(isSubscriptionDue(sub, now)).toBe(true);
```
- Fixed injected `now`/`from` dates (rather than `Date.now()`) are passed as function parameters to keep date-dependent logic deterministic and testable — follow this pattern for any new time-sensitive business logic.

---

*Testing analysis: 2026-07-19*
