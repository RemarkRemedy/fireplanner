# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Singapore FIRE (Financial Independence, Retire Early) + Property + Investment Retirement Planner. A fully client-side web application for comprehensive retirement planning tailored to Singapore residents.

**Status:** Shipped. Fully client-side app deployed to Cloudflare Pages. Monte Carlo simulation (Web Worker), 12 withdrawal strategies, historical backtesting, sequence risk stress testing, dashboard, property analysis, scenario save/load, Excel/JSON export, and reference guide.

**Remaining gaps:**
- Property hybrid MC overlay (5 discrete weighted property scenarios per MC path)
- Scenario side-by-side comparison view (save/load works, parallel compare panel does not exist)

**Deployment:** Cloudflare Pages via `wrangler pages deploy`. No server. Sentry and PostHog intentionally skipped (privacy-first, no-server-contact promise).

**Source of truth:** When the master plan (`FIRE_PLANNER_MASTER_PLAN_v2.md`) and this file conflict, the master plan wins for calculation logic, formulas, Singapore-specific rules, and domain requirements. This file wins for technology choices, architecture decisions, and implementation patterns.

## Architecture

### Frontend
| Dependency | Version |
|-----------|---------|
| React | 19.x |
| TypeScript | 5.9.x |
| Vite | 7.x |
| React Router | 6.x |
| Zustand | 5.x |
| React Query (TanStack Query) | 5.x |
| Tailwind CSS | 3.4.x |
| shadcn/ui | latest |
| Recharts | 2.x |
| D3.js | 7.x |
| React Hook Form | 7.x |
| Zod | 3.x |
| TanStack Table | 8.x |

**Routing:** React Router v6 with `createBrowserRouter`. Route components live in `pages/` as plain components (e.g., `InputsPage.tsx`). Do NOT use Next.js file-based routing conventions (`page.tsx`, `layout.tsx` in nested folders).

**State:** 7 Zustand stores (profile, income, allocation, simulation, withdrawal, property, ui). Dashboard metrics are **derived hooks**, not a store — the dashboard owns no state, it computes views from other stores.

### Simulation Engine (Web Worker)

All heavy computation (Monte Carlo, backtest, sequence risk, SWR optimization) runs in a Web Worker (`lib/simulation/simulation.worker.ts`) to avoid blocking the UI. No backend server required.

| Module | Purpose |
|--------|---------|
| `lib/math/linalg.ts` | Cholesky decomposition, covariance matrix, matrix ops |
| `lib/math/random.ts` | SeededRNG (xoshiro128**), Box-Muller gaussians |
| `lib/math/stats.ts` | Percentile, Student-t quantile |
| `lib/simulation/monteCarlo.ts` | 10K MC simulations (parametric/bootstrap/fat-tail) |
| `lib/simulation/backtest.ts` | Bengen-style rolling window historical backtest |
| `lib/simulation/sequenceRisk.ts` | Crisis scenario stress testing |
| `lib/simulation/swrOptimizer.ts` | Binary search for safe withdrawal rate |
| `lib/simulation/simulation.worker.ts` | Web Worker message handler |
| `lib/simulation/workerClient.ts` | Worker client + strategy params flattening |
| `lib/exportExcel.ts` | Client-side Excel export via exceljs |
| `lib/data/historicalReturnsFull.ts` | 98 rows historical returns (1928-2025) |

### Data Persistence (Browser-Only)

All user financial data stays in the browser. No server-side storage of user data.

- **localStorage:** All Zustand store state auto-saved on change via `zustand/middleware` persist. Restored on page load.
- **JSON export/import:** Users can download their full state as a JSON file and restore it on any device/browser. This is the cross-device portability mechanism.
- **URL params:** Life stage, FIRE type, and view state encoded in URL for bookmarking and sharing specific views.
- **No authentication.** No accounts. No server-side anything.

