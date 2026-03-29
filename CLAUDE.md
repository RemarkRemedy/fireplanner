# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Singapore FIRE (Financial Independence, Retire Early) + Property + Investment Retirement Planner. A fully client-side web application for comprehensive retirement planning tailored to Singapore residents.

**Status:** Shipped. Fully client-side app deployed to Cloudflare Pages. Monte Carlo simulation (Web Worker), 12 withdrawal strategies, historical backtesting, sequence risk stress testing, dashboard, property analysis, scenario save/load, Excel/JSON export, and reference guide.

**Remaining gaps:**
- Property hybrid MC overlay (5 discrete weighted property scenarios per MC path)
- Scenario side-by-side comparison view (save/load works, parallel compare panel does not exist)
- Household survivor spending model: when one partner passes, joint expenses should adjust (survivor ratio ~70-80% of couple costs, or shift deceased's 50% share onto survivor's portfolio). Currently the quick estimate splits 50/50 and stops the deceased's share at death.

**Deployment:** Cloudflare Pages via `wrangler pages deploy`. No server. Sentry and PostHog intentionally skipped (privacy-first, no-server-contact promise).

**Source of truth:** When the master plan (`FIRE_PLANNER_MASTER_PLAN_v2.md`) and this file conflict, the master plan wins for calculation logic, formulas, Singapore-specific rules, and domain requirements. This file wins for technology choices, architecture decisions, and implementation patterns.

## Architecture

**Routing:** React Router v6 with `createBrowserRouter`. Route components live in `pages/` as plain components (e.g., `InputsPage.tsx`). Do NOT use Next.js file-based routing conventions (`page.tsx`, `layout.tsx` in nested folders).

**State:** 7 Zustand stores (profile, income, allocation, simulation, withdrawal, property, ui). Dashboard metrics are **derived hooks**, not a store — the dashboard owns no state, it computes views from other stores.

All heavy computation (Monte Carlo, backtest, sequence risk, SWR optimization) runs in a Web Worker (`lib/simulation/simulation.worker.ts`) to avoid blocking the UI.

**Data persistence:** All user data stays in browser via localStorage (Zustand persist middleware), JSON export/import for portability, URL params for view state. No authentication, no server storage.

**Hybrid standalone pages:** Any page that works as a standalone entry point (e.g., `/cpf-planner`, `/goal-calculator`) must have bidirectional data flow with the main planner stores. Read from existing stores to pre-fill inputs. Write back to stores when the user enters data. This ensures seamless transitions between standalone tools and the full planner. Priority order for input values: (1) URL search params from shared links, (2) existing store values, (3) defaults. No new Zustand stores for standalone pages — use existing stores via `setField()`.

**Key directories:** `pages/` (route components), `components/` (UI by domain), `stores/` (7 Zustand stores), `hooks/` (derived calculations), `lib/calculations/` (pure calculation functions), `lib/simulation/` (MC/backtest/SR worker), `lib/data/` (SG-specific constants), `lib/validation/` (Zod schemas + cross-store rules). Use `Glob` or `ls` to discover specific files. The router (`router.tsx`) defines all routes.

## Computation Architecture

The 12 withdrawal strategies are implemented once in `lib/calculations/withdrawal.ts` — used by both deterministic views and simulation engines. No cross-language parity concern.

All simulations (MC, backtest, sequence risk) use **annual steps**. The rebalancing frequency option in the UI is informational — it does not change simulation granularity. Do not implement sub-annual simulation steps.

## Validation

Validation runs **before** any calculation. Invalid inputs must not propagate through the store dependency chain. Zod schemas in `lib/validation/schemas.ts`, cross-store rules in `lib/validation/rules.ts`. Calculation hooks check upstream store validity before computing — return `null` with error flag if invalid. Simulation runs are gated on valid inputs.

## Key Domain Constraints

- **All values in SGD.** USD-denominated assets converted at user-specified or historical FX rates.
- **Singapore-only.** All tax, CPF, property, and regulatory logic is Singapore-specific. No multi-country support. Data files in `lib/data/` are structured as standalone modules so future locale support could swap implementations, but do not build abstraction for it now.

## Testing

Vitest with property-based tests via `fast-check`. Each `.ts` in `lib/` has a corresponding `.test.ts`. 3 integration test scenarios in `lib/integration.test.ts`. Coverage: `lib/calculations/` >= 95%, `lib/simulation/` >= 90%, `lib/math/` >= 90%, `lib/validation/` >= 90%.

## Do Not

