# Plan: High-Priority Ignored Fields Fixes

## Context

`docs/todo-ignored-fields.md` documents 8 unresolved items where TypeScript fields are stored but never used in calculations. This plan covers the **4 high-priority items** that produce materially incorrect results:

1. Glide path ignored by simulations
2. Backtest missing `postRetirementIncome`
3. `residencyStatus` not affecting CPF contributions
4. `existingRentalIncome` vestigial field removal

---

## Item 1: Glide Path in Simulations

**Problem:** Deterministic projection applies age-based allocation shifting via `getWeightsAtAge()` (`projection.ts:118-136`), but MC, backtest, and sequence risk all use a single fixed `allocationWeights: number[]`.

**Approach:** Pre-compute `number[][]` (one weight vector per simulation year) in each hook. Pass to engines as optional `yearlyWeights`. Engines fall back to static `allocationWeights` when `yearlyWeights` is absent (backward-compatible).

### Step 1: Add helper to build yearly weights array
- **File:** `frontend/src/lib/calculations/portfolio.ts`
- Add `buildYearlyWeights(currentWeights, targetWeights, glidePathConfig, startAge, endAge): number[][]`
- Reuse existing `interpolateGlidePath()` from same file (line 156)
- For each year `i`, compute age = `startAge + i`, call `getWeightsAtAge()` logic (inline, since that function is in `projection.ts` and importing it would create a circular dep — replicate the 5-line interpolation logic using `interpolateGlidePath`)

### Step 2: Update engine param types
- **File:** `frontend/src/lib/simulation/monteCarlo.ts` — add `yearlyWeights?: number[][]` to `MonteCarloEngineParams`
- **File:** `frontend/src/lib/simulation/backtest.ts` — add `yearlyWeights?: number[][]` to `BacktestEngineParams`
- **File:** `frontend/src/lib/simulation/sequenceRisk.ts` — add `yearlyWeights?: number[][]` to `SequenceRiskEngineParams`

### Step 3: Update MC return generation functions
- **File:** `frontend/src/lib/simulation/monteCarlo.ts`
- `generateReturnsParametric()`: Change `weights: number[]` param to `weights: number[] | number[][]`. In the inner loop, resolve per-year weights: `const w = Array.isArray(weights[0]) ? (weights as number[][])[y] : weights as number[]`
- Same change for `generateReturnsBootstrap()` and `generateReturnsFatTail()`
- In `runMonteCarlo()`: if `yearlyWeights` exists, pass it to return generation and decumulation loop. During decumulation, use `yearlyWeights[accumYears + decumYear]` for portfolio return calculation

### Step 4: Update backtest engine
- **File:** `frontend/src/lib/simulation/backtest.ts`
- `getPortfolioReturns()`: Instead of a single dot product per historical year, accept optional `yearlyWeights`. When present, the return for window-year `y` uses `yearlyWeights[y]` instead of static weights. This means portfolio returns must be computed **per window** rather than once globally. Add a new inner function `getWindowReturn(historicalRow, yearInWindow, yearlyWeights, staticWeights)`.
- `runSingleWindow()`: Accept optional `yearlyWeights`, compute per-year portfolio returns inline
- `runDetailedWindow()`: Same change

### Step 5: Update sequence risk engine
- **File:** `frontend/src/lib/simulation/sequenceRisk.ts`
- `runSingleScenario()`: Use `yearlyWeights[t]` when available in the per-year return calculation

### Step 6: Update hooks to build and pass yearlyWeights
- **File:** `frontend/src/hooks/useMonteCarloQuery.ts`
  - Read `glidePathConfig`, `currentWeights`, `targetWeights` from `useAllocationStore`
  - If `glidePathConfig.enabled`, call `buildYearlyWeights(currentWeights, targetWeights, glidePathConfig, currentAge, lifeExpectancy)`
  - Pass as `yearlyWeights` in params
  - Add to `currentParamsSig` for stale detection
- **File:** `frontend/src/hooks/useBacktestQuery.ts`
  - If `glidePathConfig.enabled`, build yearlyWeights for retirement duration (ages: retirementAge → retirementAge + retirementDuration)
  - Pass as `yearlyWeights` in params
