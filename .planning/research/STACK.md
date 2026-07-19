# Stack Research

**Domain:** Internal admin/back-office panel UI (data tables, forms, approval workflows, confirmation dialogs) on top of an already-built REST API, mirrored across React web + Ionic/Capacitor mobile
**Researched:** 2026-07-19
**Confidence:** MEDIUM

## Context

This is a subsequent-milestone stack decision, not a greenfield one. WEB and MOBILE already share: React 19.2, TypeScript 5.8, Vite 6.2, Tailwind CSS 4.3 (`@tailwindcss/vite` + `@tailwindcss/forms`), `lucide-react` (icons), `motion` (animations), `recharts`/`d3` (charts). Neither app has a component library (no MUI, AntD, Chakra, shadcn). MOBILE additionally has the full Ionic React 8.7 component set (`@ionic/react`) and `react-imask` for masked inputs. Per PROJECT.md, this milestone must not introduce a "new heavy dependency" — so every recommendation below is judged against what's already installed, and new deps are proposed only where nothing existing can do the job.

The admin panel needs: sortable/filterable/paginated data tables (user lists, card lists, request queues), ~10+ distinct forms (limit adjustment, password reset, invoice date adjustment, billing config, etc.), an approval workflow UI (already exists partially in `Admin.tsx`, needs to be ported into the new screen), and confirmation dialogs for destructive/financial actions (block user, force invoice cycle, mass transaction simulation).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TanStack Table | `^8.x` (stable; v9 is beta as of mid-2026, not production-ready) | Headless data table state (sorting, filtering, pagination, row selection) for admin lists on WEB and MOBILE | Renders nothing itself (~14.6kB) — you own the markup and style it with the Tailwind already in both apps. This is the standard 2025-2026 choice for React admin tables when not adopting a full component-library grid (MUI DataGrid, AntD Table), which this project explicitly should avoid. Framework-agnostic core also works inside Ionic's React components without conflict. |
| react-hook-form | `^7.66.x` | Form state/validation for the ~10+ admin forms (user limit adjustment, password reset, billing config, invoice date adjustment, etc.) | Uncontrolled-input design means minimal re-renders even with many fields per form — matters here because several admin forms are dense (e.g. billing config has multiple numeric/date fields). Standard 2025-2026 choice over hand-rolled `useState` forms for anything beyond 2-3 fields, and a much better fit for this SPA+REST architecture than React 19's `useActionState`/form actions (which target server-rendered/Next.js-style server actions, not applicable here since API calls go through `services/api.ts`). Small footprint, no dependency on a design system. |
| zod + `@hookform/resolvers` | `zod@^4.1.x`, `@hookform/resolvers@^5.2.x` | Schema validation for admin forms, shared between the resolver and TypeScript types | Bridges react-hook-form to a single schema definition per form — write validation once, get the TS type for free. Appropriate here because several admin actions are financially sensitive (limit changes, forced billing cycles) and deserve real schema validation (min/max, required PIN, numeric ranges) rather than ad hoc `if` checks scattered through submit handlers. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `<dialog>` element (no package) | Baseline browser API, widely available since March 2022 (~96% global support) | Confirmation dialogs for destructive/financial admin actions on WEB (block user, force invoice cycle, mass simulate) | Use instead of adding Radix UI/shadcn. `showModal()` gives automatic focus trap, `aria-modal`, and background `inert` for free — the exact accessibility guarantees a confirmation dialog needs — with zero new npm dependency. Wrap it once as a small `ConfirmDialog.tsx` component (`useRef` + `useEffect` syncing `isOpen` to `showModal()`/`close()`) and reuse it across all destructive WEB admin actions. |
| `IonAlert` / `IonActionSheet` (already in `@ionic/react`) | Already installed (`@ionic/react@^8.7.9`) | Confirmation dialogs for the same destructive admin actions on MOBILE | No new dependency — these ship with Ionic already in `MOBILE/package.json`. Use `role="destructive"` on the dangerous button (placed first/top per iOS convention) and `role="cancel"` for the escape path. Because `isOpen` is one-way bound, always pair it with a `didDismiss`/`ionAlertDidDismiss` listener that resets state — a common bug source if skipped. |
| `react-imask` (already in `MOBILE/package.json`, not yet in WEB) | `^7.6.x` | Masked numeric/currency inputs in admin forms (limit values, IOF/juros fields) | Already used on MOBILE; consider adding the same version to WEB for parity rather than introducing a different masking library — keeps the mirrored WEB↔MOBILE pattern intact for form inputs that need currency/CPF-style masks. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Existing Vitest + Testing Library setup | Unit/integration tests for new table/form/dialog components | No new test tooling needed; both apps already have `vitest`, `@testing-library/react`, `jsdom` configured. |
| `@tailwindcss/forms` (already installed) | Base form-element styling reset | Already in both `WEB/package.json` and `MOBILE/package.json` devDependencies — use it as the styling baseline for new admin form inputs instead of writing custom resets. |

## Installation

```bash
# WEB
cd WEB
npm install react-hook-form zod @hookform/resolvers @tanstack/react-table react-imask

# MOBILE (react-imask already present; add the rest for parity)
cd MOBILE
npm install react-hook-form zod @hookform/resolvers @tanstack/react-table
```