- **Do not use `any` type** in TypeScript calculation functions. All inputs and outputs must be typed.
- **Do not hardcode Singapore-specific values** in calculation functions. CPF rates, tax brackets, ABSD rates, Bala's Table data — all go in `lib/data/` files.
- **Do not use `Math.random()`** for Monte Carlo. Use `SeededRNG` from `lib/math/random.ts` for deterministic, reproducible simulations.
- **Do not call simulation functions on the main thread.** Always use the Web Worker via `workerClient.ts`.
- **Do not use Next.js conventions.** No `page.tsx` / `layout.tsx` nested folder routing. This is React Router v6 with Vite.
- **Do not create a dashboard Zustand store.** Dashboard metrics are derived hooks that read from other stores. `useUIStore` handles UI-only state (active section, nudges), not dashboard data.
- **Do not create a scenarios Zustand store.** Scenario save/load lives in `lib/scenarios.ts` (utility module, not a store).
- **Do not add a backend server** for computation or user data storage. All financial computation runs client-side. Browser-only persistence for user data. **Exception:** Three Cloudflare Pages Functions exist for lead capture and feedback:
  1. `POST /api/email-signup` — email address, source tag, and feature interest (general signups)
  2. `POST /api/expense-tracker-signup` — email, expense tracking status, primary device, source surface, copy variant, page path, and submission timestamp (expense tracker early access)
  3. `POST /api/feedback` — feedback message, optional email, expense tracker interest flag, and page path (exit intent feedback modal)
  All use D1 storage with rate limiting. No financial data leaves the browser.
