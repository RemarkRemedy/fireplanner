# Fireplanner Household Planner Rollout Plan

## Requirements Summary

- Fireplanner must remain a complete standalone planner for `individual`, `couple`, and `household` plans.
- Expense import must be optional and must feed the same internal planning model as manual entry.
- Household planning must support up to two planning adults plus dependents at launch.
- Planner outputs remain household-level, while inputs remain member-aware.
- Fireplanner must not become the canonical sync/shared-data system; sync, merge, and collaboration semantics stay out of scope.
- The current single-person planner must continue working during the transition.

## Decision Summary

- Introduce a new canonical authoring model: `HouseholdPlan`.
- Introduce a compiled analysis model: `NormalizedHouseholdPlan`.
- Treat existing single-person stores as a legacy authoring path that can be adapted into `HouseholdPlan`.
- Keep analysis/configuration stores (`allocation`, `simulation`, `withdrawal`) global for now.
- Move authoring state gradually into a new `useHouseholdPlanStore`.
- Deliver manual household authoring before Expense import.
- Use a versioned v2 portability envelope as the new persisted/share/import contract; do not dual-write legacy keys.
- Expose compiled household data through a dedicated Zustand-backed normalized analysis slice keyed by household-plan revision plus scenario override hash; migrated hooks subscribe to granular selectors instead of whole normalized objects.
- Keep existing route URLs stable (`/`, `/inputs`, `/projection`, `/withdrawal`, `/stress-test`, `/dashboard`) and gate household UX within those routes rather than creating a parallel household router tree during migration.

## Migration Constraints

- Legacy authoring-store migration must be tracked across authoring UI, derived analysis hooks/pages, and portability features before any legacy store can be retired.
- The rollout must preserve existing individual-plan data across local storage rehydration, JSON import/export, saved scenarios, share URLs, migration-detection nudges, and Excel export.
- Each PR that changes authoring or analysis inputs must update a migration ledger of non-test consumers of `useProfileStore`, `useIncomeStore`, and `usePropertyStore`.
- The appendix seed is not hand-maintained only: before PR 2 merges, refresh it from a non-test import grep over `useProfileStore`, `useIncomeStore`, and `usePropertyStore`, then append route-level surfaces that consume those legacy-backed hooks transitively (currently `/dashboard`).
- PRs 1-6 must be non-user-visible when the household feature flag is off.

## Flag and Rollback Strategy

- Add a runtime feature flag `householdPlannerV1` (new helper module under `frontend/src/lib/household/`) and default it to off in production until PR 7 is complete.
- Gate Start page entry points, router guards, sidebar navigation, Inputs page branches, and household analysis affordances behind the same flag.
- Flag-off behavior must preserve the current individual UX unchanged while allowing PRs 1-6 to merge to main safely.
- Rollback before PR 12 is flag-first: turn `householdPlannerV1` off to hide household creation/editing while preserving persisted v2 envelope data.
- `toLegacyIndividual()` exists only for one-adult rollback/interoperability. Multi-person plans are not lossy-down-converted into legacy stores; when the flag is off, those plans remain preserved in v2 and surface a read-only recovery screen with export/share actions instead of silent downgrade.

## Normalized Access Strategy

- Pre-PR-4A gate: lock the normalized analysis access contract before any hook migration starts.
- Use a dedicated `useNormalizedAnalysisStore` fed by `compileHouseholdPlan`, keyed by `householdRevision` plus `scenarioOverrideHash`.
- `householdRevision` is a monotonic semantic-change token, never a timestamp. During legacy-backed phases it is derived from authoring-store revision counters (`profileRevision:incomeRevision:propertyRevision`); after PR 5 it is the `useHouseholdPlanStore` revision counter. Hydrate/import/migration loads increment the relevant revision exactly once, while UI-only state changes do not.
- `scenarioOverrideHash` is a stable hash of canonicalized scenario overrides (sorted object keys, preserved array order) so equivalent overrides reuse the same normalized cache entry.
- The normalized analysis store owns the cached `NormalizedHouseholdPlan` plus selector-ready fragments for deterministic projection, Monte Carlo, backtest, CPF, healthcare, and companion consumers.
- Migrated hooks must subscribe to granular selector outputs from that store. Passing a freshly compiled `NormalizedHouseholdPlan` object through existing wide `useMemo` dependency arrays is not an acceptable migration strategy.
- Monte Carlo/backtest stale detection moves to revision-based signatures: authoring-derived invalidation uses `householdRevision`, while analysis-run signatures compose `householdRevision`, `scenarioOverrideHash`, relevant global-config revision counters, and run-override hash rather than raw JSON blobs of 30+ fields.
- The gate must define invalidation rules, scenario recompute rules, parity-fixture wiring, and explicit ownership for `useMonteCarloWorkerQuery` before PR 4A opens.

## Performance Constraints

- `compileHouseholdPlan` must recompute only when `householdRevision` or `scenarioOverrideHash` changes and must publish into the normalized analysis slice rather than handing whole-object snapshots directly to hooks.
- Legacy authoring stores and remaining global planner-input stores must expose semantic revision counters before revision-based invalidation replaces the current serialized signatures in migrated hooks.
- Migrated analysis hooks may not depend on a freshly allocated `NormalizedHouseholdPlan` object reference; they must read stable selector outputs from the normalized analysis store.
- Analysis pages reuse a shared normalized snapshot per render and debounce expensive rerun triggers during continuous editing.
- Launch-size benchmark fixture: 2 adults, up to 3 dependents, 80-year horizon, representative goals/expense adjustments/property settings.
- Performance gate starting with PR 4B: launch-size compile p95 < 20ms in local benchmark/CI test harness, or a documented fallback plan is required before merging.

## Mandatory Legacy Field Coverage

- PR 2 mapping docs must enumerate every persisted key from `PROFILE_DATA_KEYS`, `INCOME_DATA_KEYS`, and `PROPERTY_DATA_KEYS` by exact field name; the category buckets below are coverage aids, not a substitute for the key-by-key contract.
- Personal and retirement identity: age, retirement age, life expectancy, life stage, marital/residency status.
- Income modeling: salary model, realistic phases, promotion jumps, taxable streams, life events, tax-relief inputs, and residency-transition fields such as `prMonths`.
- Spending and obligations: base expenses, expense adjustments, retirement spending adjustment, parent support, healthcare, retirement withdrawals, and financial goals.
- Assets and reserves: liquid net worth, locked assets, cash reserve settings, CPF balances/top-ups/withdrawals/fallback settings, CPF virtual rebalancing settings, `retirementMitigation`, and SRS settings.
- Property and household-specific obligations: ownership share, mortgage cash/CPF split, HDB monetization, downsizing, and shared vs private expense ownership.
- Mutation-time legacy couplings, including income-store actions that read profile-store age during tax-relief updates, must be identified in the mapping contract and preserved in the household-store action model.