- **File:** `frontend/src/hooks/useSequenceRiskQuery.ts`
  - Same pattern: build yearlyWeights for retirement duration

### Tests
- **New file:** `frontend/src/lib/calculations/portfolio.test.ts` — test `buildYearlyWeights()` with linear/slowStart/fastStart methods
- **Update:** `frontend/src/lib/simulation/monteCarlo.test.ts` — test that MC with glide path produces different results than static weights
- **Update:** `frontend/src/lib/simulation/backtest.test.ts` — test that backtest respects yearlyWeights
- **Update:** `frontend/src/lib/simulation/sequenceRisk.test.ts` — test yearlyWeights integration

### Risks
- **Performance:** Backtest currently pre-computes all portfolio returns once. With per-window weights, returns must be computed per-window. For 70+ rolling windows × 30 years each, this is ~2100 dot products (vs 98 currently). Still very fast (< 1ms overhead).
- **Backward compatibility:** All changes are additive (`yearlyWeights?` is optional). Existing tests pass unchanged when `yearlyWeights` is not provided.

---

## Item 2: Backtest Missing `postRetirementIncome`

**Problem:** MC (`monteCarlo.ts:454`) and sequence risk (`sequenceRisk.ts:203`) subtract `postRetirementIncome[year]` from withdrawals. Backtest has no such parameter — survival rates are systematically too pessimistic.

**Approach:** Add `postRetirementIncome?: number[]` to `BacktestEngineParams`, subtract from withdrawal in the inner loop (matching MC/SR pattern), and compute it in the hook using the same projection-based logic as MC/SR.

### Step 1: Add parameter to engine
- **File:** `frontend/src/lib/simulation/backtest.ts`
- Add `postRetirementIncome?: number[]` to `BacktestEngineParams` (after `oneTimeWithdrawals`)
- In `runSingleWindow()` (line 147): add `postRetirementIncome` parameter. After computing `withdrawal` (line 198-208) and adding one-time withdrawals (line 211-214), add:
  ```typescript
  const income = postRetirementIncome?.[y] ?? 0
  withdrawal = Math.max(0, withdrawal - income)
  ```
- In `runDetailedWindow()` (line 269): same change — extract `postRetirementIncome` from params, apply income offset after withdrawal computation

### Step 2: Compute postRetirementIncome in hook
- **File:** `frontend/src/hooks/useBacktestQuery.ts`
- Add imports: `useIncomeStore`, `usePropertyStore`, `buildProjectionParams`, `getPropertyRentalIncome`, `sumPostRetirementIncome`, `getLifeEventExpenseImpact`, `getEffectiveExpenses`, `outstandingMortgageAtAge`, `calculateSellAndDownsize`, `calculateSellAndRent`, `calculateParentSupportAtAge`, `calculateHealthcareCostAtAge`
- In `buildParams()` (line 111): build `postRetirementIncome[]` using the **same pattern** as `useSequenceRiskQuery.ts:184-243` (iterate retired projection rows, call `sumPostRetirementIncome(row, rentalForYear)`, subtract mortgage/cpfOaShortfall/downsizingRent/lifeEventDelta)
- Note: backtest uses `retirementDuration` (a UI config, default 30) rather than `lifeExpectancy - retirementAge`. The postRetirementIncome array length should match retirementDuration. Pad with last value or 0 if projection is shorter.
- Add `postRetirementIncome` to returned params object
- Add income-affecting store values to `currentParamsSig` for stale detection

### Tests
- **Update:** `frontend/src/lib/simulation/backtest.test.ts` — add test: backtest with `postRetirementIncome` should have higher survival rate than without
- **Add test:** Verify `postRetirementIncome` correctly offsets withdrawal (e.g., $40K withdrawal - $10K income = $30K net withdrawal)

