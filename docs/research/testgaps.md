# Test Coverage Analysis — 2026-03-15

## Threshold Compliance (from CLAUDE.md)

| Directory | Stmts | Threshold | Branch | Threshold | Status |
|-----------|-------|-----------|--------|-----------|--------|
| `lib/calculations/` | 97.4% | 95% | 89.2% | 85% | PASS |
| `lib/math/` | 98.8% | 95% | 90.9% | 90% | PASS |
| `lib/validation/` | 86.8% | 95% | 81.5% | 90% | FAIL |
| `lib/simulation/` | 6.8% | 90% | 7.6% | 80% | FAIL (false — Worker boundary) |

Note: `lib/simulation/` shows ~7% because V8 coverage instrumentation does not cross the Web Worker boundary. The actual simulation modules (`monteCarlo.ts`, `backtest.ts`, `sequenceRisk.ts`, `swrOptimizer.ts`) have 75+ MC tests, 70+ backtest tests, 25+ SR tests — but they execute inside the worker isolate where coverage can't instrument them. This is a tooling limitation, not a real gap.

`lib/validation/` fails because `ilpSchema.ts` (ILP validation, 0% coverage) drags the directory average below 95%. The core `schemas.ts` and `rules.ts` are well covered.

## All Directories

| Directory | Files | Stmts % | Branch % |
|-----------|-------|---------|----------|
| `lib/calculations/` | 22 | 97.4% | 89.2% |
| `lib/math/` | 3 | 98.8% | 90.9% |
| `lib/household/` | 23 | 85.0% | 68.0% |
| `lib/validation/` | 5 | 86.8% | 81.5% |
| `lib/analysis/` | 1 | 84.2% | 77.8% |
| `hooks/` | 41 | 74.4% | 68.0% |
| `stores/` | 10 | 63.7% | 54.9% |
| `lib/companion/` | 9 | 38.7% | 27.7% |
| `lib/simulation/` | 10 | 6.8% | 7.6% |
| `lib/` (root utils) | 14 | 4.9% | 1.1% |

## Lowest Coverage Files (>10 statements, 0% coverage)

### UI/Marketing hooks (expected — no financial logic)
- `hooks/useActiveSection.ts`
- `hooks/useEmailSignup.ts`
- `hooks/useExitIntent.ts`
- `hooks/useExpenseTrackerDwell.ts`
- `hooks/useIsMobile.ts`
- `hooks/useMediaQuery.ts`
- `hooks/usePageMeta.ts`
- `hooks/usePageVisitCount.ts`

### Utility modules (no direct tests, some indirect)
- `lib/checklist.ts`
- `lib/exportExcel.ts`
- `lib/exportImport.ts`
- `lib/migrationDetector.ts`
- `lib/scenarios.ts`
- `lib/shareUrl.ts`
- `lib/undo.ts`
- `lib/storeRegistry.ts` (4.7%)

### Simulation (Worker boundary — false 0%)
- `lib/simulation/backtest.ts`
- `lib/simulation/monteCarlo.ts`
- `lib/simulation/sequenceRisk.ts`
- `lib/simulation/swrOptimizer.ts`
- `lib/simulation/simulation.worker.ts`
- `lib/simulation/stressScenarios.ts`
- `lib/simulation/proofData.ts`
- `lib/simulation/proofScenario.ts`
- `lib/simulation/workerClient.ts` (5.6%)

### Companion modules
- `lib/companion/actionImpacts.ts`
- `lib/companion/companionClient.ts`

### Unshipped/experimental
- `lib/household/breakdownUtils.ts`
- `lib/validation/ilpSchema.ts`
- `stores/useIlpStore.ts`

## Gaps Closed This Session (2026-03-14/15)

196 new tests across 6 files:

| File | Tests | What it covers |
|------|-------|---------------|
| `lib/household/__tests__/validation.test.ts` | 81 | All 30+ validation rules (plan-level, adult, timing, expense, property, assumptions, SRS, healthcare, goal, dependent, asset, owned-entry) |
| `hooks/__tests__/useHealthCheckInputs.test.ts` | 32 | Health check adapter (4 branching paths: income fallback, property scaling, discount rate, partner income) |
| `lib/household/__tests__/planSlice.test.ts` | 43 | planSlice edge cases (splitRatio=0, null endAge, timing shift, owner remapping) |
| `stores/__tests__/useHouseholdPlanStore.helpers.test.ts` | 4 | removeAdult cascade/reanchor, year-drift migration |
| `lib/household/__tests__/toLegacyRoundTrip.test.ts` | 6 | toLegacyIndividual round-trip with 3 parity fixtures + null guards |
| `lib/data/dataInvariants.test.ts` | 30 | Data file invariants (cpfRates, taxBrackets, stampDutyRates, balaTable) |

## Remaining Actionable Gaps

### Real gaps worth fixing
1. `lib/validation/ilpSchema.ts` (0%) — pulling validation dir below 95% threshold
2. `lib/household/breakdownUtils.ts` (0%) — financial breakdown utilities
3. `lib/household/timing.ts` — core timing resolution (tested indirectly via planSlice and compiler tests)
4. `lib/exportExcel.ts` (0%) — user-facing Excel export
5. `stores/useIlpStore.ts` (0%) — ILP store

### Acceptable gaps (UI/marketing, not financial)
- All `useEmailSignup`, `useExitIntent`, `usePageMeta`, etc. hooks
- `lib/checklist.ts`, `lib/shareUrl.ts`, `lib/undo.ts`

### False gaps (Worker boundary limitation)
- All `lib/simulation/` files — extensively tested but coverage tool can't see inside Worker
