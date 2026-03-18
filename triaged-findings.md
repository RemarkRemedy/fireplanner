# Consolidated Triage: PR-4a through PR-12

**Date:** 2026-03-08
**Branch:** `codex/pr-11-household-import-review`
**Method:** 30+ review agents across 5 reports, deduplicated and verified against current code by 6 verification agents.

## Summary

| | CRITICALs | WARNINGs/MEDIUMs | Total |
|---|-----------|------------------|-------|
| **VALID (still broken)** | 28 | 55 | 83 |
| **FIXED** | 8 | 14 | 22 |
| **FALSE POSITIVE** | 2 | 7 | 9 |

---

## CRITICAL Findings (28 confirmed valid)

### Simulation Engine

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C1 | Goals filtered from normalized MC path — `.filter(adj => adj.kind !== 'goal')` silently drops all goals | `toAnalysisInputs.ts:250` | PR-4a #1 |
| C2 | Split-brain `buildMonteCarloEngineParams` — spreads legacy params then overrides only 4 fields; `annualSavings` array length can mismatch normalized `retirementAge` | `monteCarloParams.ts:327-346` | PR-4a #2 |
| C3 | `annualSavings` off-by-one — normalized includes retirement year, legacy excludes it | `toAnalysisInputs.ts:228-234` | PR-4a #3 |
| C9 | Backtest drops non-withdrawal portfolio adjustments — asset unlocks, downsizing proceeds silently excluded | `useBacktestQuery.ts:108-113` | PR-4b #15 |

### Architecture Violations

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C4 | `monteCarloParams.ts` imports from `hooks/` — `lib/` depending on `hooks/` | `monteCarloParams.ts:10` | PR-4a #4 |
| C5 | `toAnalysisInputs.ts` calls `getState()` from `lib/` — store mutation from pure function | `toAnalysisInputs.ts:193-209` | PR-4a #6 |

### Stale/Hardcoded Values

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C6 | Hardcoded FRS `213000` — outdated, should be dynamic `getRetirementSumAmount()` | `useProjection.ts:70` | PR-4a #7, PR-12 C3 |

### Test Infrastructure

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C7 | All PR-4b test suites seed wrong stores — tests seed legacy stores, not household | `useFireCalculations.test.ts` + 5 others | PR-4b #10-11 |
| C34 | 127 test failures (was 114) — migration incomplete | multiple test files | PR-12 C2 |

### Reactive Bypass

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C8 | `getState()` inside `useMemo` in `useDisruptionImpact.ts:235` — memo won't re-run on allocation changes | `useDisruptionImpact.ts:235` | PR-4b #12 |

### Companion Bridge

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C10 | `useCompanionPlannerBridge` mixes legacy + normalized stores — partially migrated | `useCompanionPlannerBridge.ts:4-6` | PR-4c #16, PR-6 C3, PR-8a W3, PR-12 C1 |

### Validation

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C11 | `WithdrawalPage` reads always-empty `validationErrors` — MC run-gate never blocks | `WithdrawalPage.tsx:101-104` | PR-4c #18 |
| C16 | Missing HouseholdPlan Zod schema in `STORE_SCHEMAS` — import skips validation | `validation/schemas.ts:359` | PR-6 C1 |

### Feature Flag

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C19 | Feature flag NOT gating StartPage — `PlanTypeSelector`/`HouseholdSetupWizard` render unconditionally | `StartPage.tsx:336,375` | PR-7 C1 |
| C20 | Wizard never retimes seeded rows for 65+ users | `HouseholdSetupWizard.tsx:74,79` | PR-7 C2 |

### Household Editor Data Integrity

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C22 | Partner clone copies all financial data — doubles CPF/SRS/liquidNetWorth | `PeopleSection.tsx:26` | PR-8b C1 |
| C23 | Partner toggle doesn't update `planType` — stays `'individual'` after adding partner | `PeopleSection.tsx:134,141` | PR-8b C2 |
| C24 | `syncAdultLiquidNetWorths` type-unsafe (`Record<string, unknown>`) and reads stale state | `AssetsPropertySection.tsx:41-60` | PR-8c C1 |

