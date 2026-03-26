## Task: Fix remaining test failures after policyYear off-by-one engine fix

### Context

The ILP projection engine in `frontend/src/lib/calculations/ilp.ts` was fixed:

1. `policyYear = currentPolicyYear + projectionYear - 1` (was `+ projectionYear`)
2. `getRemainingMipYears = mipLength - currentPolicyYear + 1` (was without `+ 1`)

This shifts all `policyYear` values down by 1 and adds 1 extra projection year
for finite-MIP policies.

### Already done

- Engine fix (4 lines in `ilp.ts`)
- `ilp.test.ts` assertions fixed (849/849 passing)
- Golden fixtures regenerated (406 JSON files in `__fixtures__/ilp-golden/`)
- Vitest `.snap` snapshot files updated
- Leaderboard JSON rebuilt

### Remaining failures

Run:
```bash
cd /Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard/frontend
npx vitest run --no-color 2>&1 | grep -E "❯.*failed"
```

Expected output (119 failures across 2 files):

1. **`src/pages/IlpReviewPage.test.tsx`** — 118 failures
2. **`src/lib/calculations/ilp.golden.meta.test.ts`** — 1 failure

### How to fix

#### `IlpReviewPage.test.tsx` (118 failures)

These are catalog product seeding tests. Each test:
1. Seeds a product from the catalog via `addPolicyFromSeed`
2. Runs the engine via `analyzeAllPolicies`
3. Asserts specific values from the analysis output

The golden fixture JSON files are already regenerated with correct values. The test
assertions contain hardcoded expected values that need updating:

- **`policyYear` values**: subtract 1 from each
- **Row counts / `rows.length`**: may increase by 1 (extra projection year)
- **Row index access `rows[N]`**: may need +1 offset if accessing by position
- **Summary metrics** (`totalFeesCharged`, `netFeeDragPercent`, etc.): may change
  slightly because the projection now has 1 extra year
- **`mipEndPolicyYear`**: subtract 1
- **NPV/opportunity cost values**: may shift due to extra projection year

Strategy: run the tests, look at the first 3-5 failure diffs to identify the
pattern, then apply the same pattern across all 118 tests. Most will be mechanical.

#### `ilp.golden.meta.test.ts` (1 failure)

This is a meta-test about golden fixture coverage/structure. Read the test, run it,
see what assertion fails, and fix it. Likely a row count or fixture count check.

### Pre-existing failures to IGNORE

- **`src/components/household/__tests__/HouseholdEditors.test.tsx`** — timeout
  failures (pre-existing, unrelated). These tests need `testTimeout: 60000`. Do
  NOT fix these.
- **`src/lib/simulation/sequenceRisk.test.ts`** — 1 flaky failure on "works with
  all 12 withdrawal strategies" (pre-existing, unrelated).

### Verification

After fixing, run the full suite:
```bash
cd /Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard/frontend
npx vitest run --no-color 2>&1 | grep -E "Test Files|Tests "
```

Target: the only failures should be the pre-existing ones listed above (household
timeouts, possibly the flaky sequenceRisk test). All ILP-related tests must pass.

### What NOT to change

- Do not modify `ilp.ts` (engine is already fixed)
- Do not modify `ilp.test.ts` (already fixed, 849/849 passing)
- Do not regenerate golden fixtures (already done)
- Do not update `.snap` files (already done)
- Do not fix the household timeout or sequenceRisk flaky test