## Acceptance Criteria

### Product

- A user can create an `individual`, `couple`, or `household` plan manually in Fireplanner.
- A user can model two adults with different retirement ages and see one household-level analysis.
- A user can add dependents as cost/timeline obligations without creating full retirement profiles for them.
- Manual plans and imported plans render through the same planner screens.
- Imported plans can be reviewed and locally edited without requiring live sync.

### Architecture

- All new household authoring flows use `HouseholdPlan` as the source model.
- All analysis flows use `NormalizedHouseholdPlan` as the compiled model.
- Authoring-derived analysis hooks read selector outputs from the normalized analysis slice keyed by household revision plus scenario override hash.
- No simulation code reads raw household UI objects directly.
- Existing individual mode can be represented through `fromLegacyIndividual()` without regressions to current planner behavior.
- Existing allocation/simulation/withdrawal stores remain compatible during migration.
- JSON import/export, saved scenarios, share URLs, migration-detection nudges, and Excel export remain compatible with legacy individual data throughout the rollout.
- The migration ledger covers every non-test consumer of `useProfileStore`, `useIncomeStore`, and `usePropertyStore` before legacy-store retirement begins.

### Quality

- Four representative individual fixtures (`salary-only`, `property-and-CPF`, `goals-and-life-events`, `pr-residency-transition`) retain parity after the compiled-path switch:
  - deterministic/projection currency deltas are <= S$1 per surfaced field
  - surfaced rate/percentage deltas are <= 0.1 percentage points
  - Monte Carlo parameter snapshots match structurally, with float deltas <= 1e-9 where exact equality is not practical
  - existing companion payload v2 fields that are not intentionally changed remain byte-for-byte identical
- Household compilation has dedicated unit tests covering timing resolution, ownership aggregation, retirement offsets, dependent cost phases, and portfolio adjustments.
- There is an end-to-end path for: create couple plan -> run analysis -> change one adult retirement age -> rerun -> observe changed household result.
- Pre-rollout JSON exports, saved scenarios, and share URLs still load into a valid individual plan during the mixed-mode migration period.

## Implementation Plan

### PR 1: Fix Current Phase 5 Companion Regression and Commit Stabilization

**Goal**

Stabilize the current companion work before starting the household rollout.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCompanionPlannerBridge.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/analysis/deterministicAssumptions.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCompanionPlannerBridge.test.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/docs/sgfireplanner-results-payload-v2.md`

**Tasks**

- Resolve scenario-specific deterministic return using the scenario retirement age, not the base profile retirement age.
- Add a regression test for glide-path-aware `required_savings_rate` under retirement-age override.
- Update the payload v2 doc example so `required_portfolio_basis` matches the current code (`wr_safe_90`).
- Commit only the intended companion changes and related tests/docs.

**Acceptance Criteria**

- Companion payloads use scenario-specific retirement age when deriving deterministic assumptions.
- Regression test covers glide-path + scenario retirement-age override.
- Payload docs no longer show `wr_safe_95` as the required portfolio basis example.

### PR 2: Add Household Domain Types, Mapping Contract, and Legacy Adapter

**Goal**

Add the new domain layer and an explicit parity contract without changing visible UX yet.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/types.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/normalized.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/fromLegacyIndividual.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/docs/household-field-mapping.md`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useProfileStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useIncomeStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/usePropertyStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/__tests__/fromLegacyIndividual.test.ts`

**Tasks**

- Define `HouseholdPlan`, `PlanningAdult`, `Dependent`, `IncomeSource`, `AssetItem`, `ExpenseItem`, `GoalItem`, `PropertyPlan`, and `HouseholdAssumptions`.
- Define `NormalizedHouseholdPlan` and supporting normalized types.
- Inventory every current non-test consumer of `useProfileStore`, `useIncomeStore`, and `usePropertyStore`, grouped into authoring UI, analysis/derived hooks, and portability/runtime helpers.
- Regenerate the appendix seed from a real non-test import grep over `useProfileStore`, `useIncomeStore`, and `usePropertyStore`, then append indirect route surfaces such as `DashboardPage` that render legacy-backed hooks/components without direct store imports.
- Write the field-mapping contract from legacy flat stores into `HouseholdPlan` / `NormalizedHouseholdPlan`, explicitly covering healthcare, cash reserves, locked assets, SRS, CPF fallback/rebalancing, retirement withdrawals, expense adjustments, financial goals, and property/HDB settings.
- Implement `fromLegacyIndividual()` to convert current `useProfileStore`, `useIncomeStore`, and `usePropertyStore` values into a 1-adult `HouseholdPlan`.
- Enumerate every field from `PROFILE_DATA_KEYS`, `INCOME_DATA_KEYS`, and `PROPERTY_DATA_KEYS` in the mapping contract, including `retirementMitigation`, `prMonths`, `cpfAutoFallback`, `cpfAutoFallbackIncludeSA`, `cpfVirtualRebalancing`, and `cpfVirtualRebalancingMode`.
- Document mutation-time couplings that are currently implicit across legacy stores, including `useIncomeStore.setReliefBreakdown()` reading `useProfileStore.getState().currentAge`, and define the equivalent household-store behavior.
- Add tests proving current individual state maps deterministically into the household model.
- Lock four representative parity fixtures (`salary-only`, `property-and-CPF`, `goals-and-life-events`, `pr-residency-transition`) for use in later regression gates.

**Acceptance Criteria**

- A valid `HouseholdPlan` can be created from the current single-person stores.
- The migration ledger covers every current non-test consumer of the legacy authoring stores.
- The mapping contract covers every persisted field currently owned by `useProfileStore`, `useIncomeStore`, and `usePropertyStore`, enumerated by exact key name.
- The adapter preserves existing individual semantics for income, expenses, CPF, goals, healthcare, cash reserves, SRS, locked assets, and property.
- The adapter and mapping contract preserve legacy mutation-time behaviors that affect calculated relief/tax totals.

### PR 3: Add Household Compiler

**Goal**

Compile `HouseholdPlan` into a single normalized timeline for all analysis paths.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/compileHouseholdPlan.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/timing.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/__tests__/compileHouseholdPlan.test.ts`

**Tasks**

- Resolve `TimingRule` objects into `yearOffset`s.
- Compute adult retirement offsets, CPF LIFE offsets, dependent support windows, and milestone rows.
- Aggregate `self`, `partner`, and `shared` entries into household-level yearly cashflow arrays.
- Produce normalized arrays for:
  - `annualSavingsByYear`
  - `postRetirementIncomeByYear`
  - `retirementExpenseBaseByYear`
  - `householdWithdrawalNeedByYear`
  - `portfolioAdjustments`