### Key Directories
```
frontend/src/
├── pages/          # Route components: StartPage, InputsPage, ProjectionPage,
│                   #   WithdrawalPage, StressTestPage, DashboardPage,
│                   #   ChecklistPage, ReferencePage
├── components/     # UI by domain: ui/, layout/, profile/, income/, allocation/,
│                   #   simulation/, withdrawal/, backtest/, dashboard/, property/,
│                   #   cpf/, goals/, healthcare/, projection/, sequenceRisk/, shared/
├── stores/         # 7 Zustand stores (profile, income, allocation, simulation,
│                   #   withdrawal, property, ui)
├── hooks/          # ~22 derived hooks (FIRE calcs, projections, dashboard, etc.)
└── lib/
    ├── calculations/  # fire, cpf, tax, income, portfolio, withdrawal, property,
    │                  #   srs, hdb, healthcare, expenses, projection, cashReserve, timeCost
    ├── simulation/    # monteCarlo, backtest, sequenceRisk, swrOptimizer, worker
    ├── math/          # linalg, random, stats
    ├── validation/    # schemas, rules
    └── data/          # historicalReturns, cpfRates, taxBrackets, momSalary,
                       #   stampDutyRates, healthcarePremiums, hdbRates, balaTable,
                       #   crisisScenarios, sources, changelog, goalTemplates, etc.
```

Use `Glob` or `ls` to discover specific files. The router (`router.tsx`) defines all routes; legacy paths like `/profile`, `/income`, `/monte-carlo` redirect to consolidated pages.

## Computation Architecture

All computation is client-side. Heavy computations (Monte Carlo, backtest, sequence risk, SWR optimization) run in a **Web Worker** (`lib/simulation/simulation.worker.ts`) to avoid blocking the UI. Lightweight computations (FIRE number, tax, CPF, income projections, portfolio stats, deterministic withdrawal strategies, property analysis) run on the main thread for instant feedback.

### Web Worker Communication

The 3 simulation hooks (`useMonteCarloQuery`, `useBacktestQuery`, `useSequenceRiskQuery`) call worker functions from `workerClient.ts` instead of API endpoints. `workerClient.ts` manages a lazy singleton Worker instance with message ID multiplexing for concurrent calls. `useMutation` from TanStack React Query is retained for `isPending`/`error`/`data` state management.

### Withdrawal Strategies

The 12 withdrawal strategies are implemented in TypeScript (`lib/calculations/withdrawal.ts`) and used by both the deterministic comparison view and the simulation engines (MC, backtest, sequence risk). There is one implementation — no cross-language parity concern.

### Rebalancing

All simulations (MC, backtest, sequence risk) use **annual steps**. The rebalancing frequency option in the UI (Annual/Semi-Annual/Quarterly) is informational — it does not change simulation granularity. Historical return data is annual, and sub-annual rebalancing has negligible impact on long-term outcomes. Do not implement sub-annual simulation steps.

## Validation Layer

Validation runs **before** any calculation. Invalid inputs must not propagate through the store dependency chain.

### Per-Store Validation (Zod schemas in `lib/validation/schemas.ts`)
Each store has a Zod schema defining valid ranges. Examples:
- `currentAge`: integer, 18-100
- `retirementAge`: integer, > currentAge, <= lifeExpectancy
- `lifeExpectancy`: integer, > retirementAge, 50-120
- `swr`: number, 0.01-0.10
- Allocation weights: array of 8, each 0-1, sum === 1.0
- `annualExpenses`: number, > 0
- `inflation`: number, 0-0.15

### Cross-Store Validation (in `lib/validation/rules.ts`)
Rules that span stores:
- Retirement age (profile) > current age (profile)
- Life expectancy (profile) > retirement age (profile)
- Allocation weights (allocation) must sum to 1.0 before portfolio stats compute
- Income streams end ages (income) <= life expectancy (profile)
- Withdrawal strategy params (withdrawal) validated against portfolio size (profile)