### Analysis UI

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C25 | Breakdown panel includes `retirement-withdrawal` in "Costs today" | `HouseholdBreakdownPanel.tsx:58` | PR-9 C1 |
| C26 | Property cost uses raw `existingMonthlyPayment * 12` — ignores CPF offset, ownership %, timing | `HouseholdBreakdownPanel.tsx:80` | PR-9 C2 |
| C27 | StressTestPage passes raw `annualIncome` missing bonuses | `StressTestPage.tsx:790` | PR-9 C3 |

### Scenario Engine

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C28 | Shared-expense overrides hit one-off and retirement-withdrawal entries | `scenarios.ts:294,336,417` | PR-9 C5 |
| C29 | Expected-return overrides silently floored at `0` — blocks bearish scenarios | `scenarios.ts:386,464` | PR-9 C6 |
| C30 | Dollar basis of `retirementGap` unverified vs `currentAnnualSavings` | `scenarios.ts:242-273` | PR-9 C7 |

### Expense Import

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C13 | `retirementSpendingAdjustment: 0` + partner expense ends at retirement not life expectancy | `fromExpenseImport.ts:367,372` | PR-5 #22, PR-11 C1 |
| C31 | Partner base-living expense `endAge: retirementAge` instead of `lifeExpectancy` | `fromExpenseImport.ts:367` | PR-11 C1 |
| C32 | `annualCost` fallback reuses `monthlyExpense` — magnitude mismatch risk | `fromExpenseImport.ts:196` | PR-11 C2 |
| C33 | Dependent income subtracted but never re-added to plan — income vanishes | `fromExpenseImport.ts:492-497` | PR-11 C3 |

### Off-by-One

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| C35 | `endAge` off-by-one between fast path (`toLegacyIndividual.ts:63`) and aggregate path (`runtimeLegacyInputs.ts:440`) | both files | PR-12 C5 |

---

## CRITICAL Findings — FIXED (8)

| # | Finding | Notes |
|---|---------|-------|
| C12 | Post-FIRE adults fail household validation (`retirementAge <= currentAge`) | Fixed — `<=` check correct |
| C14 | `removeAdult` dangling `timing.owner` references | Fixed — guard + reanchor logic |
| C15 | `removeAdult` cascade deletes by owner not id | Fixed — semantically correct |
| C17 | `shouldClearLegacyAuthoringStores` inverted | Fixed — logic correct |
| C18 | `legacyAuthoringImports` test failure | Fixed — legacy imports removed |
| C21 | Rules of Hooks violation in `useHouseholdCpfAdapter` | Fixed — hooks before conditional return |
| C36 | `fromLegacyIndividual` default parameter side effect | FALSE POSITIVE — inside function body |
| C37 | File content duplication in PR-4c | Fixed — normal file sizes |
| C38 | Duplicated `createNormalizedAnalysisEntry` | FALSE POSITIVE — different implementations |

---

## WARNING/MEDIUM Findings (55 confirmed valid)

### Architecture & Convention Violations

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| W1 | `storeRegistry.ts` imports all 7 Zustand stores — broad coupling | `storeRegistry.ts:21-34` | PR-6 W2 |
| W2 | `companionBridge.ts` uses `as any` with eslint-disable (×2) | `companionBridge.ts:40,46` | PR-6 M6, PR-12 M4 |
| W3 | `disableLocalStoragePersistence` omits legacy authoring stores | `companionBridge.ts:25-31` | PR-6 M4, PR-11 W1, PR-12 M3 |
| W4 | `useUpdateNudges.ts` hardcodes storage key strings vs `storeKeys.ts` | `useUpdateNudges.ts:8-16` | PR-6 W4 |
| W5 | Six `as unknown as Record<string,unknown>` casts in `storeRegistry.ts` | `storeRegistry.ts:130,255,292,309,313,317` | PR-6 W5 |
| W6 | Pure computation functions in `.tsx` component files | `HouseholdBreakdownPanel.tsx:26-238` | PR-9 W18 |
| W8 | No `migrate` function on `useHouseholdPlanStore` persist middleware | `useHouseholdPlanStore.ts:469-493` | PR-5 #52 |
| W9 | `isPersistedState` guard too permissive — accepts any non-null object | `useHouseholdPlanStore.ts:158-160` | PR-5 #53 |
| W10 | Module-level `INITIAL_PLAN` constructed eagerly at import time | `useHouseholdPlanStore.ts:209-210` | PR-5 #54 |

