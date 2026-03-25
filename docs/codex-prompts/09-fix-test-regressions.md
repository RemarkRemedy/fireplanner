## Task: Fix 63 test failures after year-1 bonus reference year fix and stale-seed refresh

### Context
Two fixes were applied to the ILP engine and store:

1. **Year-1 bonus fix** (`ilp.ts:5060-5068`): Changed `getBonusReferenceYear()` to derive the reference year from the projected month window's end month (`getPolicyYearForMonth(context.range.endPolicyMonth)`) instead of the coarse `context.policyYear` (which was `currentPolicyYear + projectionYear`). This makes fresh seeds correctly credit first-policy-year bonuses.

2. **Stale seed refresh** (`refreshPersistedPolicy.ts`, `useIlpStore.ts`): Added auto-refresh of catalog-derived seed fields when `catalogSource.generatedAt` or `catalogVersion` changes on rehydration.

Both fixes are architecturally correct and their focused tests pass. But the full suite has 63 failures across 7 test files.

### Failed test files (7)

1. `src/lib/calculations/ilp.test.ts` — engine projection tests
2. `src/lib/calculations/ilpGoldenFixtures.ts` — golden fixture assertions
3. `src/lib/ilp-catalog/templateToPolicy.test.ts` — seed generation tests
4. `src/pages/IlpReviewPage.test.tsx` — catalog picker integration tests
5. `src/hooks/useNormalizedAnalysisParity.test.ts` — snapshot parity tests (6 snapshot mismatches)
6. `src/hooks/useMonteCarloParams.test.ts` — Monte Carlo param tests (3 failures)
7. `src/stores/useIlpStore.test.ts` — store tests (if any remaining)

### Failure categories

**Category 1: Golden fixture mismatches** (~1 test, large)
- `matches locked golden outputs for every declared fixture` — the year-1 fix shifts first-row bonus values for many products, invalidating golden fixtures
- Fix: regenerate golden fixtures with `npm run test:golden:update` (or equivalent command)

**Category 2: Seed generation tests** (~10 tests in templateToPolicy.test.ts)
- Tests that assert specific seed field values may fail because the schema now includes `generatedAt` in `catalogSource`
- Tests for Etiqa, Tokio, HSBC seeds that check exact structures
- Fix: update assertions to include the new `generatedAt` field

**Category 3: IlpReviewPage integration tests** (~20 tests)
- Catalog picker seed tests that assert exact warning text, charge descriptions, or seed structure
- Likely fail because templates now include `generatedAt` or because seeded bonus values changed
- Fix: update assertions

**Category 4: Engine projection tests** (~20 tests in ilp.test.ts)
- Tests that assert specific projection row values, lapse timing, payout blocking, bonus amounts
- The year-1 fix changes first-row bonus credits, which cascades into account values, lapse timing, etc.
- Fix: update expected values to match the corrected behavior (year-1 bonuses now credited)

**Category 5: Snapshot mismatches** (6 in useNormalizedAnalysisParity.test.ts)
- Deterministic/projection surface snapshots no longer match
- Fix: `npx vitest run src/hooks/useNormalizedAnalysisParity.test.ts --update` for snapshot files

**Category 6: Monte Carlo param tests** (3 in useMonteCarloParams.test.ts)
- Legacy param matching tests
- May need updated expected values

### Approach

1. **Start with golden fixtures** — update them first since many other tests may depend on correct golden baselines
2. **Update snapshots** — `npx vitest run src/hooks/useNormalizedAnalysisParity.test.ts --update` to regenerate
3. **Fix seed generation tests** — add `generatedAt` to expected catalogSource structures
4. **Fix IlpReviewPage tests** — update expected warning text and seed assertions
5. **Fix engine tests** — update expected projection values, being careful to verify the new values are CORRECT (year-1 bonuses should now appear)
6. **Run full suite** to confirm zero failures

### Important constraints

- Do NOT revert the year-1 bonus fix in `getBonusReferenceYear()` — the new behavior is correct
- Do NOT revert the stale-seed refresh — it is needed
- When updating expected values in engine tests, verify the new values make sense (year-1 bonuses credited, cascading into higher account values)
- Golden fixture regeneration may require a specific command — check package.json for a golden update script
- After fixing all tests, run the FULL suite: `npm run test -- --run`

### Acceptance criteria
- All 3809 tests pass (0 failures)
- No test logic was changed to weaken assertions — only expected values updated to match corrected behavior
- Golden fixtures regenerated and committed
- Snapshots updated and committed
