# Autopilot Implementation Plan: Monte Carlo Stress Scenarios (Phase 4)

## Scope Summary
Introduce built-in stress scenarios, a multi-select scenario selector, and a comparison table while keeping existing charts and companion export behavior stable.

## Step 1: Stress scenario core module
- Add `frontend/src/lib/simulation/stressScenarios.ts`:
  - scenario ids/labels/metadata
  - parameter transform helpers (`applyStressScenario`)
  - batch run-plan helper for selected scenarios
  - comparison-row helper (success rate, terminal median, failure age mapping)

## Step 2: Engine parameter support
- Extend `MonteCarloEngineParams` with optional stress fields:
  - forced portfolio returns for early years
  - per-year inflation overrides
- Update `runMonteCarlo` to apply those overrides deterministically before/within simulation loops.

## Step 3: Selector + comparison components
- Add scenario selector component above Run button:
  - `frontend/src/components/simulation/StressScenarioSelector.tsx`
- Add comparison output component:
  - `frontend/src/components/simulation/StressScenarioComparisonTable.tsx`
- Keep styling compact and responsive.

## Step 4: Wire StressTest run flow
- Track selected scenarios in `StressTestPage`.
- Continue base simulation via existing `useMonteCarloQuery` (preserves existing UX + companion save bridge).
- Run additional selected stress scenarios via worker client with transformed params.
- Populate and render comparison rows after scenario runs.
- Ensure pending/error states are clear.

## Step 5: Companion UX guarantees
- Keep companion marketing/email hidden via existing guards.
- Keep compact layout and save status/action visible.
- Ensure stress scenario runs do not break existing auto-save payload flow.

## Step 6: Tests
- Extend `frontend/e2e/monte-carlo.spec.ts` to cover:
  - selecting stress scenarios produces comparison rows
  - companion result POST still fires with required payload keys
  - companion run still succeeds with save state

## Step 7: QA + validation
- Run:
  - `npm -C frontend run type-check`
  - `npm -C frontend run lint`
  - targeted `vitest` for touched hooks/libs
  - `npm -C frontend run e2e -- e2e/monte-carlo.spec.ts`
  - `npm -C frontend run build`
- Run architect/security/code review validation and address findings.