- Produce normalized healthcare and CPF projection inputs/outputs needed by downstream `useRiskAssessment` and `useCpfProjection` migrations, rather than leaving those hooks on raw legacy store reads.
- Emit warnings when imported/manual data is incomplete or ambiguous.

**Acceptance Criteria**

- Compiler tests cover:
  - staggered retirement ages
  - dependent cost phases
  - owner-scope aggregation
  - shared vs private expense handling
  - portfolio adjustments from goals, withdrawals, and asset unlocks
- Compiler output includes normalized healthcare and CPF projection slots so downstream analysis hooks do not require raw legacy authoring fields.
- No analysis code is required to inspect raw `HouseholdPlan` objects after compilation.

### Gate A: Lock Normalized Access Strategy Before PR 4A

**Goal**

Resolve the hook-memoization architecture before the analysis migration begins.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useProjection.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useIncomeProjection.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useMonteCarloWorkerQuery.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useBacktestQuery.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useAllocationStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useSimulationStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useWithdrawalStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useNormalizedAnalysisStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/docs/household-analysis-access.md`

**Tasks**

- Document the existing hook memoization constraints, including wide dependency-array patterns in projection, income, Monte Carlo, and backtest hooks.
- Lock the normalized access contract around a Zustand-backed `useNormalizedAnalysisStore` keyed by `householdRevision` plus `scenarioOverrideHash`.
- Define `householdRevision` concretely as a monotonic semantic-change token and specify how legacy authoring-store revisions roll up into it before PR 5.
- Define the selector surface for deterministic/projection, Monte Carlo, backtest, CPF, healthcare, and companion consumers.
- Define cache invalidation, scenario recompute, and CI parity-fixture wiring that PRs 4A through 4C will inherit.
- Define the revision-based run signature for `useMonteCarloWorkerQuery`, including how `householdRevision`, scenario hash, relevant global-config revision counters, and run overrides determine `isStale`.
- Explicitly assign `useMonteCarloWorkerQuery` ownership to PR 4B in the design doc and carry that ownership into the migration ledger.

**Acceptance Criteria**

- PR 4A may not begin until the normalized access doc names the store/slice, concrete `householdRevision` mechanism, invalidation keys, selector API, and scenario recompute rules.
- The chosen migration strategy does not rely on passing a freshly compiled `NormalizedHouseholdPlan` object through existing wide `useMemo` dependency arrays.

### PR 4A: Add Normalized Analysis Slice, Adapter, and Monte Carlo Parity Gate

**Goal**

Introduce normalized analysis inputs with the smallest possible blast radius.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useNormalizedAnalysisStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/toAnalysisInputs.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/simulation/monteCarloParams.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/__tests__/toAnalysisInputs.test.ts`
- new parity snapshot tests for representative fixtures

**Tasks**

- Implement `useNormalizedAnalysisStore` as the shared cache/slice for compiled household analysis state keyed by `householdRevision` plus `scenarioOverrideHash`.
- Cache the compiled `NormalizedHouseholdPlan` plus selector-friendly fragments for downstream hooks rather than passing a whole-object normalized plan through hook dependency arrays.
- Add an adapter that maps `NormalizedHouseholdPlan` into the parameter shape expected by Monte Carlo and related low-level analysis helpers.
- Update `buildMonteCarloEngineParams` to accept normalized analysis inputs, or add a parallel normalized builder and switch only Monte Carlo callers in this PR.
- Add snapshot/fixture coverage for the four locked representative individual plans.
- Make Monte Carlo parity snapshots CI-blocking from this PR onward.

**Acceptance Criteria**

- Monte Carlo parameter construction can be driven from normalized inputs without changing user-visible behavior.
- The normalized analysis slice exposes stable selector outputs for downstream hook migration.
- For the four locked representative fixtures, Monte Carlo parameter snapshots match structurally with float deltas <= 1e-9.
- CI blocks merges if Monte Carlo parity snapshots regress after PR 4A lands.

### PR 4B: Switch Derived Analysis Hooks to Normalized Inputs

**Goal**

Move derived hooks and projection plumbing onto normalized household inputs before page-level rewiring.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useAnalysisPortfolio.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useBacktestQuery.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCpfProjection.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useExplorePortfolio.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useFireCalculations.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useIncomeProjection.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useMonteCarloWorkerQuery.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useProjection.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useRiskAssessment.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useSequenceRiskQuery.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useWhatIfMetrics.ts`
- hook-level regression tests for normalized inputs

**Tasks**

- Switch derived analysis hooks that currently read legacy authoring fields directly to consume normalized-slice selectors or explicit compatibility adapters that terminate at the normalized slice.
- Update deterministic analysis and projection plumbing to use normalized savings, retirement timing, income timing, and portfolio-adjustment data instead of raw top-level authoring fields.
- Move `useMonteCarloWorkerQuery` onto normalized-slice selectors and migrate its `buildMonteCarloEngineParams` input path without regressing its rerun-signature behavior.
- Replace `useMonteCarloWorkerQuery`'s current serialized field blob with a revision-based run signature and add stale-flag regression tests proving planner-input changes mark results stale while unrelated UI-only changes do not.
- Move `useBacktestQuery` and `useExplorePortfolio` off legacy authoring reads onto normalized analysis inputs.
- Move `useRiskAssessment` and `useCpfProjection` onto the normalized healthcare/CPF projection slots produced in PR 3, or onto temporary adapters that are fed exclusively from the normalized analysis slice.
- Add deterministic/projection/sequence-risk parity snapshots for the four locked representative fixtures.
- Add the launch-size compile benchmark and fail the PR if the documented performance gate is missed without an approved fallback plan.

**Acceptance Criteria**

- `useAnalysisPortfolio`, `useBacktestQuery`, `useCpfProjection`, `useExplorePortfolio`, `useFireCalculations`, `useIncomeProjection`, `useMonteCarloWorkerQuery`, `useProjection`, `useRiskAssessment`, `useSequenceRiskQuery`, and `useWhatIfMetrics` operate on normalized inputs for authoring-derived data.
- For the four locked representative fixtures, deterministic/projection currency deltas are <= S$1 per surfaced field and surfaced rate deltas are <= 0.1 percentage points.
- Launch-size compile p95 is < 20ms in the benchmark harness, or an explicitly approved mitigation is recorded before merge.

### PR 4C: Switch Page-Level Consumers and Companion Payload

**Goal**

Complete the analysis cutover only after low-level adapters and hooks have parity gates in place.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/StressTestPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/ProjectionPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/WithdrawalPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/companion/resultsPayload.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCompanionPlannerBridge.ts`
- page-level regression/E2E tests for normalized analysis flows

**Tasks**