No dev-dependency additions needed — existing Vitest/Testing Library/TypeScript toolchain covers testing and type-checking for all new code.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| TanStack Table (headless) | MUI DataGrid / AntD Table / a full admin UI kit (Refine, React Admin) | Only if this were a greenfield project or the team planned to rebuild the *entire* WEB/MOBILE UI on a component library — not appropriate here since it would mean re-theming every existing screen or living with a visual seam between old and new UI. |
| Native `<dialog>` (WEB) | Radix UI `AlertDialog` / shadcn | If the project later adds more complex overlay needs (popovers, comboboxes, nested dialogs) beyond simple confirm/cancel, Radix's primitive set becomes worth the added dependency. For this milestone's scope (yes/no confirmations on destructive actions), native `<dialog>` is sufficient and avoids the new dependency. |
| react-hook-form + zod | React 19 `useActionState`/`<form action>` | Appropriate for Next.js-style apps with server actions. Not a fit here — this is a Vite SPA calling a separate Express REST API via `services/api.ts`, so there is no server action boundary to hook into. |
| react-hook-form + zod | Manual `useState` per field | Fine for the simplest 1-2 field forms (e.g. a single confirm-with-reason text box) — react-hook-form is overkill there. Reserve react-hook-form for the denser forms (billing config, user limit adjustment) where field count and validation rules justify it. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| A full admin framework (React Admin, Refine, AdminJS) | Heavy dependency footprint, assumes it owns routing/data-layer conventions, and fights the project's existing mirrored WEB↔MOBILE architecture and existing `AuthContext`/routing setup | Compose the admin screen from the project's existing patterns (React Router routes on WEB, Ionic React Router on MOBILE) plus the lightweight libraries above |
| MUI, AntD, Chakra, or any full component library | Introduces its own design system/theming that conflicts with the existing hand-built Tailwind styling used everywhere else in WEB/MOBILE; large bundle addition for a study project | Continue with Tailwind + `@tailwindcss/forms` + headless libraries (TanStack Table, native `<dialog>`) |
| TanStack Table v9 | Still in beta as of mid-2026 — not appropriate for a fintech-flavored admin surface handling money-adjacent actions (limits, billing) | TanStack Table v8 (stable) |
| Radix/shadcn for WEB confirmation dialogs | Adds a new dependency chain when the native `<dialog>` element already covers the accessibility requirements (focus trap, `aria-modal`, inert background) for simple confirm/cancel flows | Native `<dialog>` element wrapped in a small reusable `ConfirmDialog.tsx` |
| A second masking library on WEB (e.g. `react-number-format`) | Would diverge from MOBILE's existing `react-imask`, breaking the mirrored-component convention this project has followed | Add `react-imask` to WEB too, matching MOBILE's existing version |

## Stack Patterns by Variant

**On WEB:**
- Confirmation dialogs → native `<dialog>` + `showModal()`
- Data tables → `@tanstack/react-table` core + hand-styled `<table>` markup with Tailwind
- Because WEB has no native dialog/list primitives (unlike Ionic) and must be built from HTML + Tailwind directly, same as the rest of the existing WEB codebase

**On MOBILE:**
- Confirmation dialogs → `IonAlert`/`IonActionSheet` (already installed, no new dependency)
- Data tables → `@tanstack/react-table` core for state, but rendered as `IonList`/`IonItem` rows (not an HTML `<table>`) to stay consistent with Ionic's touch-friendly list idiom and the rest of MOBILE's existing screens
- Because Ionic already ships purpose-built mobile UI primitives that fit the platform's interaction model better than desktop-style tables/dialogs

**Shared across both:**
- Form state/validation → react-hook-form + zod schema per form, since both apps run the same React 19 + TypeScript stack and can literally share the zod schema files between WEB and MOBILE (place them in a location both can import, or duplicate per the project's existing mirrored-file convention if no shared package exists)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@tanstack/react-table@^8.x` | React 19.2 | v8's peer dependency range covers React 16.8-19; confirmed working with React 19 in current ecosystem usage. Avoid v9 (beta) until it reaches stable. |
| `react-hook-form@^7.66.x` | React 19.2 | Current 7.x line supports React 19 (uncontrolled-component design means it has few React-version-sensitive internals). |
| `@hookform/resolvers@^5.2.x` | `react-hook-form@^7.x` + `zod@^4.x` | Resolvers v5 line targets Zod v4's schema API; do not mix with an older Zod v3 project convention if one exists elsewhere in the codebase — check for a stray `zod@3.x` before adding v4. |
| Native `<dialog>` | All target browsers/WebViews for this project (desktop browsers for WEB, Android Capacitor WebView for MOBILE-if-ever-used-on-web-build) | MOBILE renders through Ionic components, not raw `<dialog>`, so this compatibility note is WEB-only. |

## Sources

- TanStack Table official docs (tanstack.com/table) — sorting/pagination guides, v8 vs v9 status — MEDIUM confidence (web search, cross-checked against GitHub releases)
- react-hook-form + Zod + `@hookform/resolvers` current version numbers — MEDIUM confidence (web search, cross-checked against GitHub `react-hook-form/resolvers` repo and multiple 2025/2026 guides)
- Ionic Framework official docs (`ionicframework.com/docs/api/alert`, `.../action-sheet`) — button role conventions, `isOpen` binding behavior — MEDIUM confidence (official docs cited directly in search results)
- Native `<dialog>` element browser support and React integration pattern — MEDIUM confidence (web search, cross-checked across multiple 2025/2026 accessibility-focused articles; Baseline support status is well-established)
- Direct inspection of `WEB/package.json` and `MOBILE/package.json` for current installed dependencies — HIGH confidence (primary source, read directly)

---
*Stack research for: internal admin/back-office panel UI on existing React + Ionic/Capacitor fintech study app*
*Researched: 2026-07-19*
