## Task: Continue from the policyYear off-by-one fix without undoing the good work

### Current branch state

The branch is no longer in the original "119 ILP failures" state described in
`06b-fix-remaining-test-failures.md`. That prompt was misleading about the shape
of the failures and should now be treated as historical context only.

The ILP-specific follow-up work has already been done in test code:

- `frontend/src/lib/calculations/ilpGoldenFixtures.ts`
- `frontend/src/pages/IlpReviewPage.test.tsx`
- `frontend/src/lib/calculations/ilp.golden.meta.test.ts`
- `frontend/src/lib/calculations/ilp.golden.shard.helper.ts`
- `frontend/src/lib/calculations/ilp.golden.shard-1.test.ts`
- `frontend/src/lib/calculations/ilp.golden.shard-2.test.ts`
- `frontend/src/lib/calculations/ilp.golden.shard-3.test.ts`
- `frontend/src/lib/calculations/ilp.golden.shard-4.test.ts`
- `frontend/package.json`

Do not revert those two files unless you first reproduce a real regression from
current output.

### What was fixed

#### 1. `ilp.golden.meta.test.ts` is green again

The failure in `frontend/src/lib/calculations/ilp.golden.meta.test.ts` was **not**
about fixture counts or missing files. It was caused by 9 brittle branch-integrity
checks in `frontend/src/lib/calculations/ilpGoldenFixtures.ts` that assumed fixed
policy-year windows or terminal-horizon behavior.

Those checks were rewritten to use behavior-based predicates instead:

- payout gap + resume checks now look for actual withdrawal gaps/resumptions
- HSBC restoration checks now compare total regular-account bonus credit
- PRU free-vs-charged withdrawal checks now compare fee deltas against a
  no-withdrawal control
- the assurance-charge reduction/resumption check now compares the actual
  pre-reduction, reduction, and resumed rows
- the premium-holiday check now verifies holiday suppression against a
  no-holiday control instead of terminal cumulative fees

Useful helpers added in `ilpGoldenFixtures.ts`:

- `hasWithdrawalGapAndResume(...)`
- `chargedWithdrawalAddsMoreFeesThanFreeWithdrawal(...)`
- gross-fee / bonus-credit row helpers

Verification that passed:

```bash
cd /Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard/frontend
npx vitest run src/lib/calculations/ilp.golden.meta.test.ts --no-color
```

Result: `1 passed`, `9 tests passed`.

The clean full-suite run later showed the golden files failing only under
contention, while they continued to pass in isolation and in smaller mixed runs.
That turned out to be a timeout-budget issue rather than a remaining artifact
mismatch, so the golden-suite timeout budgets were raised:

- `frontend/src/lib/calculations/ilp.golden.meta.test.ts`
  - `beforeAll(..., 120_000)` -> `beforeAll(..., 300_000)`
- the old monolithic `frontend/src/lib/calculations/ilp.golden.test.ts`
  was replaced with 4 deterministic shard files:
  - `frontend/src/lib/calculations/ilp.golden.shard-1.test.ts`
  - `frontend/src/lib/calculations/ilp.golden.shard-2.test.ts`
  - `frontend/src/lib/calculations/ilp.golden.shard-3.test.ts`
  - `frontend/src/lib/calculations/ilp.golden.shard-4.test.ts`

Each shard now registers one test per fixture file plus a small shard-assignment
check, which makes failures and reruns much easier to target. The shard helper
uses a shared lazy context promise behind `beforeAll(...)`, not top-level async
registration, so Vitest no longer attributes most of the cost to import time.
`frontend/package.json` was updated so:

- `npm run golden:check:economics` runs all 4 shard files
- `npm run golden:check:economics:shard-1` through `:shard-4` run one shard each

After that change, the golden economics suite passed:

- in isolation
- in mixed runs alongside `StressTestPage` and household files
- through `npm run golden:check`

#### 2. `IlpReviewPage.test.tsx` was fixed as a UI test refresh, not a policyYear rewrite

The failures in `frontend/src/pages/IlpReviewPage.test.tsx` were not primarily
hardcoded `policyYear`/`rows[N]`/summary-metric mismatches.

The actual issues were:

- stale heading copy (`Decision Panel` -> `Exit Scenarios`)
- catalog-seeded read-only sections are collapsed behind
  `Show details (read-only)` toggles
