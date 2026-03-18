# Consolidated Deep Review: PR-4a through PR-5

## Scope

- **PR-4a** (normalized-analysis-slice): `useNormalizedAnalysisStore`, `toAnalysisInputs.ts`, `monteCarloParams.ts`, semantic revision counters on all 6 Zustand stores, MC parity snapshots
- **PR-4b** (normalized-hook-migration): Migration of 11 derived analysis hooks from legacy authoring stores to normalized household inputs
- **PR-4c** (analysis-page-cutover): Wiring `ProjectionPage`, `WithdrawalPage`, `StressTestPage`, and `useCompanionPlannerBridge` to normalized inputs
- **PR-5** (household-authoring-store): `useHouseholdPlanStore`, household validation, legacy hydration, CRUD actions

**Reviewers per PR:** Code Architect, Code Reviewer (Correctness), Plan Compliance, Codex CLI, Gemini -- 5 agents x 4 PRs = 20 agents. One additional "full deep review" agent per PR (4 more). PR-4b Codex result was missing (19 of 20 specialized results recovered, plus all 4 full deep reviews = 23 total).

---

## CRITICAL (bugs, type errors, calculation errors)

### PR-4a

1. **Goals completely dropped from normalized MC params.**
   `frontend/src/lib/household/toAnalysisInputs.ts:249-250`
   The compiled plan puts goals into `portfolioAdjustments` with `kind: 'goal'`, but `toAnalysisInputs` explicitly filters them out (`.filter((adjustment) => adjustment.kind !== 'goal')`). Goals are also NOT included in `annualSavingsByYear` (the compiler's `recurringExpense` does not include goals). So goals vanish entirely from the normalized path -- they appear in neither `annualSavings` nor `portfolioAdjustments`. A user with a $100K goal at age 55 would see it completely ignored in the normalized MC simulation.
   *Reported by: Gemini, Correctness*

2. **Split-brain parameter construction in `buildMonteCarloEngineParams` -- normalized ages with legacy cash-flow arrays.**
   `frontend/src/lib/simulation/monteCarloParams.ts:327-346`
   The function spreads `legacyParams` then selectively overrides only 4 fields (`currentAge`, `retirementAge`, `lifeExpectancy`, `portfolioAdjustments`) with normalized values. `annualSavings` and `postRetirementIncome` remain from the legacy builder. If legacy and normalized retirement ages differ by even 1 year, the `annualSavings` array has the wrong number of elements for the normalized retirement boundary. The engine will silently misclassify the boundary year as accumulation or decumulation.
   *Reported by: Architect (4a, 4c), Correctness (4a), Gemini (4a)*

3. **`annualSavings` off-by-one between normalized and legacy paths.**
   `frontend/src/lib/household/toAnalysisInputs.ts:228-234`
   The normalized path slices `annualSavingsByYear.slice(0, householdRetirementYearOffset + 1)`, including the retirement year. The legacy MC builder excludes the retirement year (`!row.isRetired`). If the normalized `annualSavings` is ever used by the MC engine, the one-year length mismatch will shift all accumulation-phase savings contributions by one year.
   *Reported by: Correctness (4a)*

4. **`lib/simulation/monteCarloParams.ts` imports from `hooks/` -- architecture-breaking dependency inversion.**
   `frontend/src/lib/simulation/monteCarloParams.ts:10`
   `import { buildProjectionParams } from '@/hooks/useIncomeProjection'` -- a `lib/` module depending on a `hooks/` module, which CLAUDE.md prohibits. The same violation exists in `lib/simulation/proofScenario.ts:4`. Every future `lib/` file needing projection params will perpetuate the inversion.
   *Reported by: Architect (4a)*

5. **Duplicated `createNormalizedAnalysisEntry` function -- divergence risk.**
   `frontend/src/hooks/useIncomeProjection.ts:36-90` and `frontend/src/lib/household/toAnalysisInputs.ts:62-116`
   Two identical private copies of the same function. If a new selector slice is added to `compileHouseholdPlan`, it must be updated in both places independently, or one path silently returns stale/partial selectors. This is the same divergence class as the RSTU bug documented in CLAUDE.md.
   *Reported by: Architect (4a), Correctness (4a)*

6. **`toAnalysisInputs.ts` directly mutates the `NormalizedAnalysisStore` from `lib/`.**
   `frontend/src/lib/household/toAnalysisInputs.ts:193-209`
   `useNormalizedAnalysisStore.getState().upsertEntry(entry)` is called from a `lib/` file. CLAUDE.md prohibits importing stores from `lib/`. Makes the function non-testable without mounting the store and creates a circular dependency risk.
   *Reported by: Architect (4a)*

7. **Hardcoded Singapore-specific FRS value `213000` in `useProjection.ts`.**
   `frontend/src/hooks/useProjection.ts:70`
   The current FRS is `FRS_BASE = 220400` in `lib/data/cpfRates.ts:134`. The hardcoded `213000` is the old 2025 value -- both a CLAUDE.md violation and factually stale by ~$7,400. This causes the LBS RA top-up calculation to underestimate for every user.
   *Reported by: Architect (4a, 4b)*

8. **Stale cache key: `legacy:0:0:0` when revision fields are missing.**
   `frontend/src/lib/household/toAnalysisInputs.ts:180-183`, `frontend/src/lib/simulation/monteCarloParams.ts:331`
   The normalized legacy cache key falls back to `legacy:0:0:0` when revision fields are missing. The MC path passes plain runtime objects (which lack revision counters), so the cache can reuse a stale compiled plan across household edits.
   *Reported by: Codex (4a)*

9. **Double `fromLegacyIndividual` call on cache miss -- performance and correctness.**
   `frontend/src/stores/useNormalizedAnalysisStore.ts:132-148`, `frontend/src/lib/household/toAnalysisInputs.ts:255-288`
   `getOrCreateLegacyNormalizedAnalysisEntry` runs `fromLegacyIndividual` twice on every cache miss (once for identity, once for entry creation) and once on every cache hit (just for identity). `fromLegacyIndividual` is a full store-to-household model conversion.
   *Reported by: Full Deep Review (4a)*

### PR-4b

10. **All migrated hook unit tests seed the wrong stores (Confidence: 97).**
    `frontend/src/hooks/useFireCalculations.test.ts`, `useProjection.test.ts`, `useAnalysisPortfolio.test.ts`, `useWhatIfMetrics.test.ts`, `useRiskAssessment.test.ts`, `useWithdrawalComparison.test.ts`
    The migrated hooks now read from `useHouseholdPlanStore`, but ALL unit tests still use `useProfileStore.setState(...)` / `useIncomeStore.setState(...)` to configure inputs. These writes have zero effect on the hooks under test. Tests that pass do so because they check shape or defaults, not the seeded fixture values.
    *Reported by: Correctness (4b)*

11. **Parity test seeds wrong stores; snapshot reflects default household state (Confidence: 95).**
    `frontend/src/hooks/useNormalizedAnalysisParity.test.ts`
    `buildNormalizedSurface()` calls `seedStores(snapshot)` which seeds legacy stores, but the hooks read from `useHouseholdPlanStore`. The snapshot was generated on a prior version where hooks still read legacy stores. The parity test -- the core correctness guarantee of PR-4b -- is non-functional.
    *Reported by: Correctness (4b)*

12. **`useAllocationStore.getState()` called inside `useMemo` in `useDisruptionImpact.ts` -- reactive bypass.**
    `frontend/src/hooks/useDisruptionImpact.ts:235`
    Calling `.getState()` inside `useMemo` bypasses Zustand's subscription system. If allocation store changes after initial render, the memo will not re-run. Base FIRE metrics will be computed from stale allocation data. This mirrors the GoalImpactSummary bug pattern from MEMORY.md.
    *Reported by: Architect (4b)*

13. **`prMonths` missing from `useIncomeProjection` call and dependency array (Confidence: 91).**
    `frontend/src/hooks/useIncomeProjection.ts:327-376` (call site), lines 381-430 (dep array)
    Without `prMonths`, a PR user's CPF contributions are computed as if they are an established PR (full rates from day 1) rather than applying the 3-year graduated schedule (Year 1: 13%/5%; Year 2: 26%/15%; Year 3+: full). Produces materially incorrect CPF projections for new PR users. `srsPostFireEnabled` is also missing from the dep array.
    *Reported by: Correctness (4b)*

14. **`useMonteCarloQuery` stale-detection test will not trigger staleness (Confidence: 92).**
    `frontend/src/hooks/useMonteCarloQuery.test.ts:80-83`
    The test sets `useProfileStore.getState().setField('annualExpenses', 60_000)`, but `useMonteCarloWorkerQuery`'s `currentRunSig` is built from `normalized.householdRevision` which derives from `useHouseholdPlanStore.householdPlanRevision`. Setting legacy store fields does NOT increment `householdPlanRevision`.
    *Reported by: Correctness (4b)*

15. **Backtest hook drops non-withdrawal portfolio adjustments (regression).**
    `frontend/src/hooks/useBacktestQuery.ts:108-113`
    The pre-migration code computed `postRetirementIncome` that included mortgage payments, downsizing expenses, life event costs, and CPF OA shortfalls. The new code delegates to `normalized.entry.selectors.backtest.postRetirementIncomeByYear`, which does NOT include mortgage cash payments, downsizing rent, life event expense deltas, or CPF OA shortfalls. Goals and asset-unlocks that were negative entries in the old `postRetirementIncome` are now in `portfolioAdjustments` but filtered out.
    *Reported by: Gemini (4b)*

### PR-4c

16. **`useCompanionPlannerBridge` mixes legacy store selectors and normalized context for fields that must agree.**
    `frontend/src/hooks/useCompanionPlannerBridge.ts:130-138`
    `annualExpenses` from `useProfileStore`, but `retirementAge` from `normalized`. The companion payload builder uses `annualExpenses` to compute `requiredPortfolio` against the normalized `retirementAge`. For household plans where the compiled plan's expense baseline differs from the profile store, the payload reflects a mismatched (expenses, retirementAge) pair.
    *Reported by: Architect (4c), Correctness (4c), Codex (4c), Gemini (4c)*

17. **Committed source files have full content duplication (Confidence: 99).**
    `frontend/src/pages/ProjectionPage.tsx` (691->1383 lines), `StressTestPage.tsx` (1047->2095), `WithdrawalPage.tsx` (404->809), `lib/companion/resultsPayload.ts` (297->595), `hooks/useCompanionPlannerBridge.ts` (~320->643)
    Every file modified by the initial refactor commit (`36d04f0`) was committed with its entire content appended twice. The duplicated exports would cause TypeScript compilation errors. Some were fixed by later branches, but `ProjectionPage.tsx` and `useCompanionPlannerBridge.ts` may still have duplicated content in the committed branch state.
    *Reported by: Full Deep Review (4c)*

18. **`WithdrawalPage` reads always-empty `validationErrors` from legacy adapter -- MC run-gate never blocks on profile errors.**
    `frontend/src/pages/WithdrawalPage.tsx:101-104`
    `buildHouseholdRuntimeLegacyInputs` always returns `validationErrors: emptyValidationErrors()`. So `mcValidationErrors` never contains profile errors. The `canRunExplore` gate fails to block MC runs when the household plan has validation errors.
    *Reported by: Architect (4c)*

### PR-5

19. **Post-FIRE adults fail household validation (Confidence: 95).**
    `frontend/src/lib/household/validation.ts:105-107`
    `validateAdult` uses `retirementAge <= currentAge` (strict `<=`), rejecting `retirementAge === currentAge`. But this is exactly the state for a post-FIRE user who has already retired. The legacy schema correctly exempts `lifeStage === 'post-fire'`. A post-FIRE user hydrated from legacy stores will get a spurious validation error, setting `hasValidationErrors: true` and gating all simulation runs.
    *Reported by: Correctness (5), Gemini (5), Codex (5), Full Deep Review (5)*

20. **`fromLegacyIndividual.ts` imports live Zustand stores as a side-effecting default parameter.**
    `frontend/src/lib/household/fromLegacyIndividual.ts:67-73, :368`
    `fromLegacyIndividual` has default parameter `snapshot = snapshotLegacyIndividual()`, which calls `useProfileStore.getState()`, `useIncomeStore.getState()`, `usePropertyStore.getState()`. Any call site that omits the argument (typo, refactor) silently reads live store state. The function is imported by `useHouseholdPlanStore.ts`, creating transitive store-to-store imports through `lib/`.
    *Reported by: Architect (5)*

21. **`removeAdult` leaves dangling `timing.owner` references when `fallbackTimingOwner` is null.**
    `frontend/src/stores/useHouseholdPlanStore.ts:299-333`
    When no adults remain after removal, entries with `owner: 'shared'` and `timing.owner: 'partner'` survive `removeOwnerScopedEntries` but are not reanchored. The plan is left in a permanently errored state with no recovery action. No guard prevents removing the last adult.
    *Reported by: Architect (5), Correctness (5), Plan Compliance (5), Gemini (5)*

22. **`retirementSpendingAdjustment: 0` in `fromExpenseImport.ts` -- zeroes out retirement spending for imported plans.**
    `frontend/src/lib/household/fromExpenseImport.ts:372`
    `createBaseExpense` sets `retirementSpendingAdjustment: 0`, meaning 0% of pre-retirement expenses in retirement. The convention is `1.0` (100%). Any household imported from Expense will compute zero retirement withdrawal need unless manually fixed.
    *Reported by: Architect (5)*

23. **`removeAdult` cascade deletes by `owner`, not `id` -- removes entries for ALL adults with the same owner label.**
    `frontend/src/stores/useHouseholdPlanStore.ts:303`
    Since `AdultOwner` is limited to `'self' | 'partner'`, and validation only enforces uniqueness for `self`, a plan with two `partner` adults would have both partners' entries deleted when either is removed.
    *Reported by: Codex (5)*

---

## WARNING (convention violations, missing tests, architectural concerns)

### PR-4a

24. **`buildMonteCarloEngineParams` hybrid legacy/normalized array length mismatch risk.**
    `frontend/src/lib/simulation/monteCarloParams.ts:327-346`
    `annualSavings` comes from the legacy path (built with legacy ages) while `retirementAge` comes from the normalized path. No assertion that `annualSavings.length == retirementAge - currentAge`.
    *Reported by: Architect (4a)*

25. **`scenarioOverrides`/`profileOverrides` cache key conflation.**
    `frontend/src/lib/household/toAnalysisInputs.ts:185-186`, `monteCarloParams.ts:335-336`
    When both `scenarioOverrides` and `profileOverrides` are present, `profileOverrides` is dropped from the hash. Two calls differing only in `profileOverrides` will collide on the same cache key -- silent cache-poisoning.
    *Reported by: Architect (4a), Correctness (4a), Full Deep Review (4a)*

26. **Full-store subscriptions on `useAllocationStore()`, `useSimulationStore()`, `useWithdrawalStore()` across 12+ hooks.**
    `useFireCalculations.ts:28`, `useAnalysisPortfolio.ts:29`, `useProjection.ts:31,32`, `useRiskAssessment.ts:23`, `useWhatIfMetrics.ts:141`, `useWithdrawalComparison.ts:34,35`, `usePortfolioStats.ts:24`, `useOneMoreYear.ts:40`, `useExplorePortfolio.ts:29`, `useMonteCarloWorkerQuery.ts:84-86`, `useBacktestQuery.ts:153-155`, `useSequenceRiskQuery.ts:138-140`
    CLAUDE.md requires selector functions. All of these do `const allocation = useAllocationStore()` (full subscription). CLAUDE.md says "migrate when touching those files" and PR-4b explicitly touched all of them. Three new hooks in PR-4a (`useAnalysisPortfolio`, `useRiskAssessment`, `useHouseholdRuntimeInputs`) perpetuate it instead of fixing it.
    *Reported by: Architect (4a, 4b), Plan Compliance (4b), Full Deep Review (4b)*

27. **`getBaseInputs` and `computeMetrics` are pure functions living in `hooks/useWhatIfMetrics.ts`.**
    `frontend/src/hooks/useWhatIfMetrics.ts:46-131`
    Both functions are exported, both are pure (no React hooks inside), and both are imported by `hooks/useDisruptionImpact.ts`. CLAUDE.md: "Pure functions belong in `lib/`, not `hooks/`." The existing exception only covers `buildProjectionParams` and `deriveCpfHousingFromProperty`.
    *Reported by: Architect (4a)*

28. **Unbounded cache growth in `useNormalizedAnalysisStore` entries.**
    `frontend/src/stores/useNormalizedAnalysisStore.ts:109-128`
    Every distinct scenario override combination creates a new entry. `CompiledHouseholdPlan` objects are large (year arrays, milestones, adult data). No eviction. A long session with many what-if explorations will cause unbounded memory growth.
    *Reported by: Gemini (4a), Full Deep Review (4a)*

29. **Withdrawal flattening loses inflation adjustment in MC.**
    `frontend/src/lib/simulation/monteCarloParams.ts:272`, `frontend/src/lib/household/toAnalysisInputs.ts:160`
    Retirement withdrawals are flattened back to the raw profile amount in MC, ignoring the richer normalized expansion. Multi-year inflation-adjusted withdrawals are understated.
    *Reported by: Codex (4a)*

30. **False staleness from `withdrawalRevision` in MC run signature.**
    `frontend/src/stores/useNormalizedAnalysisStore.ts:167,176`, `frontend/src/lib/simulation/monteCarloParams.ts:298-299`
    MC run signature includes `withdrawalRevision`, but MC params come from `simulation.selectedStrategy`/`simulation.strategyParams`, not `useWithdrawalStore`. Changing withdrawal-comparison settings marks MC results stale without any real MC input change.
    *Reported by: Codex (4a)*

31. **`resolveLegacyPortfolioAdjustmentAmount` silently falls through on lookup failure.**
    `frontend/src/lib/household/toAnalysisInputs.ts:156-175`
    For `retirement-withdrawal` adjustments, if the ID stripping fails or the withdrawal was removed from the profile, the fallback value's sign may not match expectations. No log/error on fallthrough.
    *Reported by: Correctness (4a)*

32. **Raw throw inside hook `useNormalizedLegacyAnalysisContext` without error boundary guarantee.**
    `frontend/src/hooks/useIncomeProjection.ts:179-207`
    The throw at line 180-182 for null `compiledPlan` will propagate as an uncaught React render error. No error boundary is documented for consumers.
    *Reported by: Architect (4a, 4b)*

33. **Pre-/post-retirement expense asymmetry in legacy MC path.**
    `frontend/src/lib/simulation/monteCarloParams.ts:159,161,231,304`, `frontend/src/lib/household/toAnalysisInputs.ts:247`
    The legacy MC path subtracts healthcare and parent-support costs before retirement but not after. The adapter keeps the legacy `annualExpensesAtRetirement` instead of the normalized household retirement expense base, understating first-year withdrawals in expense mode.
    *Reported by: Codex (4a)*

34. **`scenarioOverrides` typed as `unknown` -- no type safety on hash inputs.**
    `frontend/src/lib/household/toAnalysisInputs.ts:31`
    Allows callers to pass arbitrary data including non-serializable values (functions, circular refs) that will be JSON-serialized and hashed.
    *Reported by: Full Deep Review (4a)*

### PR-4b

35. **`useDashboardCharts` uses `profile.retirementAge`/`profile.currentAge` instead of `normalized.*` equivalents.**
    `frontend/src/hooks/useDashboardCharts.ts:32,37,39,42`
    Inconsistent with the pattern every other hook in PR-4b uses. When household plans use differing retirement ages per adult, this will silently diverge.
    *Reported by: Architect (4b)*

36. **`useIncomeProjection` constructs projection params inline instead of using `buildProjectionParams`.**
    `frontend/src/hooks/useIncomeProjection.ts:327-376`
    30+ field param object built manually rather than calling `buildProjectionParams`. This is the "no duplicate parameter construction" bug pattern from MEMORY.md. The `useMemo` dep array has 30+ entries that must be kept in sync.
    *Reported by: Architect (4b), Full Deep Review (4b)*

37. **`useDisruptionImpact` does not read `normalized.*` for timing fields.**
    `frontend/src/hooks/useDisruptionImpact.ts:208,210,250,251`
    Uses raw `profile.*` timing values while all other migrated hooks use `normalized.*`. Same risk as #35 for multi-adult future plans.
    *Reported by: Architect (4b)*

38. **`usePortfolioStats` uses `profile.currentAge`/`profile.lifeExpectancy` for cross-store validation.**
    `frontend/src/hooks/usePortfolioStats.ts:30`
    Inconsistent with the normalized pattern. The allocation page doesn't currently expose normalized context.
    *Reported by: Architect (4b)*

39. **N x `compileHouseholdPlan` on cache miss per render cycle.**
    `frontend/src/hooks/useHouseholdRuntimeInputs.ts:10`
    Every hook calling `useHouseholdRuntimeInputs` (8 hooks total) triggers `compileHouseholdPlan` synchronously in the `useMemo` body on a cache miss. On the first render after each mutation, compilation runs N times until the `useEffect` persists the result.
    *Reported by: Architect (4b)*

40. **`useSequenceRiskQuery` off-by-one slice -- skips first retirement year's income (Confidence: 83).**
    `frontend/src/hooks/useSequenceRiskQuery.ts:76-78`
    `postRetirementIncomeByYear.slice(retirementOffset + 1, ...)` skips year 0 of retirement. The legacy `buildLegacySequenceRiskSurface` includes it. Same pattern in `toAnalysisInputs.ts:244-246` -- may be intentional but diverges from legacy.
    *Reported by: Correctness (4b)*

41. **Backtest hook missing `portfolioInjections` parameter.**
    `frontend/src/hooks/useBacktestQuery.ts:116-148`
    The sequence risk hook correctly passes both `oneTimeWithdrawals` AND `portfolioInjections`. The backtest hook only passes `oneTimeWithdrawals`. Asset unlocks, property sale proceeds, etc. are silently dropped.
    *Reported by: Gemini (4b)*

42. **`useWithdrawalComparison` not migrated to normalized inputs on PR-4b branch.**
    `frontend/src/hooks/useWithdrawalComparison.ts`
    Still reads `profile.currentAge`, `profile.retirementAge`, `profile.lifeExpectancy` directly from the profile store. Does not call `useNormalizedLegacyAnalysisContext()` at all. Inconsistent with every other hook in the PR.
    *Reported by: Full Deep Review (4b)*

43. **`useFireCalculations` validation gate uses profile-only errors, not household-aggregated validation.**
    `frontend/src/hooks/useFireCalculations.ts:~33`
    Checks `Object.keys(profile.validationErrors).length > 0` on the profile store rather than the aggregated `hasValidationErrors` from `useHouseholdPlanStore`. Income or property validation errors won't block computation.
    *Reported by: Full Deep Review (4b)*

### PR-4c

44. **`StressTestPage` directly imports and calls `compileHouseholdPlan` -- duplicate compilation bypassing normalized cache.**
    `frontend/src/pages/StressTestPage.tsx:19-24`
    A second independent compilation of the plan, separate from the normalized analysis cache. Two compiled plans exist for the same inputs. If they diverge, the household display shows different numbers than what the MC engine ran on.
    *Reported by: Architect (4c)*

45. **`StressTestPage.test.tsx` does not mock `useNormalizedLegacyAnalysisContext` -- real implementation runs in tests.**
    `frontend/src/pages/StressTestPage.test.tsx`
    Unlike the other two page tests which mock the hook, `StressTestPage` relies on real compilation from the household store. Tests not calling `seedHouseholdPlan()` rely on default plan state being compilable. 6 test failures reported.
    *Reported by: Correctness (4c), Full Deep Review (4c)*

46. **`WithdrawalPage` test: profile/normalized mismatch causes assertion failures (Confidence: 95).**
    `frontend/src/pages/WithdrawalPage.test.tsx:243`
    Test sets `useProfileStore.getState().setField('currentAge', 40)`, but code reads `normalized.currentAge` from mock returning `35`. Test expectations don't match code behavior.
    *Reported by: Full Deep Review (4c)*

47. **Mixed-source reads in `StressTestPage` callbacks -- `useProfileStore.getState()` + `normalized.*`.**
    `frontend/src/pages/StressTestPage.tsx:670-674, 734-745`
    `runSelectedStressScenarios` and `runCompanionActionImpacts` pass full legacy store snapshots to downstream functions while using `normalized.*` for ages. Creates mixed-source risk if these ever diverge.
    *Reported by: Plan Compliance (4c), Full Deep Review (4c)*

48. **Companion freshness signature too narrow -- only serializes `annualExpenses` and `retirementAge`.**
    `frontend/src/hooks/useCompanionPlannerBridge.ts:74`
    Changes to initial portfolio, allocation weights, or expected returns will not trigger a stale-data nudge. The companion UI will show "Fresh" while displaying stale results.
    *Reported by: Gemini (4c)*

49. **`resultsPayload.ts` FIRE age semantic change -- `projected_fire_age_p50` now returns `undefined` when portfolio never crosses target.**
    `frontend/src/lib/companion/resultsPayload.ts:182-201`
    Previously defaulted to `retirementAge`. Now returns `undefined`. TypeScript types already mark the fields as optional, and tests cover the change, but this is a semantic contract change for companion consumers.
    *Reported by: Codex (4c), Full Deep Review (4c)*

50. **Migration ledger (`household-field-mapping.md`) not updated in PR-4c.**
    The plan requires "each PR that changes authoring or analysis inputs must update a migration ledger." PR-4c did not annotate which fields migrated and which remain on legacy stores.
    *Reported by: Plan Compliance (4c)*

51. **`useWhatIfMetrics.getBaseInputs` omits `cashReserveOffset` and `lockedAssets` (Confidence: 90).**
    `frontend/src/hooks/useWhatIfMetrics.ts:85-106`
    These are present in `useFireCalculations` but absent from `getBaseInputs`. The What-If panel's "base" FIRE number will diverge from the main dashboard FIRE number -- a user-visible calculation inconsistency.
    *Reported by: Correctness (4c)*

### PR-5

52. **No `migrate` function on `useHouseholdPlanStore` persist middleware -- schema evolution unhandled.**
    `frontend/src/stores/useHouseholdPlanStore.ts:469-493`
    Every other store defines a `migrate` function. `HOUSEHOLD_PLAN_STORAGE_VERSION = 1` suggests versioning was anticipated, but the infrastructure to execute it is absent. Any schema change now requires retrofitting migration under time pressure.
    *Reported by: Architect (5)*

53. **`isPersistedState` guard too permissive -- accepts any non-null object.**
    `frontend/src/stores/useHouseholdPlanStore.ts:158-160`
    `typeof value === 'object' && value !== null` accepts arrays, Dates, corrupt blobs. A malformed localStorage entry (e.g. `{ plan: "not-a-plan" }`) would pass the guard and potentially cause deep runtime errors when `clonePlan` or `validateHouseholdPlan` try to iterate.
    *Reported by: Architect (5), Plan Compliance (5), Codex (5), Full Deep Review (5)*

54. **Module-level `INITIAL_PLAN` constructed eagerly from store defaults -- fragile initialization order.**
    `frontend/src/stores/useHouseholdPlanStore.ts:209-210`
    `createManualHouseholdPlan()` calls `fromLegacyIndividual(createDefaultLegacyIndividualSnapshot())` at module load time. If initialization order ever shifts, or tests import this store before default modules resolve, the plan will be computed from uninitialized state.
    *Reported by: Architect (5), Correctness (5)*

55. **`validateAdult` does not validate sub-objects (CPF, SRS, healthcare, taxProfile).**
    `frontend/src/lib/household/validation.ts:98-120`
    Only validates 7 top-level fields. Invalid CPF balances, SRS investment returns outside valid ranges, or malformed healthcare configs pass silently. `hasValidationErrors: false` while downstream engines may crash.
    *Reported by: Gemini (5), Full Deep Review (5)*

56. **Property validation much weaker than legacy store.**
    `frontend/src/lib/household/validation.ts:201`
    Only checks `ownershipPercent`, `purchasePrice`, `existingPropertyValue`, `existingMortgageBalance`, `existingMonthlyPayment`. Legacy store also validates `leaseYears`, `mortgageRate`, `mortgageTerm`, `ltv`, downsizing fields. Plans via JSON import can bypass household validation.
    *Reported by: Codex (5)*

57. **`runtimeLegacyInputs.ts`: `Math.min(...emptyArray)` returns `Infinity` for `srsDrawdownStartAge` and `cpfLifeStartAge`.**
    `frontend/src/lib/household/runtimeLegacyInputs.ts:372, 393`
    When `plan.adults` is empty (a validated-error but reachable state), `Math.min()` returns `Infinity`, which propagates through downstream calculations.
    *Reported by: Correctness (5)*

58. **`lifeExpectancySchema` max raised from 120 to 130 without CLAUDE.md update.**
    `frontend/src/lib/validation/schemas.ts:10`
    CLAUDE.md documents range as "50-120". Household `validateAdult` has no upper bound at all. Creates documentation/code discrepancy.
    *Reported by: Plan Compliance (5), Full Deep Review (5)*

59. **`parityMeta.source` misleadingly set to `'legacy-individual-store-adapter'` for manually created plans.**
    `frontend/src/stores/useHouseholdPlanStore.ts:107-116`, `frontend/src/lib/household/types.ts:276`
    Manual plans created via `createManualHouseholdPlan()` go through `fromLegacyIndividual`, stamping `source: 'legacy-individual-store-adapter'`. This is misleading in exported JSON and for provenance tracking.
    *Reported by: Architect (5), Full Deep Review (5)*

60. **`reliefBasisAge` fallback uses hardcoded `30` instead of current profile age.**
    `frontend/src/stores/useIncomeStore.ts:327`
    `setReliefBreakdown` uses `reliefBasisAge ?? 30`. The first switch into detailed relief mode can materialize the wrong `personalReliefs` and tax basis if the user isn't 30.
    *Reported by: Codex (4a)*

61. **Property store v8 migration field name mismatch.**
    `frontend/src/stores/usePropertyStore.ts:257`
    The v8 migration writes `applyBalaDecay`, but the live field is `existingApplyBalaDecay`. Silently resets old persisted values.
    *Reported by: Codex (4a)*

62. **Missing "liabilities" CRUD per plan task list.**
    `frontend/src/stores/useHouseholdPlanStore.ts`
    The plan says "implement CRUD actions for adults, dependents, incomes, assets, **liabilities**, expenses, goals, and property." No `liabilities` collection exists. May be intentionally covered by assets/properties, but deviates from plan text.
    *Reported by: Plan Compliance (5)*

---

## INFO (style suggestions, minor improvements)

### PR-4a

63. **`MONTE_CARLO_NORMALIZED_OWNER = 'PR4B'` is a PR-era constant left in production code.**
    `frontend/src/stores/useNormalizedAnalysisStore.ts:82`
    Will become misleading documentation once the PR stack lands. Rename to something domain-meaningful or remove.

64. **`NormalizedAnalysisEntry.selectors` is `Partial<>` but always fully populated after construction.**
    `frontend/src/stores/useNormalizedAnalysisStore.ts:90`
    The `Partial<>` type is weaker than the construction invariant. Tightening to non-partial would catch future partial-construction mistakes at compile time.

65. **`householdRetirementYearOffset` vs `retirementAge - currentAge` in `useAnalysisPortfolio`.**
    `frontend/src/hooks/useAnalysisPortfolio.ts:55`
    For multi-adult households, `householdRetirementYearOffset` is the household-wide earliest retirement, not necessarily the reference adult's retirement.

66. **`prMonths` missing from inline `useMemo` deps in `useIncomeProjection` (pre-existing bug).**
    `frontend/src/hooks/useIncomeProjection.ts`
    The normalized path through `buildProjectionParams` includes `prMonths`; the legacy inline path omits it from the dep array.

67. **`strategyParams as unknown as Record<string, Record<string, number>>` double-cast.**
    `frontend/src/hooks/useWithdrawalComparison.ts:92`
    Store type and function param type are misaligned. The double-cast via `unknown` is the `as any` equivalent.

68. **Post-retirement goals missing in legacy MC builder (pre-existing bug).**
    `frontend/src/lib/simulation/monteCarloParams.ts:197-241`
    The post-retirement branch has no `goalDeduction` logic. Post-retirement financial goals are completely ignored in the legacy MC simulation.

69. **Revision counters reset on page reload (by design).**
    All store revision counters are excluded from `partialize` and bumped to 1 on rehydration. Prevents IndexedDB-based analysis persistence but is safe for current ephemeral cache.

70. **`stableRunOverrideHash` and `stableScenarioOverrideHash` are identical functions aliased.**
    `frontend/src/stores/useNormalizedAnalysisStore.ts:147-153`
    Both delegate to `hashCanonicalValue`. Two names exist for intent documentation but coupling is not obvious.

71. **Cash reserve logic duplicated between `toAnalysisInputs.ts` and `monteCarloParams.ts`.**
    `frontend/src/lib/household/toAnalysisInputs.ts:126-154` vs `monteCarloParams.ts:245-266`
    Both call the same underlying functions but maintaining two call sites means parameter changes must be applied in both places.

### PR-4b

72. **`buildLegacyHouseholdRevision` appears to be dead code.**
    `frontend/src/stores/useNormalizedAnalysisStore.ts:103-107`
    Exported from PR-4a but unused in PR-4b hooks. All hooks use `buildHouseholdPlanRevision` instead.

73. **`useCpfProjection` normalized path may produce blank `milestoneFormula` strings.**
    `frontend/src/hooks/useCpfProjection.ts:47-69`
    The `milestoneFormula` strings are only generated in the legacy path. If the compiler does not produce them, users on the normalized path see blank milestone labels.

74. **Dollar basis assumption in `useWithdrawalComparison` undocumented and fragile.**
    `frontend/src/hooks/useWithdrawalComparison.ts:75-78`
    `getEffectiveExpenses` returns today's dollars, then multiplied by `(1+i)^yearsToRetirement`. If upstream ever changes to return age-based scaled expenses, this double-inflates.

75. **Double memoization in `useNormalizedLegacyAnalysisContext`.**
    `frontend/src/hooks/useIncomeProjection.ts:187-207`
    Inner `useMemo` wraps fields already stable from outer `useMemo`. Minimal overhead but increases cognitive surface.

### PR-4c

76. **Double `useNormalizedLegacyAnalysisContext` invocation in `WithdrawalPage`.**
    `frontend/src/pages/WithdrawalPage.tsx:67-70`
    `useHouseholdRuntimeInputs` internally calls it, and the page calls it directly. Cache prevents double compilation but double `setActiveCacheKey` fires per render.

77. **`lastBaseRetirementAgeRef` only updates inside `runMonteCarlo` callback.**
    `frontend/src/pages/StressTestPage.tsx:556`
    If store retirement age changes without re-running MC, the "Base" row in the stress comparison table uses a mismatched retirement age.

78. **No test verifies pages render correctly when household feature flag is OFF.**
    Regression risk given the plan states "PRs 1-6 must be non-user-visible when the household feature flag is off."

79. **`ProjectionPage` inflation read path difference from projection engine.**
    `frontend/src/pages/ProjectionPage.tsx:65`
    Page uses `normalized.compiledPlan.assumptions.returns.inflation`; `useProjection` uses `profile.inflation` from `buildHouseholdRuntimeLegacyInputs`. Same value in practice but implicit coupling.

80. **Race condition in companion result attribution.**
    `frontend/src/hooks/useCompanionPlannerBridge.ts:121`
    `pendingRunContextRef` can be overwritten if the user switches scenarios while a simulation is in-flight.

### PR-5

81. **Double `structuredClone` in add actions -- unnecessary GC pressure.**
    `frontend/src/stores/useHouseholdPlanStore.ts:281,339,361,379`
    Actions clone the plan AND clone the item being pushed. The item was passed by the caller and doesn't need deep-cloning before pushing into an already-cloned plan.

82. **Synchronous full-plan validation on every mutation.**
    `frontend/src/stores/useHouseholdPlanStore.ts:131-144`
    `validateHouseholdPlan` runs on every keystroke. O(n) walk across all collections. Fine for current scale but not debounced.

83. **`HouseholdPlanRevisionState` unexported -- limits selector typing ergonomics.**
    `frontend/src/stores/useHouseholdPlanStore.ts:82-84`
    Hooks wanting to type-narrow the revision counter for selectors cannot reference this type.

84. **`INITIAL_PLAN` module-level constant shared by reference in initial store state.**
    `frontend/src/stores/useHouseholdPlanStore.ts:210, 227`
    Passed to `buildValidatedState` without cloning. Every mutation calls `clonePlan` first so it's safe, but a defensive clone would prevent theoretical mutation leakage.

85. **`resolveReliefBasisAge` brute-force heuristic may pick wrong age.**
    `frontend/src/lib/household/fromLegacyIndividual.ts:86`
    Loops 0-120 to find matching age. If multiple ages yield the same total, picks closest to `currentAge`. For manually tuned legacy data, could silently pick unintended basis age.

86. **`ownershipPercent` error message says "between 1% and 100%" but validation checks `(0, 1]` (decimal fraction).**
    `frontend/src/lib/household/validation.ts:192`
    Legacy data using integer percentages (0-100) would fail validation without normalization.

87. **Shallow copy of `healthcareConfig` in `fromLegacyIndividual`.**
    `frontend/src/lib/household/fromLegacyIndividual.ts:133`
    `{ ...profile.healthcareConfig }` is shallow. If `HealthcareConfig` gains nested objects, this maintains cross-store references.

88. **`fromLegacyIndividual` `durationYears: 0` and `durationYears: 1` both produce `startAge === endAge`.**
    `frontend/src/lib/household/fromLegacyIndividual.ts:271,319`
    `Math.max(durationYears - 1, 0)` maps both 0 and 1 to 0. Verify downstream engines handle `startAge === endAge` as a single-year event.

---

## Cross-PR Patterns

### 1. Mixed-source reads: legacy stores + normalized context
The most pervasive issue across PR-4a through PR-4c. At least 8 hooks/pages read timing fields (`currentAge`, `retirementAge`, `lifeExpectancy`) from `normalized.*` while reading financial data (`annualExpenses`, `annualIncome`, `inflation`, `liquidNetWorth`) from legacy stores. For single-adult plans these values agree, but the pattern creates a maintenance hazard and will diverge for multi-adult household plans.
**Affected:** `useCompanionPlannerBridge`, `useDashboardCharts`, `useDisruptionImpact`, `usePortfolioStats`, `StressTestPage`, `WithdrawalPage`, `useWithdrawalComparison`, `useMonteCarloWorkerQuery`

### 2. Full-store subscriptions instead of selectors
CLAUDE.md requires `const x = useStore((s) => s.field)`. Every migrated hook in PR-4b uses `const store = useStore()` (full subscription). CLAUDE.md says "migrate when touching those files." PR-4b touched all 12 files without migrating any. The `useMemo` dep arrays are already granular; the fix is mechanical.

### 3. Test suites seeding wrong stores after migration
PR-4b migrated hooks from legacy stores to `useHouseholdPlanStore`, but all unit tests and parity tests still seed `useProfileStore`/`useIncomeStore`/`usePropertyStore`. This makes the test suites non-functional for their intended purpose -- they test default state rather than fixture values. The parity test, which is the core correctness guarantee of the migration, is affected.

### 4. Goals dropped from normalized MC path
Goals are filtered out of `portfolioAdjustments` in `toAnalysisInputs.ts` and are not included in `annualSavingsByYear`. This means goals completely vanish from the normalized simulation path. The legacy path has partial goal support (pre-retirement only). Both paths need goal coverage.

### 5. `buildMonteCarloEngineParams` split-brain design
The function constructs parameters from two independent paths (legacy and normalized) and merges them with selective field overrides. This creates a class of bugs where arrays (e.g., `annualSavings`) and scalars (e.g., `retirementAge`) are built from different source data and can become misaligned. Multiple reviewers flagged this across all 4 PRs.

### 6. Validation gaps in household model vs. legacy model
The household `validateAdult` only checks 7 top-level fields. The legacy system validates CPF balance ranges, SRS settings, mortgage parameters, lease years, LTV ratios, downsizing fields, and more. Plans imported via JSON or the expense tracker can bypass household validation while containing invalid financial parameters.

### 7. Post-FIRE user hydration failure
The household validator rejects `retirementAge === currentAge` (strict `<=`), but the legacy schema, timing engine, and runtime inputs all support this as a valid post-FIRE state. Already-retired users hydrated into the household store get a spurious validation error that gates all simulation runs. Flagged by 4 independent reviewers across PR-5.

### 8. File content duplication in PR-4c commits
The initial commit of PR-4c (`36d04f0`) appended file contents twice for 5 files. This creates TypeScript compilation errors in the committed branch state. Some were fixed by later branches but others may persist.