- Switch page-level consumers and scenario/action-impact flows to the normalized-hook outputs from PR 4B.
- Update companion payload generation to read from normalized plan values where needed.
- Add page-level smoke tests for projection, stress test, and withdrawal flows under normalized inputs.
- Make companion payload v2 regression exact-match CI-blocking except for fields intentionally changed in PR 1.

**Acceptance Criteria**

- `StressTestPage`, `ProjectionPage`, and `WithdrawalPage` consume normalized authoring-derived analysis data through the updated hooks.
- Companion payload generation continues to match existing v2 fields byte-for-byte unless a field is intentionally changed and documented.
- Monte Carlo, deterministic analysis, projection/sequence-risk inputs, and companion payload generation all share the same normalized household inputs by the end of PR 4C.

### PR 5: Add Household Authoring Store

**Goal**

Introduce the long-term authoring store and its initial migration bridge without changing all input pages yet.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useHouseholdPlanStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/validation.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/fromLegacyIndividual.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/__tests__/useHouseholdPlanStore.test.ts`

**Tasks**

- Implement CRUD actions for adults, dependents, incomes, assets, liabilities, expenses, goals, and property.
- Add validation rules for the household model.
- Persist household plans locally under a versioned store key.
- Support initializing the store from:
  - a blank manual household template
  - a converted legacy individual plan
- Add provenance metadata so downstream portability and import flows can distinguish manual vs imported household plans.

**Acceptance Criteria**

- Users can hold a complete household plan in one store object.
- Validation errors are scoped to household entities rather than legacy flat fields.
- A legacy individual plan can hydrate into a valid 1-adult household store snapshot without manual cleanup.

### PR 6: Add Persistence and Portability Bridge

**Goal**

Preserve saved plans and cross-device/share flows while the authoring model changes.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/storeRegistry.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/exportImport.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/exportExcel.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/scenarios.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/shareUrl.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/companion/companionBootstrap.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/companion/companionBridge.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/migrationDetector.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/toLegacyIndividual.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useUpdateNudges.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/layout/ScenarioManager.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useHouseholdPlanStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/main.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/storeRegistry.test.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/shareUrl.test.ts`

**Tasks**

- Introduce a versioned v2 persisted envelope for `useHouseholdPlanStore` as the only new portability contract. The v2 envelope contains canonical household authoring data, global analysis config (`allocation`, `simulation`, `withdrawal`), and provenance metadata.
- Add backward loaders that read existing v1 six-store payloads (local storage, JSON import, saved scenarios, share URLs) and materialize the v2 envelope at load/import time.
- Do not dual-write legacy keys.
- Keep pre-rollout JSON exports, saved scenarios, and share URLs loadable while the app is still switching surfaces from legacy stores to the household store.
- Update `companionBootstrap.ts` so companion sessions clear the household store key alongside the existing legacy keys before hydration, preventing stale household state bleed across sessions.
- Update `disableLocalStoragePersistence()` in `companionBridge.ts` so companion mode also no-ops persistence for `useHouseholdPlanStore` once it exists.
- Preserve the `migrationDetector.ts` module-load contract: v2 envelope registration and any import-order changes in `main.tsx` must still allow migration detection to capture pre-hydration versions before stores hydrate.
- Update migration-detection and update-nudge flows so they surface the correct household migration information.
- Move `ScenarioManager.tsx` to the v2 contract: saving/loading scenarios must include the household store, rehydrate the correct store set, and continue supporting legacy scenario upgrades during the mixed-mode window.
- Make Excel export work for both legacy-authored and household-authored plans during the migration window.
- Define the household Excel workbook contract before implementation:
  - legacy individual plans keep the current workbook structure
  - household plans export a `Household Summary` sheet, one `Adult - {name}` sheet per planning adult, a `Shared Household` sheet for shared expenses/goals/dependents, an `Allocation & Simulation` sheet, and a `Property` sheet when property data exists
  - owner-scope rows must be explicit in household exports rather than inferred from sheet names alone
- Keep `toLegacyIndividual()` only as a rollback/interoperability path for one-adult plans while legacy stores still exist through PR 12.

**Acceptance Criteria**

- A user with existing `fireplanner-profile` / `fireplanner-income` / `fireplanner-property` data can reload into a valid individual `HouseholdPlan` without manual intervention.
- A v1 six-store export/import/share payload upgrades into the v2 envelope without data loss for supported individual semantics.
- Pre-rollout JSON exports, saved scenarios, and share URLs remain loadable.
- No new code path introduced in PR 6 depends on dual-writing legacy keys.
- Excel export can emit the current plan regardless of whether it was authored through legacy or household flows.
- Companion bootstrap clears the household store key during companion startup, and `migrationDetector.ts` still captures version state before hydration.
- Companion mode disables persistence for the household store as well as the legacy/UI stores.
- Scenario save/load UI continues working for both legacy-backed and household-backed plans during the mixed-mode window.

### PR 7: Add Household Setup Flow

**Goal**

Create the entry path for `individual`, `couple`, and `household` plan creation.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/StartPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/router.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/layout/Sidebar.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/featureFlag.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useUIStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/PlanTypeSelector.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/HouseholdSetupWizard.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/PeopleRosterEditor.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/__tests__/HouseholdSetupWizard.test.tsx`

**Tasks**

- Add the `householdPlannerV1` runtime feature flag and keep it off by default until setup flow QA passes.
- Add plan type selection.
- Add manual setup for:
  - self
  - optional partner
  - dependents
- Keep existing route URLs stable and branch inside those routes by flag + plan type instead of creating a parallel household router tree.
- Add router/sidebar guards so household entry points are only visible when the flag is on.
- Define mixed-mode semantics for `useUIStore` toggles: `cpfEnabled`, `propertyEnabled`, and `healthcareEnabled` remain household-level section-availability toggles during migration, while person-specific applicability lives in `HouseholdPlan` data rather than per-adult UI booleans.
- Seed those toggles from actual plan data on legacy conversion, household setup, and import:
  - `cpfEnabled` is forced on when any adult has CPF balances, CPF contribution eligibility, CPF LIFE settings, or CPF-specific planning data
  - `propertyEnabled` is forced on when any property/mortgage/HDB/downsize data exists
  - `healthcareEnabled` is forced on when any adult or household healthcare config is present
- Hidden sections may not suppress existing migrated data; migration/setup must auto-enable any toggle required to surface already-present household data.
- Initialize `useHouseholdPlanStore` from setup selections.
- Preserve the current individual quick-start path.

**Acceptance Criteria**

- With `householdPlannerV1` off, Start, router, sidebar, and existing individual flows behave exactly as they do today.
- A user can create a couple plan manually without using Expense.
- A user can add dependents during setup.
- Current individual setup remains available.
- Household setup establishes unambiguous CPF/property/healthcare toggle semantics for the mixed-mode window.

### PR 8A: Prototype Household Component Adaptation and Mixed-Mode Editor Shell

**Goal**

Prove a viable adaptation path for complex legacy input components before broad household editor migration.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/InputsPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/DashboardPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/CpfSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/layout/SaveIndicator.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useSectionCompletion.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/adapters/useHouseholdCpfAdapter.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/__tests__/HouseholdCpfAdapter.test.tsx`