### Risks
- **Array length mismatch:** `retirementDuration` in backtest is user-configurable (default 30). Projection may produce fewer or more retirement years. Must handle with `postRetirementIncome?.[y] ?? 0`.
- **Historical inflation vs projected income:** Post-retirement income is computed in nominal terms from the projection. Backtest uses historical inflation. This is a minor inconsistency but acceptable — MC has the same nominal income assumption.

---

## Item 3: `residencyStatus` Not Affecting CPF Contributions

**Problem:** `calculateCpfContribution()` in `cpf.ts` takes `(annualSalary, age, annualBonus)` — no residency parameter. All users get full citizen CPF rates. Foreigners should get zero CPF. PRs in their first 2 years have graduated (lower) rates.

**Approach:** Add `prMonths` (months since obtaining PR) field to profile store, shown conditionally when `residencyStatus === 'pr'`. The income projection computes the effective CPF rate for each projection year by advancing `prMonths` forward. Foreigners get zero CPF.

### Step 1: Add PR graduated rate tables and foreigner zero-rate
- **File:** `frontend/src/lib/data/cpfRates.ts`
- Add `CPF_RATES_PR_YEAR1: CpfRateEntry[]` — PR 1st year graduated rates (per CPF Board F/G tables)
  - Under 55: Employee 5%, Employer 4%, Total 9%
  - 55-60: Employee 5%, Employer 4%, Total 9%
  - 60-65: Employee 3.75%, Employer 3.75%, Total 7.5%
  - 65-70: Employee 2.5%, Employer 2.5%, Total 5%
  - 70+: Employee 2.5%, Employer 2.5%, Total 5%
  - OA/SA/MA allocation rates sourced from CPF Board allocation PDF
- Add `CPF_RATES_PR_YEAR2: CpfRateEntry[]` — PR 2nd year graduated rates
  - Under 55: Employee 15%, Employer 9%, Total 24%
  - (higher-age brackets similarly graduated)
- Add `ZERO_RATE_ENTRY: CpfRateEntry` constant — all fields 0, for foreigners
- Add header comment with CPF Board source URL and download date

### Step 2: Update `getCpfRatesForAge()` to accept residency
- **File:** `frontend/src/lib/data/cpfRates.ts`
- Update signature: `getCpfRatesForAge(age, residencyStatus?, prMonths?)`
- Default `residencyStatus = 'citizen'`, `prMonths = 24` (backward-compatible)
- Logic:
  - `foreigner` → return `ZERO_RATE_ENTRY`
  - `pr` with `prMonths < 12` → look up `CPF_RATES_PR_YEAR1`
  - `pr` with `prMonths < 24` → look up `CPF_RATES_PR_YEAR2`
  - `pr` with `prMonths >= 24` or `citizen` → existing `CPF_RATES`

### Step 3: Update `calculateCpfContribution()`
- **File:** `frontend/src/lib/calculations/cpf.ts`
- Add optional params: `residencyStatus?: 'citizen' | 'pr' | 'foreigner'`, `prMonths?: number`
- Default: `residencyStatus = 'citizen'`, `prMonths = 24` (backward-compatible)
- Foreigner: early return with all zeros
- Pass residency and prMonths through to `getCpfRatesForAge(age, residencyStatus, prMonths)`
- Rest of calculation logic unchanged (OW ceiling, AW ceiling, allocation all work the same)

### Step 4: Add `prMonths` field to profile store
- **File:** `frontend/src/lib/types.ts` — add `prMonths: number` to `ProfileState`
- **File:** `frontend/src/stores/useProfileStore.ts`:
  - Add `prMonths: 24` to defaults (assume full rates by default)
  - Add to `PROFILE_DATA_KEYS`
  - Add validation: `prMonths >= 0 && prMonths <= 360`
  - Add migration for version bump: `state.prMonths = state.prMonths ?? 24`
- UI: conditionally show a "Months since obtaining PR" input when `residencyStatus === 'pr'`

