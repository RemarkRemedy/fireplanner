# Codex Prompt: Fix templateToPolicy test assertions after sourceRefs passthrough

## Working tree

```
/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard
Branch: feat/ilp-fee-dashboard
```

## Context

Commit `a23da834` added `sourceRefs` and `notes` passthrough to `mapTemplateBonus` and
`mapEventChargeRules` in `frontend/src/lib/ilp-catalog/templateToPolicy.ts`. This causes
6 test failures in `frontend/src/lib/ilp-catalog/templateToPolicy.test.ts` because the
`toEqual` assertions don't include the new fields.

The failures are NOT bugs — the mapper correctly passes through `sourceRefs` and `notes`
from template data, but the test expectations were written before these fields existed.

## Failing tests (6 total, all in `templateToPolicy.test.ts`)

1. `maps PRUVantage Wealth II into a multi-account seeded ILP policy`
2. `maps GREAT Invest Advantage (SP) into an open-ended partial single-premium seed`
3. `maps #goWealth Enrich into an open-ended single-premium seed with original-base establishment and surrender charges`
4. `maps #goElite Secure cash into an open-ended single-premium seed with original-base establishment and surrender charges`
5. `maps FWD Invest Goal 1 SGD into an open-ended single-premium seed with original-base plan and surrender charges`
6. `preserves template charge allocation, event activeWindow, and rateSchedule-only fee rules`

## Root cause

The `toEqual` assertions in these tests use inline object literals for `chargeRules`,
`eventChargeRules`, and `bonuses`. After the mapper change, the output now includes:

- `sourceRefs: [...]` or `sourceRefs: undefined` — new field from template passthrough
- `notes: [...]` or `notes: undefined` — new field from template passthrough
- Various optional fields that now appear as `undefined` in the output (e.g.,
  `assuranceValueAppliesTo`, `yearBasis`, `suspensionRules`, etc.) because the
  mapper spreads the full object

## Task

1. Run the failing tests to see the exact diffs:
   ```bash
   cd frontend && npx vitest run src/lib/ilp-catalog/templateToPolicy.test.ts
   ```

2. For each failing test, update the `toEqual` assertion to match the actual output.
   The approach:
   - Add `sourceRefs` and `notes` fields to the expected objects where they appear
     in the actual output
   - Add any other `undefined` optional fields that now appear in the output
   - Do NOT change the mapper code — only update test expectations

3. Verify all tests pass:
   ```bash
   cd frontend && npx vitest run src/lib/ilp-catalog/templateToPolicy.test.ts
   ```

4. Run the full test suite to confirm no regressions:
   ```bash
   cd frontend && npm run test
   ```

## Key files

- `frontend/src/lib/ilp-catalog/templateToPolicy.test.ts` — the ONLY file to modify
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — the mapper (read-only, do NOT modify)

## Constraints

- Only modify the test file, never the source code
- The test expectations should match the actual mapper output exactly
- Do not use snapshot testing — keep the inline `toEqual` assertions
- Do not change test descriptions or test structure