### Mixed Legacy/Normalized Reads

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| W11 | `useDisruptionImpact` reads raw `profile.*` for timing fields | `useDisruptionImpact.ts:208,210,250,251` | PR-4b #37 |
| W12 | `usePortfolioStats` uses `profile.currentAge/lifeExpectancy` | `usePortfolioStats.ts:30` | PR-4b #38 |
| W13 | Story-first flow uses `profile.retirementAge` instead of calculated `fireAge` | `StartPage.tsx:221` | PR-7 W1 |
| W14 | `annualExpenses` fallback in `runtimeLegacyInputs.ts:354` may use nominal dollars | `runtimeLegacyInputs.ts:354` | PR-12 W5 |

### Store Access Patterns

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| W15 | Full-store subscription `useAllocationStore()` in `useFireCalculations.ts:28` | `useFireCalculations.ts:28` | PR-12 W3 |
| W16 | `.getState()` reads in StressTestPage callbacks bypass subscription | `StressTestPage.tsx:722-723,796-797` | PR-9 W2 |
| W17 | Module-level `getState()` in `SpendingGoalsSection.tsx` | `SpendingGoalsSection.tsx:137-148` | PR-8b M1 |
| W18 | `deriveHouseholdSectionToggles` called 3× per render in router | `router.tsx:50-52` | PR-7 M2 |

### Validation Gaps

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| W20 | `validateAdult` doesn't validate CPF/SRS/healthcare sub-objects | `validation.ts:98-120` | PR-5 #55 |
| W21 | Property validation much weaker than legacy store | `validation.ts:201` | PR-5 #56, PR-6 M3 |
| W23 | Zod schemas use `.passthrough()` allowing unmapped fields | `companion/types.ts:21,28,49` | PR-11 W3 |
| W24 | Healthcare `errorCount` hardcoded to 0 in `useSectionCompletion.ts:314` | `useSectionCompletion.ts:314` | PR-8a M3 |

### Hardcoded Values (should be in `lib/data/`)

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| W25 | Financial constants `DEFAULT_SWR=0.036` etc. hardcoded in StartPage | `StartPage.tsx:91-94` | PR-7 W2 |
| W26 | Healthcare defaults `oopBaseAmount: 1200` without source citation | `defaultHealthcareConfig.ts:8-9` | PR-7 W4 |
| W27 | Singapore regulatory values (LTV 0.75, lease 99yr) in `assetPropertyDefaults` | `assetPropertyDefaults.ts:68-105` | PR-8c W1 |
| W28 | Property defaults diverge from legacy without documentation | `assetPropertyDefaults.ts:62-106` | PR-8c W2 |
| W29 | CPF LIFE payout rate labels `~5.4%`, `~6.3%` hardcoded in `CpfSection` | `CpfSection.tsx:90-94` | PR-8a M2 |
| W30 | Hardcoded `growthRate: 0.03` in `fromExpenseImport.ts:334` | `fromExpenseImport.ts:334` | PR-11 W2 |