**Tasks**

- Add the household editing shell inside `InputsPage` for `couple` and `household` plans behind the feature flag, without yet migrating every section.
- Build the first working household adapter around `CpfSection`, including reads, writes, validation messages, and action-method bridging.
- Use the `CpfSection` spike to decide whether legacy sections can be wrapped with adapters or whether parallel household-native components are required for the rest of PR 8.
- Update `SaveIndicator` to report dirty state for both legacy and household authoring modes during the mixed-mode window.
- Migrate `useSectionCompletion` from single-person default comparisons to plan-type-aware household completion semantics, and update `DashboardPage` prompts to use those household-aware section states.
- Verify the prototype preserves CPF fallback, auto-fallback, virtual rebalancing, and age-sensitive relief behaviors.

**Acceptance Criteria**

- `CpfSection` works against household-backed data without direct legacy authoring-store reads.
- `SaveIndicator` reflects pending edits for both legacy and household authoring paths.
- `useSectionCompletion` and `DashboardPage` progress prompts remain meaningful for household plans instead of comparing against single-person defaults.
- PR 8B may not begin until the adaptation pattern is proven and documented from the `CpfSection` prototype.

### PR 8B: Build Household Editor Sections for People, Income, and Spending

**Goal**

Land the first broad household editing surface once the adaptation mechanism is proven.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/InputsPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/PeopleSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/IncomeSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/SpendingGoalsSection.tsx`
- reused seams from current inputs experience:
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/PersonalSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/SalaryModelSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/IncomeStreamsSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/LifeEventsSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/expenses/ExpenseLifeEventsSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/goals/GoalsSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/ParentSupportSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/healthcare/HealthcareSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/withdrawal/RetirementWithdrawalsPanel.tsx`

**Tasks**

- Define section responsibilities explicitly:
  - `PeopleSection`: household metadata, adult roster, dependent roster, retirement ages, and person-level labels used elsewhere.
  - `IncomeSection`: per-adult salary model, income streams, life events, tax-relief inputs, and SRS-related income settings.
  - `SpendingGoalsSection`: household/shared/private expenses, dependent cost phases, parent support, retirement withdrawals, healthcare, and financial goals.
- Reuse current component logic where the PR 8A prototype proved adapters viable; build household-native components where the prototype showed wrapper limits.
- Model adults separately and dependents as cost/timeline members only.
- Add owner-scope controls anywhere money can be private or shared, using explicit values (`self`, `partner`, `shared`) rather than implicit heuristics.
- Keep validation and inline help at the section level so users can see which member owns each invalid field.

**Acceptance Criteria**

- Household people, income, and spending/goals editing screens are fully usable without Expense import.
- Users can define two adults with separate retirement ages and ownership-scoped income/expense/goal items.
- No required launch-scope people, income, healthcare, parent-support, retirement-withdrawal, or goals field remains reachable only through legacy individual UI after PR 8B.

### PR 8C: Build Household Editor Sections for Assets, Property, and Assumptions

**Goal**

Close the remaining launch-scope authoring surface and field coverage.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/InputsPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/AssetsPropertySection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/AssumptionsSection.tsx`
- reused seams from current inputs experience:
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/FinancialSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/CashReserveSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/PropertyInputForm.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/HdbMonetizationSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/DownsizingScenarioForm.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/AssumptionsSection.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/allocation/AllocationBuilder.tsx`
  - `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/allocation/GlidePathSection.tsx`

**Tasks**

- Implement liquid assets/liabilities, locked assets, cash reserves, CPF balances/top-ups, property ownership, HDB monetization, downsizing, and analysis-global assumptions using the adapter or parallel-component path proven in PR 8A.
- Keep ownership semantics explicit for private vs shared assets, liabilities, and property settings.
- Close launch-scope field coverage so no required asset/property/assumption field remains stranded in legacy individual UI.
- Verify household assumptions continue to drive the normalized analysis slice without introducing mixed-source authoring reads.

**Acceptance Criteria**

- Household assets/property and assumptions editing screens are fully usable without Expense import.
- Users can define ownership-scoped assets/property data and analysis assumptions without falling back to legacy authoring screens.
- No required launch field is left only in legacy individual UI after PR 8C.

### PR 9: Build Household Analysis UI

**Goal**

Expose the household plan clearly in the analysis experience.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/StressTestPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/HouseholdOverviewBar.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/HouseholdMilestoneTimeline.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/HouseholdBreakdownPanel.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/companion/CompanionResultsSummary.tsx`

**Tasks**

- Add household identity and member chips to analysis pages.
- Add milestone timeline rendering from normalized milestones.
- Add expandable household/self/partner/shared breakdowns.
- Keep the top-line result household-level.

**Acceptance Criteria**

- Users can understand who the plan covers and why the result is what it is.
- Household-level analysis remains the primary answer.

### PR 10: Add Scenario Lab for Household Questions

**Goal**

Support realistic household what-if questions.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/scenarios.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/ScenarioLab.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/__tests__/scenarios.test.ts`

**Tasks**

- Add built-in household scenario cards:
  - self retires later
  - partner retires later
  - shared expenses down
  - one income stops
  - dependent costs end
  - de-risk allocation
- Allow custom scenario overrides against `HouseholdPlan`.
- Recompile normalized plans per scenario.
- Use immutable scenario-override helpers rather than shallow spread copies so nested arrays and objects cannot bleed scenario mutations back into the base plan.

**Acceptance Criteria**

- Household scenario comparisons are meaningful and tied to household structure.
- Scenario overrides do not mutate the base authored plan.

### PR 11: Add Expense Import and Review Flow

**Goal**

Bring Expense in as an optional prefill/review path after manual household mode is stable.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/household/fromExpenseImport.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/household/ImportedPlanReview.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/companion/types.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/companion/companionBridge.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCompanionPlannerBridge.ts`

**Tasks**

- Map imported Expense data into `HouseholdPlan`.
- Add an import review screen that highlights:
  - detected members
  - shared/private data usage
  - unsupported fields
  - local editability
- Mark imported plans with provenance metadata.

**Acceptance Criteria**

- Imported plans and manual plans render through the same household editor and analysis UI.
- Imported plans can be locally edited without implying sync-back or conflict handling.

### PR 12: Retire Legacy Authoring Stores

**Goal**

Finish the migration and simplify the architecture.

**Files**

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useProfileStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/useIncomeStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/stores/usePropertyStore.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/storeRegistry.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/exportImport.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/scenarios.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/shareUrl.ts`
- remaining files from `Appendix: Legacy Consumer Ledger Seed (snapshot 2026-03-07)`