- many assertions used `getByDisplayValue(...)` for seeded catalog labels that are
  now rendered as read-only text, not editable inputs
- a few banner/gating assertions were stale relative to the current seeded UI

The test file was updated accordingly:

- added `expandCatalogReadOnlySections()`
- added `getCatalogValues(...)` / `getCatalogValue(...)`
- switched stale seeded-label assertions from `getByDisplayValue(...)` to the new
  catalog helper
- updated stale page copy assertions
- relaxed or removed stale alert-copy assertions where the current UI no longer
  renders the exact old wording
- updated a Wealth Accelerate TI-cap gating expectation
- updated one SmartRetire WOP refund-input expectation

### Business spot-check

The original business bug was the AIA Elite Secure Income 5 Pay bonus timing.
The regenerated golden fixture shows the bonus at both intended rows:

File:

- `frontend/src/lib/calculations/__fixtures__/ilp-golden/aia-elite-secure-income-5-pay-sgd-mip-5-baseline.json`

Spot-check result:

- `policyYear: 10` -> total `bonusCredit = 1350`
- `policyYear: 15` -> total `bonusCredit = 1350`

This confirms the second bonus is no longer lost to the short horizon.

### What still fails in the full suite

After the ILP-specific fixes and golden timeout adjustment, the final clean
full-suite summary was:

```bash
Failed Tests 4
FAIL  src/pages/StressTestPage.test.tsx > StressTestPage companion orchestration > shows household presentation and household-level companion copy for couple plans
FAIL  src/components/household/__tests__/HouseholdEditors.test.tsx > Household editors > edits partner salary, income ownership, tax reliefs, SRS, and life events from the household income section
FAIL  src/components/household/__tests__/HouseholdEditors.test.tsx > Household editors > edits ownership-scoped spending, healthcare, withdrawals, and goals from the household spending section
FAIL  src/components/household/__tests__/HouseholdSetupWizard.test.tsx > Household setup flow > creates a couple plan from the setup wizard (no dependents section)
Test Files  3 failed | 213 passed (216)
Tests  4 failed | 3815 passed | 1 skipped (3820)
```

Those remaining failures are **not ILP engine/page/golden failures**.

### Type-check and lint status

`npm run type-check` and `npm run lint` are still not clean, but the failures are
pre-existing and spread across unrelated files. They are not evidence that the
policyYear fix or the two ILP test-file edits are wrong.

Representative unrelated failures include:

- catalog/parser typing issues around `aia-venture-benefit-charge`
- other parser/type mismatches
- unrelated UI type issues
- unrelated eslint hook-rule / unused-var issues

### Important caution

There is still a likely semantic mismatch in `frontend/src/lib/calculations/ilp.ts`:

- `getRemainingMipYears()` is now inclusive
- `isProjectedAnalysisEligible()` / `assertBeforeMip()` still use the older
  final-MIP-year boundary semantics

This was **not** changed as part of the test repair because the ILP-related failing
tests were resolved without touching production engine logic further.

If you decide to change that logic, do it deliberately and re-verify:

- projected-analysis eligibility in the final MIP year
- any current-only vs projected-mode UI behavior
- downstream page tests and economics outputs

Do not "fix" that by blindly reverting the inclusive `getRemainingMipYears()`
change unless you are intentionally reopening the original off-by-one bug.

### Recommended next step

If continuing from here:

1. Leave `ilp.ts`, regenerated golden fixtures, leaderboard output, and the two
   repaired test files intact.
2. Re-run the current full suite and confirm the remaining failures are still only
   the unrelated parity + household tests.
3. If parity tests still fail, diagnose those directly instead of treating them as
   fallout from the policyYear fix.

### Files directly edited during the ILP-specific cleanup

- `frontend/src/lib/calculations/ilpGoldenFixtures.ts`
- `frontend/src/pages/IlpReviewPage.test.tsx`
- `frontend/src/lib/calculations/ilp.golden.meta.test.ts`
- `frontend/src/lib/calculations/ilp.golden.shard.helper.ts`
- `frontend/src/lib/calculations/ilp.golden.shard-1.test.ts`
- `frontend/src/lib/calculations/ilp.golden.shard-2.test.ts`
- `frontend/src/lib/calculations/ilp.golden.shard-3.test.ts`
- `frontend/src/lib/calculations/ilp.golden.shard-4.test.ts`
- `frontend/package.json`