### Simulation & Calculation

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| W32 | Unbounded cache growth in `useNormalizedAnalysisStore` — no eviction | `useNormalizedAnalysisStore.ts` | PR-4a #28 |
| W33 | Cache key conflation — `profileOverrides` dropped when `scenarioOverrides` present | `toAnalysisInputs.ts:185-186` | PR-4a #25 |
| W34 | `resolveLegacyPortfolioAdjustmentAmount` silent fallthrough on lookup failure | `toAnalysisInputs.ts:156-175` | PR-4a #31 |
| W35 | Raw `throw` in `useNormalizedLegacyAnalysisContext` without error boundary | `useIncomeProjection.ts:179-207` | PR-4a #32 |
| W36 | Pre/post-retirement expense asymmetry — healthcare/parent-support differs | `monteCarloParams.ts:159,161,231,304` | PR-4a #33 |
| W37 | `scenarioOverrides` typed as `unknown` — no type safety | `toAnalysisInputs.ts:31` | PR-4a #34 |
| W38 | Backtest hook missing `portfolioInjections` parameter | `useBacktestQuery.ts:116-148` | PR-4b #41 |
| W39 | `srsPostFireEnabled` missing from `useMemo` dependency array | `useIncomeProjection.ts:381-430` | PR-12 W1 |
| W40 | `cloneRetirementWithdrawal` silently blocks legacy conversion for monthly expenses | `toLegacyIndividual.ts:136-150` | PR-6 W3 |

### Household Editor

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| W41 | `removeAdult` doesn't recompute `liquidNetWorth` | `useHouseholdPlanStore.ts:292` | PR-8b W1 |
| W42 | Duplicate CPF validation snapshot in adapter + section completion | `useHouseholdCpfAdapter.ts`, `useSectionCompletion.ts` | PR-8a W1 |
| W43 | `compileHouseholdPlan` in `useMemo` — runs on every plan change | `useHouseholdCpfAdapter.ts:216` | PR-8a W5 |
| W44 | Multi-step store mutation in wizard (5-6 sequential calls) | `HouseholdSetupWizard.tsx:73-117` | PR-7 W5 |
| W45 | Goal age bounds use `selectedAdult` instead of row's timing owner | `SpendingGoalsSection.tsx:603,733` | PR-8b M3 |
| W46 | Age 89+ produces immediately-invalid plan (life expectancy seeds at 90) | `PeopleRosterEditor.tsx:73,112` | PR-7 M4 |
| W47 | `ownershipPercent: 0.5` default undercounts shared property cash flows | `assetPropertyDefaults.ts:84` | PR-8c M1 |
| W48 | Glide path uses `||` instead of `??` — falsy `0` replaced with default | `AssumptionsSection.tsx:49` | PR-8c M2 |

### Scenario & Display

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| W49 | "One income stops" scenario targets by `isActive` without checking timing | `scenarios.ts:295,347` | PR-9 W10 |
| W50 | First dependent selection doesn't check if active or has cost > 0 | `scenarios.ts:298,362` | PR-9 W11 |
| W51 | `NullableNumberInput` emits `null` during intermediate typing | `NullableNumberInput.tsx:58,80` | PR-9 W12 |
| W52 | Percent fields use `NullableNumberInput` instead of `PercentInput` | `ScenarioLab.tsx:188,224` | PR-9 W9 |
| W53 | Manual delta badges instead of canonical `DeltaBadge` | `ScenarioLab.tsx:125-158` | PR-9 W14 |
| W54 | `retirementRow` index clamp silently falls back to wrong year | `HouseholdOverviewBar.tsx:71-73`, `HouseholdBreakdownPanel.tsx:191-193` | PR-9 W1 |
| W55 | `collectOwnerLabels` deduplicates by label string | `HouseholdBreakdownPanel.tsx:131` | PR-9 W6 |
| W56 | Milestone timeline missing sort before slice | `HouseholdMilestoneTimeline.tsx:75` | PR-9 W4 |
| W57 | React key collision in `ImportedPlanReview` — string value as key | `ImportedPlanReview.tsx:29` | PR-11 M1 |
| W58 | Raw `member.owner` displayed without label mapping | `ImportedPlanReview.tsx:62` | PR-11 M2 |
| W59 | Import reports success before localStorage writes confirmed | `storeRegistry.ts:379` | PR-6 M1 |
| W60 | `sectionVisibility` heuristics don't check `oopCurveVariant` | `sectionVisibility.ts:23-33` | PR-7 M3 |