**Tasks**

- Remove direct authoring dependencies on legacy profile/income/property stores.
- Keep legacy import/migration helpers only if needed for persisted individual plans.
- Remove temporary mixed-mode bridge code once all analysis, authoring, and portability paths read household-backed data.
- Make `useHouseholdPlanStore` the sole authoring source.
- Before PR 12 opens, replace the appendix reference in this section with the exact remaining ledger paths. PR 12 may not begin with a wildcard file list.
- Add a final static check that no non-test runtime import of `useProfileStore`, `useIncomeStore`, or `usePropertyStore` remains outside explicit migration helpers/tests.

**Acceptance Criteria**

- No non-test runtime import of `useProfileStore`, `useIncomeStore`, or `usePropertyStore` remains outside migration helpers/tests.
- The app no longer depends on separate flat stores for core plan authoring.
- Individual mode still works as a one-adult `HouseholdPlan`.

## Risks and Mitigations

- **Risk:** analysis drift between legacy individual mode and household-compiled individual mode.  
  **Mitigation:** add regression snapshots comparing legacy and compiled outputs for representative individual plans.

- **Risk:** UI migration becomes entangled with model migration.  
  **Mitigation:** land domain/compiler work before household UI work; keep adapters explicit.

- **Risk:** property/CPF logic becomes the hardest part of household support.  
  **Mitigation:** centralize it in `PlanningAdult.retirement` and `PropertyPlan`; do not spread split-ownership logic across UI components.

- **Risk:** saved-plan compatibility breaks during the mixed-mode rollout.  
  **Mitigation:** land the persistence/portability bridge before setup/editor migration, and regression-test JSON import/export, saved scenarios, share URLs, Excel export, and migration-detection nudges with pre-rollout fixtures.

- **Risk:** partial household UX leaks to production before the end-to-end flow is ready.  
  **Mitigation:** keep `householdPlannerV1` off by default until PR 7 setup QA passes, and add flag-off smoke tests for Start, router guards, sidebar navigation, Inputs, and analysis pages.

- **Risk:** household compilation becomes a render-time bottleneck on the Inputs or analysis pages.  
  **Mitigation:** memoize normalized compilation, benchmark the launch-size fixture, and block PR 4B if compile latency exceeds the agreed budget without an approved mitigation.

- **Risk:** Expense import introduces unsupported shapes too early.  
  **Mitigation:** ship import only after the manual household planner is complete and add a review layer for unsupported fields.

## Verification Steps

### Unit

- `fromLegacyIndividual` conversion tests
- legacy-to-household field-mapping coverage tests
- `compileHouseholdPlan` timing and aggregation tests
- normalized-to-analysis adapter tests
- household store validation tests
- store-registry / export-import / share-url compatibility tests
- scenario override tests

### Integration

- load pre-rollout local individual data -> hydrate household store -> run analysis
- create manual individual plan -> compile -> run analysis
- create manual couple plan -> compile -> run analysis
- update partner retirement age -> rerun -> changed household output
- add dependent cost phase -> rerun -> changed household output
- import pre-rollout JSON export -> run analysis
- load pre-rollout share URL -> run analysis

### E2E

- manual couple flow from setup to analysis
- returning individual user with saved local data lands in a valid household-backed plan
- imported household review flow
- companion/analysis path for a household-scoped plan

### Regression

- deterministic/projection parity for `salary-only`, `property-and-CPF`, `goals-and-life-events`, and `pr-residency-transition` fixtures with currency deltas <= S$1 and rate deltas <= 0.1 percentage points
- Monte Carlo parameter regression snapshots for those fixtures with structural equality and float deltas <= 1e-9
- sequence-risk and projection-input regression snapshots for those fixtures
- companion payload regression for existing v2 fields (exact match unless intentionally changed)
- pre-rollout JSON export / saved scenario / share URL fixtures continue to load
- final static grep check for zero non-test runtime imports of legacy authoring stores after PR 12

## PR Gate Matrix

- PR 2 cannot merge without the field-mapping contract, the initial grep-validated migration ledger snapshot, and the four locked representative fixtures committed.
- Gate A must complete before PR 4A starts, and it must choose the normalized analysis slice contract plus invalidation keys.
- PR 3 cannot merge without compiler unit coverage for timing/ownership cases and the initial compile benchmark for the launch-size fixture.
- PR 4A makes Monte Carlo parity snapshots CI-blocking and may not merge without the shared normalized analysis slice in place.
- PR 4B makes deterministic/projection/sequence-risk parity thresholds and the compile performance gate CI-blocking, and it must retire legacy authoring reads from `useMonteCarloWorkerQuery`, `useBacktestQuery`, `useExplorePortfolio`, `useRiskAssessment`, and `useCpfProjection`.
- PR 4C makes page-level smoke coverage plus companion payload exact-match regression CI-blocking.
- PR 6 cannot merge without v1-to-v2 portability tests covering local storage load, JSON import/export, saved scenarios, share URLs, migration-detection nudges, companion bootstrap clearing, and Excel export, plus import-order coverage for `migrationDetector.ts`.
- PR 7 cannot merge without flag-off smoke coverage proving the current individual UX is unchanged and mixed-mode `useUIStore` toggle semantics are implemented.
- PR 8A cannot merge without the `CpfSection` prototype and mixed-mode `SaveIndicator` coverage.
- PR 8B and PR 8C cannot merge without field coverage for their declared household editor sections.
- PR 10 cannot merge without mutation-safety tests proving scenario overrides do not alter the base `HouseholdPlan`.
- PR 12 cannot merge without the final ledger grep check reaching zero non-test runtime imports of legacy authoring stores.

## Recommended Execution Order

1. PR 1
2. PR 2
3. PR 3
4. Gate A
5. PR 4A
6. PR 4B
7. PR 4C
8. PR 5
9. PR 6
10. PR 7
11. PR 8A
12. PR 8B
13. PR 8C
14. PR 9
15. PR 10
16. PR 11
17. PR 12

## Parallelization Notes

- PR 9 (household analysis UI) and PR 10 (Scenario Lab) may run in parallel after PR 8C if they keep write scopes disjoint and both treat `HouseholdPlan` / `NormalizedHouseholdPlan` plus the normalized analysis slice contract as stable.
- PR 11 (Expense import/review) may overlap with the tail of PR 10 only after PR 9 has confirmed that the manual household editor and analysis surfaces are stable.

## Execution Sheet

### Operating Rules