### Error Propagation
- Each store exposes a `validationErrors` field (map of field name to error message)
- Calculation hooks check upstream store validity before computing: if profile store has errors, income projections return `null` with an error flag
- Components display inline validation errors on inputs and show a warning banner when downstream calculations are blocked by upstream errors
- Simulation runs are gated: Monte Carlo button is disabled with tooltip explaining which inputs need fixing

## Key Domain Concepts

- **8 asset classes:** US Equities, SG Equities (STI), Intl Equities (MSCI), Bonds, REITs, Gold, Cash, CPF (OA+SA blend)
- **12 withdrawal strategies:** Constant Dollar (4% rule), VPW, Guardrails (Guyton-Klinger), Vanguard Dynamic, CAPE-Based, Floor-and-Ceiling, Percent of Portfolio, 1/N (Remaining Years), Sensible Withdrawals, 95% Rule, Endowment (Yale Model), Hebeler Autopilot II
- **3 salary models:** Simple (fixed growth), Realistic (career phases + promotion jumps), Data-Driven (MOM benchmarks)
- **Monte Carlo methods:** Parametric (multivariate normal via Cholesky), Historical Bootstrap, Fat-tail (Student-t df=5)
- **All values in SGD.** USD-denominated assets converted at user-specified or historical FX rates.
- **Singapore-only.** All tax, CPF, property, and regulatory logic is Singapore-specific. No multi-country support. Data files in `lib/data/` are structured as standalone modules (e.g., `taxBrackets.ts`, `cpfRates.ts`) so future locale support could swap implementations, but do not build abstraction for it now.

## Singapore-Specific Logic

All Singapore-specific values live in `lib/data/` files, never hardcoded in calculation functions.

- **CPF:** Contribution rates vary by age bracket (up to 55: 37% total; 55-60: 34%; 60-65: 25%; 65-70: 16.5%; >70: 12.5%). Under-55 has 4 sub-brackets for OA/SA/MA allocation. OW ceiling $8,000/month (from Jan 2026), AW ceiling formula. Extra interest on first $60K (extra 1% on first $30K OA, extra 1% on next $30K across OA/SA/MA). BRS/FRS/ERS projections with 3.5% annual growth.
- **Tax:** SG progressive income tax (0% on first $20K up to 24% above $1M). Personal reliefs (earned income, NSman, spouse, child, parent, CPF, SRS). SRS deduction cap $15,300/yr.
- **Property:** Bala's Table for leasehold decay, BSD rates (1% on first $180K, 2% on next $180K, 3% on next $640K, 4% on next $500K, 5% on next $1.5M, 6% on remainder), ABSD rates by residency/property count, 75% LTV.
- **CPF LIFE:** Estimated payout rates ~5.4% (Basic) / ~6.3% (Standard) of FRS at 55.

## Testing Strategy

### Frontend: Vitest
Unit tests for every calculation module in `lib/calculations/`, `lib/simulation/`, and `lib/math/`. Each `.ts` file has a corresponding `.test.ts`. Property-based tests use `fast-check` for invariants (FIRE number > 0, allocation sums to 1.0, tax <= income, etc.). Validation tests cover Zod schemas and cross-store rules.

### Integration Tests
3 user journey scenarios in `lib/integration.test.ts` with concrete expected values derived from master plan formulas:
1. **Fresh Graduate** (age 25, $48K income, Aggressive 80/20, SWR 3.5%)
2. **Mid-Career Professional** (age 35, $180K income, Balanced 60/40, SWR 4%)
3. **Pre-Retiree** (age 55, $2M portfolio, Conservative 30/70, SWR 4%)

### Coverage Requirements
- `lib/calculations/`: 95% line coverage minimum
- `lib/simulation/`: 90% line coverage minimum
- `lib/math/`: 90% line coverage minimum
- `lib/validation/`: 90% line coverage minimum
- All tests must pass before committing

## Do Not