### Test Issues

| # | Finding | File(s) | Source |
|---|---------|---------|--------|
| W61 | `WithdrawalPage.test.tsx` seeds profile age 40 but mock returns normalized age 35 | `WithdrawalPage.test.tsx:243` | PR-4c #46 |
| W62 | Stale test assertion "Household editor note" in `HouseholdCpfAdapter.test.tsx:263` | `HouseholdCpfAdapter.test.tsx:263` | PR-8a C2 |

---

## WARNING/MEDIUM Findings — FIXED (14)

| # | Finding | Notes |
|---|---------|-------|
| — | Full-store subscriptions across 12+ hooks | Selectors now used |
| — | `useWithdrawalComparison` not migrated to normalized | Uses `normalized.*` now |
| — | `useIncomeProjection` constructs params inline | Uses `buildProjectionParams` |
| — | Withdrawal flattening loses inflation in MC | Logic correct |
| — | Property migration Bala-decay field mismatch | v8/v9 migrations correct |
| — | `PlanUrlHandler` render-time side effect | In state initializer, safe |
| — | Scenario toast on failure | Try/catch with error toast |
| — | `syncTimingDuration` corrupts ongoing entries | Handles null correctly |
| — | Router `useEffect` too restrictive | Logic reasonable |
| — | SA_INTEREST_RATE for RA growth | Correct per CPF rules |
| — | Milestone null guard on `adultsById` | Optional chaining present |
| — | `fromExpenseImport` no unit tests | Test file exists (18 tests) |
| — | Hardcoded "Self"/"Partner" labels in ScenarioLab | Uses `adult.displayName` |
| — | Scenario switching stale state | Abort cleanup present |

---

## WARNING/MEDIUM Findings — FALSE POSITIVE (7)

| # | Finding | Notes |
|---|---------|-------|
| — | Hook in wrong directory (`useHouseholdCpfAdapter`) | Adapter pattern, correctly placed |
| — | `getBaseInputs`/`computeMetrics` pure functions in hooks/ | Colocated intentionally |
| — | N × `compileHouseholdPlan` per render | Compiled once, cached |
| — | `useSequenceRiskQuery` off-by-one slice | Slice math correct |
| — | `useFireCalculations` validation gate profile-only | Uses household `hasValidationErrors` |
| — | Breakdown panel doesn't check `income.isActive` | Has `isActiveAtCurrentYear()` check |
| — | `lifeExpectancySchema` max raised to 130 | Max is 120, matches CLAUDE.md |

---

## Cross-Cutting Themes

### 1. Mixed legacy/normalized reads (W11, W12, W13, W14, C10)
At least 5 hooks/pages read timing fields from `normalized.*` while reading financial data from legacy stores. Creates divergence risk for multi-adult plans.

### 2. Hardcoded Singapore values (W25-W30, C6)
7 locations with hardcoded financial/regulatory values that should be in `lib/data/` per CLAUDE.md rules.

### 3. Expense import data integrity (C13, C31, C32, C33, W30)
The `fromExpenseImport.ts` module has 4 critical bugs affecting partner expenses, income accounting, and magnitude handling.

### 4. Validation gaps (W20, W21, W23, W24, C16)
Household validation is significantly weaker than legacy — sub-objects not validated, property fields missing, Zod passthrough allows arbitrary data.

### 5. Scenario engine filters too broad (C28, C29, W49, W50)
Built-in scenarios apply overrides without checking periodicity, timing, or cost, causing incorrect modifications to one-off and retirement-withdrawal entries.

### 6. Store access violations (W15, W16, W17, C5, C8)
Mix of `getState()` in useMemo/callbacks and full-store subscriptions creating stale read and re-render issues.

### 7. Test infrastructure broken (C7, C34, W61, W62)
127 failing tests, wrong store seeding, stale assertions — test suite cannot validate the household migration.
