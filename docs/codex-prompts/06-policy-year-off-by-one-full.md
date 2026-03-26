## Task: Complete the policyYear off-by-one fix (partially applied)

### Current state

The fix is **partially applied** directly on `feat/ilp-fee-dashboard`. The branch
is currently in a broken state (119 test failures). Here is exactly what has and
hasn't been done.

### What was already done

#### 1. Engine fix (4 lines in `frontend/src/lib/calculations/ilp.ts`)

The engine had `policyYear = currentPolicyYear + projectionYear` which was 1 too
high. Three locations changed to `currentPolicyYear + projectionYear - 1`:
- Line ~2193 in `buildCashflowYearContext`
- Line ~2834 in the distribution payout function
- Line ~11127 in the main projection loop

Also `getRemainingMipYears` at line ~5782 changed from
`mipLength - currentPolicyYear` to `mipLength - currentPolicyYear + 1`.

#### 2. `ilp.test.ts` assertions fixed (849/849 passing)

An agent fixed all 74 failing assertions in
`frontend/src/lib/calculations/ilp.test.ts`. Changes were:
- policyYear values subtracted by 1
- Row counts increased by 1 (extra projection year)
- Row index offsets shifted
- NPV horizons grew by 1
- Cumulative totals updated for extra year

A commit was made at `6764bf2d`.

#### 3. Golden fixtures regenerated (406 JSON files)

All files in `frontend/src/lib/calculations/__fixtures__/ilp-golden/` were
regenerated via `generateFixtures.ts`. Each fixture has policyYear values shifted
by -1 and potentially 1 extra row.

#### 4. Leaderboard JSON rebuilt

`frontend/src/lib/data/generated/ilpLeaderboard.json` was regenerated via
`scripts/ilp-catalog/buildLeaderboard.ts` (219 rows).

#### 5. Vitest `.snap` snapshot files updated

Ran `npx vitest run --update` which updated 6 snapshots in:
- `src/hooks/useNormalizedAnalysisParity.test.ts` (3 snapshots)
- `src/lib/simulation/monteCarloParams.parity.test.ts` (3 snapshots)

#### 6. Parser audit completed (all 5 clean)

Spot-checked 5 parsers (AIA ESI 5 Pay, Tokio Marine Wealth Pro II, Manulife
InvestReady III, FWD Invest First Horizon, Singlife Legacy Invest). All use
PDF-sourced `startPolicyYear` values with no compensation for the bug. No parser
changes needed.

#### 7. Type-check passes

`npm run type-check` passes (there is a pre-existing type error about
`aia-venture-benefit-charge` formula type that is unrelated).

### What still needs to be done

#### 1. Fix `src/pages/IlpReviewPage.test.tsx` — 118 failures

These are catalog product seeding tests. Each test:
1. Seeds a product from the catalog via `addPolicyFromSeed`
2. Runs the engine via `analyzeAllPolicies`
3. Asserts specific values from the analysis output

The golden fixture JSON files are already correct (regenerated). The test
assertions contain hardcoded expected values that need updating:

- **`policyYear` values in arrays**: subtract 1 from each
- **Row counts / `rows.length`**: may increase by 1
- **Row index access `rows[N]`**: may need +1 offset
- **Summary metrics** (`totalFeesCharged`, `netFeeDragPercent`, etc.): may change
  slightly because the projection now has 1 extra year
- **`mipEndPolicyYear`**: subtract 1
- **NPV/opportunity cost values**: may shift due to extra projection year

Strategy: run the tests, look at the first 3-5 failure diffs to identify the
pattern, then apply systematically across all 118 tests.

#### 2. Fix `src/lib/calculations/ilp.golden.meta.test.ts` — 1 failure

Meta-test about golden fixture structure. Read the test, run it, see what
assertion fails, and fix it. Likely a row count or coverage check.

#### 3. Run full verification

After all fixes:
```bash
cd /Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard/frontend
npm run type-check
npm run lint
npx vitest run
```

Target: the only remaining failures should be pre-existing ones:
- `HouseholdEditors.test.tsx` — timeout failures (needs `testTimeout: 60000`,
  pre-existing)
- `sequenceRisk.test.ts` — 1 flaky test on "works with all 12 withdrawal
  strategies" (pre-existing)

#### 4. Spot-check AIA ESI 5 Pay bonus timing

This was the original bug that triggered the investigation. After all tests pass,
verify that the AIA Elite Secure Income 5 Pay Power-up Bonus now appears at:
- PY 10 (was incorrectly at PY 11)
- PY 15 (was missing entirely because projection was 1 year short)

Run:
```bash
cd /Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard/frontend
npx tsx --tsconfig tsconfig.app.json -e "
  const { getIlpCatalog } = require('./src/lib/ilp-catalog/getIlpCatalog');
  const { templateVariantToPolicySeed } = require('./src/lib/ilp-catalog/templateToPolicy');
  const { projectIlpPolicy } = require('./src/lib/calculations/ilp');
  const { ilpPolicySchema } = require('./src/lib/validation/ilpSchema');
  const catalog = getIlpCatalog();
  const product = catalog.products.find(p => p.id.includes('elite-secure-income-5-pay'));
  const seed = templateVariantToPolicySeed(product, product.variants[0], catalog.manifest);
  // build policy from seed, project, check bonus rows at PY 10 and PY 15
"
```
Or just look at the regenerated golden fixture for this product and verify
`bonusCredit > 0` at the rows with `policyYear: 10` and `policyYear: 15`.

### What NOT to change

- `ilp.ts` — engine is already fixed
- `ilp.test.ts` — already fixed (849/849 passing)
- Golden fixture JSON files — already regenerated
- `.snap` snapshot files — already updated
- Leaderboard JSON — already rebuilt
- Any parser files — audit confirmed all clean
- `HouseholdEditors.test.tsx` — pre-existing timeout, unrelated
- `sequenceRisk.test.ts` — pre-existing flaky test, unrelated

### Root cause reference

Full analysis is in `docs/codex-prompts/06-policy-year-off-by-one.md` which
documents the bug, the fix, all downstream consequences (A through F), and the
verification checklist.