- Work one gate/PR per branch. Do not mix adjacent plan units in the same branch.
- For units marked `autopilot`, run `autopilot` against that unit only, then use `git-master` to shape the final commits to the exact titles below if the raw diff is broader than intended.
- For units marked `direct`, implement without `autopilot`; the scope is either too small or too cleanup-heavy for full autonomous execution.
- Do not open the next branch until the current branch satisfies the gate for its unit in `PR Gate Matrix`.

### PR 1

Branch: `codex/pr-1-companion-phase5-regression`
Driver: `direct`
Commits:
1. `fix: use scenario retirement age in deterministic assumptions`
2. `test: cover glide-path required savings override`
Autopilot prompt: `Not recommended. PR 1 is too small; implement the fix and test directly on this branch.`

### PR 2

Branch: `codex/pr-2-household-domain-contract`
Driver: `autopilot`
Commits:
1. `feat: add household domain types and legacy adapter`
2. `chore: document household field mapping and ledger seed`
3. `test: lock legacy-to-household parity fixtures`
Autopilot prompt: `Implement PR 2 from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 2 files and acceptance criteria; regenerate the grep-validated ledger seed; enumerate every PROFILE_DATA_KEYS, INCOME_DATA_KEYS, and PROPERTY_DATA_KEYS field; preserve mutation-time legacy couplings; lock the four parity fixtures; do not take PR 3+ work. Target commits: feat, chore, test as listed in the execution sheet.`

### PR 3

Branch: `codex/pr-3-household-compiler`
Driver: `autopilot`
Commits:
1. `feat: add household compiler and timing resolution`
2. `test: cover normalized healthcare cpf and aggregation outputs`
Autopilot prompt: `Implement PR 3 from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 3 files and acceptance criteria; compile HouseholdPlan into normalized timelines; include healthcare and CPF projection slots; add the launch-size benchmark scaffold if needed for later gates; do not take Gate A or PR 4 work. Target commits: feat, test as listed in the execution sheet.`

### Gate A

Branch: `codex/gate-a-normalized-access-contract`
Driver: `autopilot`
Commits:
1. `refactor: add semantic revision counters for planner inputs`
2. `chore: document normalized analysis access contract`
Autopilot prompt: `Implement Gate A from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only Gate A files and acceptance criteria; define householdRevision as a monotonic semantic-change token; add the revision counters needed for legacy and global planner-input stores; document selector boundaries and stale-detection rules for useMonteCarloWorkerQuery; do not take PR 4A implementation work beyond what Gate A requires. Target commits: refactor, chore as listed in the execution sheet.`

### PR 4A

Branch: `codex/pr-4a-normalized-analysis-slice`
Driver: `autopilot`
Commits:
1. `feat: add normalized analysis store and monte carlo adapter`
2. `test: lock monte carlo parity snapshots`
Autopilot prompt: `Implement PR 4A from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 4A files and acceptance criteria; build the normalized analysis slice defined in Gate A; route Monte Carlo parameter construction through normalized inputs; lock parity snapshots for the four fixtures; do not take PR 4B or page-level rewiring. Target commits: feat, test as listed in the execution sheet.`

### PR 4B

Branch: `codex/pr-4b-normalized-hook-migration`
Driver: `autopilot`
Commits:
1. `refactor: move derived analysis hooks to normalized selectors`
2. `test: cover revision-based stale detection and analysis parity`
Autopilot prompt: `Implement PR 4B from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 4B files and acceptance criteria; migrate derived hooks to normalized-slice selectors; replace useMonteCarloWorkerQuery serialized signatures with revision-based stale detection; migrate backtest, explore portfolio, risk assessment, and CPF hooks; add deterministic, projection, and sequence-risk parity coverage for the four fixtures; do not take PR 4C page work. Target commits: refactor, test as listed in the execution sheet.`

### PR 4C

Branch: `codex/pr-4c-analysis-page-cutover`
Driver: `autopilot`
Commits:
1. `refactor: switch analysis pages and companion payload to normalized inputs`
2. `test: lock page smoke coverage and companion payload regressions`
Autopilot prompt: `Implement PR 4C from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 4C files and acceptance criteria; switch StressTestPage, ProjectionPage, WithdrawalPage, and companion payload generation to the normalized hook outputs from PR 4B; add page smoke coverage and companion payload regression coverage; do not take PR 5 store work. Target commits: refactor, test as listed in the execution sheet.`

### PR 5

Branch: `codex/pr-5-household-authoring-store`
Driver: `autopilot`
Commits:
1. `feat: add household authoring store and validation`
2. `test: cover legacy hydration into household store`
Autopilot prompt: `Implement PR 5 from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 5 files and acceptance criteria; add useHouseholdPlanStore CRUD, validation, provenance, and legacy initialization support; do not take PR 6 portability work. Target commits: feat, test as listed in the execution sheet.`

### PR 6

Branch: `codex/pr-6-v2-portability-bridge`
Driver: `autopilot`
Commits:
1. `feat: add v2 portability envelope and backward loaders`
2. `refactor: move scenarios companion and export flows to v2`
3. `test: cover portability migration and household excel export`
Autopilot prompt: `Implement PR 6 from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 6 files and acceptance criteria; add the v2 envelope and backward loaders; migrate ScenarioManager, scenarios storage, companion bootstrap, disableLocalStoragePersistence, share/import/export, migration detection, and Excel export to the v2 contract; keep no dual-write; do not take PR 7 setup UI work. Target commits: feat, refactor, test as listed in the execution sheet.`

### PR 7

Branch: `codex/pr-7-household-setup-flow`
Driver: `autopilot`
Commits:
1. `feat: add household setup flow and feature flag gating`
2. `test: cover toggle seeding and flag-off behavior`
Autopilot prompt: `Implement PR 7 from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 7 files and acceptance criteria; add the householdPlannerV1 setup flow, route and sidebar gating, and useUIStore toggle seeding from actual plan data; preserve the existing individual quick-start path when the flag is off; do not take PR 8 editor work. Target commits: feat, test as listed in the execution sheet.`

### PR 8A

Branch: `codex/pr-8a-household-cpf-prototype`
Driver: `autopilot`
Commits:
1. `feat: add household cpf adapter and editor shell`
2. `refactor: make save indicator and section completion household-aware`
3. `test: cover cpf adapter and mixed-mode dashboard prompts`
Autopilot prompt: `Implement PR 8A from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 8A files and acceptance criteria; add the household editor shell, prototype CpfSection adaptation, make SaveIndicator and useSectionCompletion household-aware, and keep DashboardPage prompts meaningful for household plans; do not take PR 8B or PR 8C section migrations. Target commits: feat, refactor, test as listed in the execution sheet.`

### PR 8B

