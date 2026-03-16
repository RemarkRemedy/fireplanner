# Code Review: feat/guided-setup-flow P1 (2026-03-16)

Reviewed files (last commit `54427fe5`):
- `frontend/src/lib/calculations/projection.ts`
- `frontend/src/lib/calculations/property.ts`
- `frontend/src/lib/calculations/propertyProjection.ts`
- `frontend/src/lib/household/applyFlowValues.ts`
- `frontend/src/lib/household/compileHouseholdPlan.ts`
- `frontend/src/lib/household/runtimeLegacyInputs.ts`
- `frontend/src/lib/household/seedFlowValues.ts`
- `frontend/src/lib/household/types.ts`
- `frontend/src/lib/simulation/monteCarloParams.ts`
- `frontend/src/lib/types.ts`
- `frontend/src/lib/calculations/property.test.ts`

## Agent 1 -- Code Architect

### CRITICAL
- C1: `toLegacyIndividual` does not apply `rentalExpensesPercent` netting (line 172) or `amountSaved` subtraction (line 81), creating divergence between single-adult and multi-adult code paths.

### WARNING
- W1: `as IncomeSource['timing']` type assertion bypasses discriminated union safety
- W2: `rentalExpensesPercent` netting is in adapter layer, not calculation layer

### INFO
- I1: `amountSaved` has no validation preventing > amount (clamped by Math.max)
- I2: `rentalExpensesPercent` has no schema-level bounds enforcement
- I3: Test coverage for proceedsAllocationPercent is good
- I4: New optional fields handle backward compat correctly

## Agent 2 -- Code Reviewer

### CRITICAL
- C1 (downgraded to WARNING): `toLegacyIndividual` `rentalYield` divergence is display-only since projection engine uses `getPropertyRentalIncome()` not `PropertyState.rentalYield`

### WARNING
- W1: `rentalExpensesPercent` may not affect actual income projections (engine uses HDB subletting, not rentalYield)
- W2: `salaryStopYear` "stop this year" silently skipped (> should be >=)
- W3: `as IncomeSource['timing']` cast hides type narrowing
- W4: `shortfall` correctly not scaled by `allocationPercent` (documented)
- W5: No validation on `salaryStopYear` field

### INFO
- I1: `Math.max(0, ...)` is correct for goal netting
- I2: Spread syntax is safe
- I3: Missing edge case test for `proceedsAllocationPercent = 0`
- I4: No unit tests for mapGoals netting, rentalExpensesPercent netting, salaryStopYear mapping

## Agent 3 -- Plan Compliance

All 4 Category 1 fields match spec. No CLAUDE.md violations.

### WARNING
- W1: Unused `bsd` variable in property.test.ts:146 (lint failure)
- W2: Missing tests for 3 of 4 field mappings
- W3: `proceedsAllocationPercent` does not scale shortfall (design choice, not bug)

### INFO
- Field naming divergence (downsizeProceedsPercent -> proceedsAllocationPercent) is justified
- Unmapped fields comment correctly updated

## Agent 4 -- Codex

(Timed out / still running at consolidation time)

## Agent 5 -- Gemini

### CRITICAL
- C1: Goal double-counting: if `amountSaved` is included in `liquidNetWorth`, netting it from the goal artificially inflates success rates
- C2: Non-HDB rental income completely lost (engine uses HDB subletting only)
- C3: `rentalExpensesPercent` ignored for HDB (uses `hdbSublettingRate` not `rentalYield`)

### WARNING
- W1: `salaryStopYear` edge case: "stop this year" skipped (> vs >=)

## Fixes Applied

| Finding | Fix |
|---------|-----|
| C1 (toLegacyIndividual divergence) | Added amountSaved netting in cloneGoal, rentalExpensesPercent netting in cloneProperty |
| C3 (goal double-counting) | Added tooltip explaining amountSaved is deducted from goal to avoid double-counting |
| W1 (type assertion) | Replaced `as` cast with explicit `age-range` timing construction |
| W2 (stop this year) | Changed `>` to `>=` in endAge guard |
| W3 (unused bsd) | Removed unused variable |
| W4 (missing tests) | Added 2 mapGoals netting tests + 4 salaryStopYear validation tests |
| W5 (no validation) | Added salaryStopYear validation (currentYear to currentYear+50) |

## Deferred

- C2 (rentalExpensesPercent no effect on projections): Pre-existing engine gap. Non-HDB rental income not modeled. Deferred to P3.
- Gemini C2/C3 (rental income path): Same root cause. Engine uses `getPropertyRentalIncome()` which only handles HDB subletting.
