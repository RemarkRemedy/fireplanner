# Household Analysis Access Contract

## Why This Gate Exists

PR 3 introduced `compileHouseholdPlan`, but the current analysis hooks still read raw legacy stores directly and memoize on wide dependency arrays. Gate A locks the normalized access contract before PR 4A starts so the migration does not devolve into passing a freshly allocated compiled object through existing `useMemo` graphs.

## Current Hook Constraints

- [useIncomeProjection.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useIncomeProjection.ts) builds the CPF/income projection from raw `useProfileStore`, `useIncomeStore`, and `usePropertyStore` slices and depends on dozens of scalar and array fields.
- [useProjection.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useProjection.ts) composes `useIncomeProjection()` plus direct reads from `profile`, `allocation`, `simulation`, and `property`, then memoizes over a similarly wide dependency list.
- [useMonteCarloWorkerQuery.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useMonteCarloWorkerQuery.ts) currently serializes 30+ raw authoring and config inputs into `currentParamsSig`; any nested-object drift can mark runs stale even when the semantic inputs are unchanged.
- [useBacktestQuery.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useBacktestQuery.ts) builds a second JSON signature from raw stores, then reconstructs worker params inside the hook. It has the same stale-detection problem as Monte Carlo.
- [useRiskAssessment.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useRiskAssessment.ts), [useCpfProjection.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCpfProjection.ts), and [useCompanionPlannerBridge.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCompanionPlannerBridge.ts) still derive their answers from raw legacy fields or from `useIncomeProjection()`, so a whole-plan object dependency would fan out unnecessary recomputes.

## Locked Store Contract

- The normalized slice lives in [useNormalizedAnalysisStore.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useNormalizedAnalysisStore.ts).
- Cache identity is `buildNormalizedAnalysisCacheKey({ householdRevision, scenarioOverrideHash })`.
- `householdRevision` is the monotonic semantic-change token for authoring state.
  Legacy-backed phases use `buildLegacyHouseholdRevision({ profileRevision, incomeRevision, propertyRevision })`.
  PR 5+ switches to `buildHouseholdPlanRevision(householdPlanRevision)`.
- `scenarioOverrideHash` comes from `stableScenarioOverrideHash(overrides)`, which sorts object keys but preserves array order so equivalent override objects reuse the same cache entry.
- The store entry shape is fixed now: one compiled household plan plus selector-specific fragments for deterministic/projection, Monte Carlo, backtest, CPF, healthcare, and companion consumers.
- Consumers may subscribe to selector fragments only. Depending on a fresh `CompiledHouseholdPlan` object reference in a hook dependency array is explicitly out of contract.

## Semantic Revision Rules

- `profileRevision`, `incomeRevision`, and `propertyRevision` bump once per semantic authoring mutation and once after hydrate/import/migration completes.
- `allocationRevision`, `simulationRevision`, and `withdrawalRevision` bump once per semantic global-input mutation and once after hydrate/import/migration completes.
- `simulationRevision` excludes proof-workspace cursor/view state and cached result fields (`proofSource`, `proofMetricType`, `proofChartType`, `proofShowOutliers`, `proofBlendRatio`, `proofSelectedCycle`, `proofSelectedYear`, `lastMCSuccessRate`, `lastBacktestSuccessRate`) because those are UI/runtime-only and must not invalidate compiled analysis inputs.
- Reset actions count as semantic changes because they alter planner inputs. Validation-error recalculation does not count as a semantic change.

## Selector Surface

- Deterministic / projection consumers read `selectors.deterministic.rows`, `selectors.deterministic.milestones`, and `selectors.projection.{annualSavingsByYear,postRetirementIncomeByYear,retirementExpenseBaseByYear,householdWithdrawalNeedByYear,portfolioAdjustments}`.
- Monte Carlo consumers read `selectors.monteCarlo.{annualSavingsByYear,postRetirementIncomeByYear,householdWithdrawalNeedByYear,portfolioAdjustments}`.
- Backtest and sequence-risk consumers read `selectors.backtest.{postRetirementIncomeByYear,retirementExpenseBaseByYear,householdWithdrawalNeedByYear,portfolioAdjustments}`.
- CPF consumers read `selectors.cpf.cpfByAdultId`.
- Healthcare consumers read `selectors.healthcare.healthcareByAdultId`.
- Companion consumers read `selectors.companion.{milestones,annualSavingsByYear,postRetirementIncomeByYear,householdWithdrawalNeedByYear}`.

## Invalidation And Recompute Rules

- Any semantic authoring change that bumps `householdRevision` invalidates the active normalized entry and requires a fresh `compileHouseholdPlan` run.
- Scenario-only edits do not mint a new `householdRevision`; they mint a new `scenarioOverrideHash` and reselect the normalized entry for that override set.
- Equivalent scenario override objects must hash to the same `scenarioOverrideHash`; array order remains significant because scenario cards may intentionally preserve ordered overrides.
- Allocation, simulation, and withdrawal revisions do not invalidate the compiled household plan itself, but they do invalidate downstream worker signatures and selector fragments that depend on global analysis settings.

## Monte Carlo Stale Detection

- `useMonteCarloWorkerQuery` ownership is locked to PR 4B.
- PR 4B replaces the current JSON blob stale check with `buildMonteCarloRunSignature({ householdRevision, scenarioOverrideHash, allocationRevision, simulationRevision, withdrawalRevision, runOverrideHash })`.
- `runOverrideHash` comes from `stableRunOverrideHash(overrides)` so ephemeral run overrides participate in stale detection without serializing the full legacy store state.
- PR 4B also migrates [useBacktestQuery.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useBacktestQuery.ts), [useExplorePortfolio.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useExplorePortfolio.ts), [useRiskAssessment.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useRiskAssessment.ts), and [useCpfProjection.ts](/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCpfProjection.ts) onto selector subscriptions from the same normalized entry.

## Scenario Recompute Rules

- Base household compilation keys off authoring revisions only.
- Scenario override changes recompute scenario-sensitive selector fragments and worker signatures against the same authoring revision.
- The mixed-mode migration may keep legacy stores alive, but the normalized slice remains the only analysis-facing cache once PR 4A begins.

## CI / Parity Wiring

- PR 4A makes Monte Carlo parity snapshots for `salary-only`, `property-and-CPF`, `goals-and-life-events`, and `pr-residency-transition` CI-blocking against selector outputs from the normalized slice.
- PR 4B makes deterministic/projection/sequence-risk parity thresholds and the launch-size compile benchmark gate CI-blocking.
- PR 4C makes analysis-page smoke coverage plus companion payload exact-match regressions CI-blocking.