- **Do not skip validation.** Every calculation hook must check input validity before computing.
- **Do not import from one store inside another store's definition.** Cross-store reads happen in hooks and components, not in store definitions.
- **Do not mix dollar bases in views OR computation.** When a table, chart, or comparison shows values across multiple columns/series, ALL values must be in the same dollar basis (all today's dollars OR all future/nominal dollars). If one column is inflation-adjusted to a future date, every other monetary column must be too. Project portfolios forward at expected net return, inflate expenses at the inflation rate, over the same time horizon. **The same rule applies to computation:** this codebase has two computation contexts — (1) year-by-year simulation engines (projection.ts, MC, SR) that work in **nominal terms** and inflate everything at each timestep, and (2) steady-state FIRE metrics (`computeMetrics` via `calculateAllFireMetrics` + `projectPortfolioAtRetirement`) that work in **real terms** using `netRealReturn = expectedReturn - inflation - fees`. Never copy inflation logic from a nominal-context engine into a real-context model, or vice versa. The disruption preview lump sum bug (Mar 2026) was caused by importing `lumpSum * (1+i)^years` from the MC engine (nominal) into `computeMetrics` (real), over-estimating the impact by up to 45%.
- **Do not change the calculation engine without updating the display layer, or vice versa.** Tax deductions, CPF contributions, and other auto-computed values appear in both the engine (`lib/calculations/`) and UI summary panels (e.g., `TaxReliefSection`'s "Auto-calculated deductions"). When adding, removing, or modifying a deduction or parameter in one layer, update the other in the same commit. The RSTU bug (Feb 2026) was caused by the engine correctly deducting SA top-ups from chargeable income while the UI panel never displayed or totalled the deduction.
- **Do not deploy to production without explicit user approval.** Only deploy to production when the user explicitly says "deploy to production". The word "deploy" alone is not sufficient — it must specifically reference production. Preview/branch deployments for testing are fine without approval, but production deploys require an unambiguous go-ahead.
- **Do not use em dashes (—) in user-facing copy.** Use commas, periods, colons, or exclamation marks instead. Em dashes are acceptable in code comments but never in UI text, tooltips, helper text, button labels, or any string the user sees.
- **Do not aggregate inputs before computing when adding multi-entity support.** Always compute per-entity first, then merge outputs. Regulatory caps (CPF OW/AW ceilings), progressive brackets (income tax), and threshold-based logic (SRS caps, BHS limits, CPF extra interest) are per-person by nature. If you find yourself writing an adapter that sums two adults' salaries/balances into one `ProfileState` before feeding it to a single-person calculation function, that's the wrong architecture. The joint CPF ceiling bug (Mar 2026) was caused by `runtimeLegacyInputs.ts` merging two adults into one IncomeState ($144K combined salary hitting one $96K OW ceiling), losing ~33% of CPF contributions. The fix: `compileHouseholdPlan` already computed per-adult projections with correct per-person caps; `useIncomeProjection` now merges those outputs instead of re-running a single aggregated projection.

## Coding Conventions

These conventions reduce ambiguity for AI agents and maintain consistency across the codebase.

### Zustand Store Access
Use **selector functions** when reading from stores in components. Existing code may still use full-store subscriptions — migrate when touching those files, but don't refactor solely for this.
```typescript
// GOOD — subscribes only to fields used
const currentAge = useProfileStore((s) => s.currentAge)
const swr = useProfileStore((s) => s.swr)

// BAD — subscribes to everything, re-renders on any change
const store = useProfileStore()
const { currentAge, swr } = useProfileStore()
```

### Form Inputs
Always use the shared input wrappers from `components/shared/` instead of raw `<Input type="number">`:
- `<CurrencyInput>` for dollar amounts
- `<NumberInput>` for plain numbers
- `<PercentInput>` for percentages

These handle cursor-jump prevention, comma formatting, blue border convention, and validation error display.

### Card Layout
`CardContent` has `pt-0` by default (designed to follow `CardHeader`). When a Card has text/content without a preceding `CardHeader`, always use `CardHeader` for the first text element or add `pt-6` to `CardContent`. Never let content touch the top edge of a Card.

### Shared Helpers (canonical locations)
| Pattern | Canonical Location | Do NOT |
|---------|-------------------|--------|
| Projection params | `buildProjectionParams()` in `hooks/useIncomeProjection.ts` | Build params inline |
| CPF housing mode | `deriveCpfHousingFromProperty()` in `hooks/useIncomeProjection.ts` | Derive inline |
| Effective returns/stdDevs | `getEffectiveReturns()` / `getEffectiveStdDevs()` in `lib/calculations/portfolio.ts` | `ASSET_CLASSES.map(...)` inline |
| Expenses at retirement | `getExpensesAtRetirement()` in `lib/calculations/expenses.ts` | `getEffectiveExpenses() * Math.pow(...)` inline |
| Withdrawal strategy colors | `WITHDRAWAL_STRATEGY_COLORS` in `lib/chartTheme.ts` | Define colors locally |
| DeltaBadge (good/bad indicator) | `components/shared/DeltaBadge.tsx` | Define inline in components |

### File Organization
- **Pure functions** belong in `lib/`, not `hooks/`. If a function doesn't call React hooks, it's not a hook. Known exception: `buildProjectionParams` and `deriveCpfHousingFromProperty` live in `hooks/useIncomeProjection.ts` for co-location with the hook that uses them — do not move these, but do not add new pure functions to `hooks/`.
- **Data arrays and constants** belong in `lib/data/`, not `hooks/`.
- **JSX-free files** should use `.ts`, not `.tsx`. Only use `.tsx` in `components/` and `pages/`.
- **Import paths:** Always use `@/` aliases without file extensions. Exception: Web Worker imports in `lib/simulation/` use explicit `.ts` extensions for module compatibility.

## Development Commands

```bash
cd frontend && npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm run test         # Vitest (run all tests)
npm run test:watch   # Vitest in watch mode
npm run test:coverage # Vitest with coverage report
```

### Before Committing
1. `npm run type-check` passes with zero errors
2. `npm run lint` passes
3. `npm run test` passes (all tests green)
4. `lib/calculations/` coverage >= 95%
5. No `any` types in calculation or simulation files
6. No hardcoded Singapore-specific values outside `lib/data/`

### Git Remotes and Branching

This repo uses two GitHub remotes to separate public (open-source) from private (unreleased) work:

| Remote | Repo | Visibility | What gets pushed |
|--------|------|------------|-----------------|
| `origin` | `RemarkRemedy/fireplanner` | **Public** | Bugfixes only |
| `private` | `RemarkRemedy/fireplanner-private` | **Private** | Everything (full backup) |

**Workflow:**
- **Bugfixes:** commit on `main`, push to both remotes (`git push-both` alias)
- **New features:** branch off `main`, push to `private` only (`git push private feat/my-feature`). Do NOT push feature branches or feature merges to `origin`.

**No new features go to `origin` until further notice.** The public repo receives bugfixes only. All feature work stays on `private`. This includes merging feature branches into `main` — after merging a feature, push `main` to `private` only, not `origin`.

## UI Constraints

- **Color coding convention:** Blue = user input, Black = formula/computed, Green = linked from another store/section.
- **Explicit run for heavy computation:** Monte Carlo and Backtest require a manual "Run" button. Do not auto-trigger simulations.
- **Progressive disclosure:** Basic mode shows essentials. Advanced toggles reveal income streams, life events, CPF details, correlation matrix, custom return overrides.

## Historical Data

Sources, licensing, gap handling, and data format details are in [`docs/data-sources.md`](docs/data-sources.md). CPI values are decimal fractions (0.025 = 2.5%), NOT percentages.

## MCP Polling Discipline

When polling async MCP tools (Gemini, Codex), do NOT cancel or abandon a job unless it returns an explicit error status. "Running" or "pending" means it is still working. Poll every 30-60 seconds. Gemini jobs can take up to 20 minutes. Never kill a running MCP job due to perceived slowness.

## Annual Data Maintenance Checklist

See [`docs/maintenance-checklist.md`](docs/maintenance-checklist.md) for the full checklist of data files, sources, and update procedures.