Branch: `codex/pr-8b-household-people-income-spending`
Driver: `autopilot`
Commits:
1. `feat: add household people income and spending editors`
2. `test: cover ownership-scoped household editing`
Autopilot prompt: `Implement PR 8B from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 8B files and acceptance criteria; migrate people, income, and spending/goals editing with ownership-scope controls using the adaptation approach proven in PR 8A; do not take assets, property, or assumptions work from PR 8C. Target commits: feat, test as listed in the execution sheet.`

### PR 8C

Branch: `codex/pr-8c-household-assets-property-assumptions`
Driver: `autopilot`
Commits:
1. `feat: add household assets property and assumptions editors`
2. `test: cover shared ownership and assumptions editing`
Autopilot prompt: `Implement PR 8C from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 8C files and acceptance criteria; migrate assets, property, cash reserve, CPF balance, and assumptions editing using the PR 8A adaptation path; keep ownership semantics explicit; do not take PR 9 analysis UI work. Target commits: feat, test as listed in the execution sheet.`

### PR 9

Branch: `codex/pr-9-household-analysis-ui`
Driver: `autopilot`
Commits:
1. `feat: add household analysis overview and breakdown ui`
2. `test: cover household analysis presentation`
Autopilot prompt: `Implement PR 9 from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 9 files and acceptance criteria; add household analysis identity, milestones, and breakdown presentation; keep household-level analysis as the primary answer; do not take scenario lab or import work. Target commits: feat, test as listed in the execution sheet.`

### PR 10

Branch: `codex/pr-10-household-scenario-lab`
Driver: `autopilot`
Commits:
1. `feat: add household scenario lab`
2. `test: cover immutable household scenario overrides`
Autopilot prompt: `Implement PR 10 from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 10 files and acceptance criteria; add household scenario cards and custom overrides; guarantee immutable override application for nested arrays and objects; do not take PR 11 import work. Target commits: feat, test as listed in the execution sheet.`

### PR 11

Branch: `codex/pr-11-household-import-review`
Driver: `autopilot`
Commits:
1. `feat: add household import and review flow`
2. `test: cover imported household editability`
Autopilot prompt: `Implement PR 11 from /Users/tj/TJDevelopment/fireplanner/.omx/plans/2026-03-07-household-planner-rollout-plan.md. Scope: only PR 11 files and acceptance criteria; map Expense data into HouseholdPlan, add import review, preserve provenance, and keep imported plans locally editable; do not take PR 12 cleanup work. Target commits: feat, test as listed in the execution sheet.`

### PR 12

Branch: `codex/pr-12-retire-legacy-authoring`
Driver: `direct`
Commits:
1. `refactor: retire legacy authoring store runtime reads`
2. `test: enforce zero legacy authoring imports`
Autopilot prompt: `Not recommended. PR 12 is cleanup-heavy and grep-driven; execute directly so the final ledger and zero-import guarantee stay tightly controlled.`

## Appendix: Legacy Consumer Ledger Seed (snapshot 2026-03-07)

This appendix is the starting point for the migration ledger introduced in PR 2. Each PR that removes legacy-store reads must update the corresponding entries here until PR 12 drives the list to zero. The seed must be refreshed from a non-test import grep over `useProfileStore`, `useIncomeStore`, and `usePropertyStore`, then extended with route-level transitive consumers such as `DashboardPage`.

### Pages

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/DashboardPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/InputsPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/ProjectionPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/StartPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/StressTestPage.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/pages/WithdrawalPage.tsx`

### Hooks

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useAdjustedFireNumber.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useAnalysisPortfolio.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useBacktestQuery.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCashFlowChart.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCompanionPlannerBridge.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useCpfProjection.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useDashboardCharts.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useDashboardMetrics.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useDisruptionImpact.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useExplorePortfolio.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useFireCalculations.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useIncomeProjection.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useMonteCarloWorkerQuery.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useOneMoreYear.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/usePortfolioStats.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useProjection.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useRiskAssessment.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useSectionCompletion.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useSectionNudge.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useSequenceRiskQuery.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useWhatIfMetrics.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/hooks/useWithdrawalComparison.ts`

### Libs

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/companion/companionBridge.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/exportExcel.ts`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/lib/storeRegistry.ts`

### Components

- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/allocation/GlidePathSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/backtest/BacktestDrillDown.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/cpf/CpfAssumptionsPanel.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/cpf/CpfProjectionTable.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/dashboard/TimeCostPanel.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/dashboard/TrajectoryPanel.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/dashboard/WhatIfPanel.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/expenses/ExpenseLifeEventsSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/goals/GoalImpactSummary.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/goals/GoalTimelineChart.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/goals/GoalsSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/healthcare/HealthcareCostChart.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/healthcare/HealthcareSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/IncomeStreamsSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/LifeEventsSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/SalaryModelSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/SrsTaxPlanningCard.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/income/TaxReliefSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/layout/FireStatsStrip.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/layout/SaveIndicator.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/layout/ScenarioManager.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/AssumptionsSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/CashReserveSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/CpfSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/FinancialSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/FireTargetsSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/ParentSupportSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/profile/PersonalSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/proof/ProofComparePanel.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/DownsizingResultsPanel.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/DownsizingScenarioForm.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/HdbMonetizationSection.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/PropertyAnalysisPanel.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/property/PropertyInputForm.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/shared/WelcomeBanner.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/simulation/SimulationControls.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/stressTest/ActiveLifeEventsBar.tsx`
- `/Users/tj/TJDevelopment/fireplanner/frontend/src/components/withdrawal/RetirementWithdrawalsPanel.tsx`

## ADR

### Decision

Adopt `HouseholdPlan` as the canonical authoring model and `NormalizedHouseholdPlan` as the canonical analysis model for Fireplanner.

### Drivers

- Fireplanner must support standalone household planning.
- Expense import must be optional, not foundational.
- Household results must be explainable and trustworthy.
- The existing planner must remain live during the migration.

### Alternatives Considered

- Keep expanding the flat single-person stores: rejected because staggered retirement, dependents, and ownership semantics become increasingly ad hoc.
- Build a full finance-grade household domain in Fireplanner: rejected because it duplicates Expense and drags sync/collaboration semantics into the wrong repo.
- Pure aggregate household UX: rejected because it hides the people who materially affect the plan.

### Why Chosen

This approach gives a real household planner, preserves Fireplanner as a standalone product, and keeps Expense integration optional and structurally clean.

### Consequences

- There is a real migration cost.
- Analysis code becomes cleaner once it reads normalized plans rather than raw UI stores.
- Household UX can evolve without redesigning the simulation engine again.

### Follow-ups

- Lock the manual household UX before defining the final Expense import contract.
- Add a household companion-mode contract only after manual household planning is stable.
- Keep the portability contract versioned until legacy-store retirement is complete.