- **Do not use `any` type** in TypeScript calculation functions. All inputs and outputs must be typed.
- **Do not hardcode Singapore-specific values** in calculation functions. CPF rates, tax brackets, ABSD rates, Bala's Table data — all go in `lib/data/` files.
- **Do not use `Math.random()`** for Monte Carlo. Use `SeededRNG` from `lib/math/random.ts` for deterministic, reproducible simulations.
- **Do not call simulation functions on the main thread.** Always use the Web Worker via `workerClient.ts`.
- **Do not use Next.js conventions.** No `page.tsx` / `layout.tsx` nested folder routing. This is React Router v6 with Vite.
- **Do not create a dashboard Zustand store.** Dashboard metrics are derived hooks that read from other stores. `useUIStore` handles UI-only state (active section, nudges), not dashboard data.
- **Do not add a backend server** for computation or user data storage. All financial computation runs client-side. Browser-only persistence for user data. **Exception:** Email capture uses a single Cloudflare Pages Function (`POST /api/email-signup`) with D1 storage. Only email address, source tag, and feature interest are sent to the server. No financial data leaves the browser.
- **Do not skip validation.** Every calculation hook must check input validity before computing.
- **Do not import from one store inside another store's definition.** Cross-store reads happen in hooks and components, not in store definitions.
- **Do not mix dollar bases in views OR computation.** When a table, chart, or comparison shows values across multiple columns/series, ALL values must be in the same dollar basis (all today's dollars OR all future/nominal dollars). If one column is inflation-adjusted to a future date, every other monetary column must be too. Project portfolios forward at expected net return, inflate expenses at the inflation rate, over the same time horizon. **The same rule applies to computation:** this codebase has two computation contexts — (1) year-by-year simulation engines (projection.ts, MC, SR) that work in **nominal terms** and inflate everything at each timestep, and (2) steady-state FIRE metrics (`computeMetrics` via `calculateAllFireMetrics` + `projectPortfolioAtRetirement`) that work in **real terms** using `netRealReturn = expectedReturn - inflation - fees`. Never copy inflation logic from a nominal-context engine into a real-context model, or vice versa. The disruption preview lump sum bug (Mar 2026) was caused by importing `lumpSum * (1+i)^years` from the MC engine (nominal) into `computeMetrics` (real), over-estimating the impact by up to 45%.
- **Do not change the calculation engine without updating the display layer, or vice versa.** Tax deductions, CPF contributions, and other auto-computed values appear in both the engine (`lib/calculations/`) and UI summary panels (e.g., `TaxReliefSection`'s "Auto-calculated deductions"). When adding, removing, or modifying a deduction or parameter in one layer, update the other in the same commit. The RSTU bug (Feb 2026) was caused by the engine correctly deducting SA top-ups from chargeable income while the UI panel never displayed or totalled the deduction.
- **Do not deploy to production without explicit user approval.** Only deploy to production when the user explicitly says "deploy to production". The word "deploy" alone is not sufficient — it must specifically reference production. Preview/branch deployments for testing are fine without approval, but production deploys require an unambiguous go-ahead.

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

## UI Patterns

- **Live calculations:** Every input change recalculates client-side metrics instantly (no submit button for simple metrics).
- **Explicit run for heavy computation:** Monte Carlo and Backtest require a manual "Run" button with progress indicator. Show computation time on completion.
- **Progressive disclosure:** Basic mode shows essentials (age, income, expenses, net worth). Advanced toggles reveal income streams, life events, CPF details, correlation matrix, custom return overrides.
- **Color coding convention:** Blue = user input, Black = formula/computed, Green = linked from another store/section.
- **Smart defaults:** Pre-filled with Singapore defaults (age 30, $72K income from MOM degree median, $48K expenses, 2.5% inflation, Conservative template for Post-FIRE users).
- **Tooltips:** Every label has an (i) icon. Hover shows definition + formula.
- **Scenario save/load:** Save current state as named scenario, up to 5 named scenarios stored in localStorage under `fireplanner-scenarios` key. Implemented as a utility module (`lib/scenarios.ts`), not a store. Side-by-side comparison panel is not yet built.
- **Mobile-first responsive:** Dashboard cards stack vertically, charts resize with container, sidebar becomes bottom nav on mobile.

## Historical Data

Sources, licensing, gap handling, and data format details are in [`docs/data-sources.md`](docs/data-sources.md). CPI values are decimal fractions (0.025 = 2.5%), NOT percentages.

## Annual Data Maintenance Checklist

Every January, review and update these data files with the previous year's published values:

| File | What to Update | Official Source | Typical Publish Date |
|------|---------------|-----------------|---------------------|
| `lib/data/cpfRates.ts` | OW ceiling, contribution rates, BRS/FRS/ERS base values, `RETIREMENT_SUM_BASE_YEAR` | [CPF Board](https://www.cpf.gov.sg) | January |
| `lib/data/taxBrackets.ts` | Tax brackets, relief amounts, SRS caps | [IRAS](https://www.iras.gov.sg) | February (Budget) |
| `lib/data/momSalary.ts` | Salary benchmarks by education/age | [MOM Stats](https://stats.mom.gov.sg) | June (Labour Force Report) |
| `lib/data/healthcarePremiums.ts` | MediShield Life, ISP, CareShield premiums, `MEDISAVE_BHS` | [CPF Board](https://www.cpf.gov.sg), [MOH](https://www.moh.gov.sg) | April |
| `lib/data/stampDutyRates.ts` | BSD brackets, ABSD rates | [IRAS](https://www.iras.gov.sg/taxes/stamp-duty) | When revised (check Budget) |
| `lib/data/historicalReturnsFull.ts` | Add new year's data row, update `DATA_YEAR_RANGE` | [Damodaran](https://pages.stern.nyu.edu/~adamodar/), [FRED](https://fred.stlouisfed.org) | January |
| `lib/data/sources.ts` | Sync `period` labels with updated files above | N/A | After any data file update |

After updating any data file:
1. Update the header comment with new download date
2. Run `npm run test` — existing tests catch regressions
3. Update `sources.ts` period labels to match
4. Add an entry to `lib/data/changelog.ts` describing what changed (include `affectedSections`)
5. Bump `DATA_VINTAGE` in `lib/data/changelog.ts` to today's date


<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Feb 16, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #6806 | 9:37 PM | 🔵 | CLAUDE.md Review Confirming Pre-Build Status and Web Application Focus | ~2261 |
| #6804 | 9:31 PM | 🔵 | Technical Specifications, Python Architecture, and Build Progress Tracker | ~2224 |
| #6803 | 9:30 PM | 🔵 | Six Withdrawal Strategies with Formulas and User Journey Scenarios | ~1701 |
| #6802 | 9:29 PM | 🔵 | UI/UX Design Patterns and Technical Decision Rationale | ~1366 |
| #6801 | 9:28 PM | 🔵 | Monte Carlo Simulation Engine and Withdrawal Strategy Implementation | ~1204 |
| #6800 | " | 🔵 | Zustand State Management Architecture and Store Interfaces | ~1127 |
| #6799 | 9:27 PM | 🔵 | Master Plan Phase 1 Foundation Components | ~963 |
| #6798 | 9:26 PM | 🔵 | Web Application Architecture and Implementation Roadmap | ~1003 |
| #6797 | " | 🔵 | Singapore FIRE Planner Project Structure and Requirements | ~626 |
| #6796 | 9:24 PM | 🟣 | CLAUDE.md Project Context File Created | ~719 |
| #6794 | " | 🔵 | FIRE Planner Master Plan Specifications Reviewed | ~755 |
| #6793 | 9:23 PM | 🔵 | Singapore FIRE Planner Web Application Architecture Designed | ~626 |
</claude-mem-context>