### Step 5: Pass residency through income projection
- **File:** `frontend/src/lib/calculations/income.ts`
- `IncomeProjectionParams` already has `residencyStatus`. Add `prMonths?: number`.
- At call site (~line 550), pass both:
  ```typescript
  const effectivePrMonths = (params.prMonths ?? 24) + ((age - params.currentAge) * 12)
  const cpf = calculateCpfContribution(cpfApplicableSalary, age, annualBonus, params.residencyStatus, effectivePrMonths)
  ```
  This naturally graduates: a user who is 6 months into PR will use Year 1 rates now, Year 2 rates next year, and full rates after year 2.

### Step 6: Update `buildProjectionParams()` to pass `prMonths`
- **File:** `frontend/src/hooks/useIncomeProjection.ts`
- Add `prMonths: profile.prMonths` to the params object built in `buildProjectionParams()`

### Step 7: Update `projectCpfBalances()` in cpf.ts
- **File:** `frontend/src/lib/calculations/cpf.ts`
- `projectCpfBalances()` (~line 268) also calls `calculateCpfContribution`. Add optional residency/prMonths params and pass through.

### Tests
- **Update:** `frontend/src/lib/calculations/cpf.test.ts`:
  - Test foreigner: `calculateCpfContribution(100000, 30, 0, 'foreigner')` → all zeros
  - Test PR month 6: graduated Year 1 rates (9% total under 55)
  - Test PR month 18: graduated Year 2 rates (24% total under 55)
  - Test PR month 24+: full citizen rates (37% total under 55)
  - Test citizen (default, no extra args): unchanged behavior (backward-compat)
  - Test PR year progression: `prMonths=6` at age 30, by age 32 should use full rates
- **Property-based test (fast-check):** For all residency/prMonths combos: total >= 0, employee + employer ≈ total, OA + SA + MA ≈ total

### Risks
- **PR graduated rate data accuracy:** Exact OA/SA/MA allocation splits for PR graduated rates need sourcing from CPF Board allocation PDF. The employee/employer/total rates are well-documented; the per-account splits may need approximation with a comment noting the simplification.
- **Backward compatibility:** All new params are optional with defaults that produce existing behavior. Zero breakage for existing callers.

---

## Item 4: Remove Vestigial `existingRentalIncome`

**Problem:** `existingRentalIncome` exists in `PropertyState` but has no UI input and is never read. The UI directs users to add rental as an income stream. Confirmed zero consumers outside the store itself.

### Step 1: Remove from type
- **File:** `frontend/src/lib/types.ts` (line 864)
- Delete `existingRentalIncome: number` from `PropertyState`

### Step 2: Remove from store
- **File:** `frontend/src/stores/usePropertyStore.ts`
- Remove from `PROPERTY_DATA_KEYS` array (line 34)
- Remove from `DEFAULT_PROPERTY` (line 59)
- Remove validation check (lines 117-118)
- **Keep** v2 migration code (line 221) — old localStorage data may still have this field. The migration sets it, but since it's no longer in the type, just delete the migration line too. Zustand persist will simply ignore unknown fields during rehydration.

### Step 3: Update todo doc
- **File:** `docs/todo-ignored-fields.md` — move item 4 to "Fixed" section

### Tests
- Existing tests should pass (no tests reference this field since it was never consumed)
- Run `npm run type-check` to confirm no remaining references

### Risks
- **None.** Zero consumers confirmed. localStorage rehydration ignores unknown fields.

---

## Implementation Order

1. **Item 4** (vestigial field removal) — trivial, zero risk, quick win
2. **Item 2** (backtest postRetirementIncome) — medium scope, clear pattern to follow from MC/SR
3. **Item 3** (CPF residency) — medium scope, new data tables needed
4. **Item 1** (glide path) — largest scope, touches all 3 simulation engines

## Verification

After all changes:
```bash
cd frontend
npm run type-check   # Zero errors
npm run lint         # Clean
npm run test         # All green
npm run build        # Succeeds
```

Manual smoke test:
1. Set glide path enabled (80/20 → 40/60, ages 60-75), run MC → verify success rate differs from static weights
2. Add CPF LIFE income stream, run backtest → verify survival rate improves vs before
3. Set residencyStatus to 'foreigner', check income projection → verify zero CPF
4. Confirm no TypeScript errors referencing `existingRentalIncome`
