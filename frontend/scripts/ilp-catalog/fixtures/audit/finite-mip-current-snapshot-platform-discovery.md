# Finite-MIP Current-Snapshot Platform Discovery

This note records the code-level platform screen behind the blocked post-MIP / target-age lane for finite-MIP products such as:

- `manulife-smartretire-v-income`
- `manulife-smartretire-v-sum`

## Conclusion

The current blocker is not only "SmartRetire needs more fields".

The repo currently treats finite-MIP policies at or beyond the end of MIP as invalid analysis entries, and several analysis surfaces assume there is still a remaining MIP row to anchor against.

That means post-MIP current-state work is a broader platform decision with at least three coupled layers:

1. validation and store/page inclusion
2. projection and NPV execution
3. summary-metric anchoring

## Current Blocking Points

### 1. Validation excludes finite policies at or beyond MIP

`frontend/src/lib/validation/ilpSchema.ts`

The main policy schema rejects:

- finite policies where `currentPolicyYear >= mipLength`

Current message:

- `Current policy year must be less than MIP length. Mature policies are not supported in V1.`

Immediate consequence:

- `IlpReviewPage` marks those policies invalid via `ilpPolicySchema.safeParse`
- invalid policies are excluded from `analyzeAllPolicies`
- the seeded UI falls back to "showing analysis for another valid policy" instead of analyzing the selected finite post-MIP policy

Relevant call sites:

- `frontend/src/pages/IlpReviewPage.tsx`
- `frontend/src/stores/useIlpStore.ts`

### 2. Projection still throws for mature finite policies

`frontend/src/lib/calculations/ilp.ts`

`assertBeforeMip()` currently throws when:

- finite policy
- `currentPolicyYear >= mipLength`

That guard is used by:

- `projectIlpPolicy()`
- `computeNpvAnalysis()`

So even if the schema gate were lifted, analysis would still fail for mature finite policies unless the projection/NPV layer changes too.

### 3. Summary metrics assume a remaining MIP end row exists

`frontend/src/lib/calculations/ilp.ts`

`computeSummaryMetrics()` currently anchors:

- `totalPremiumsPaid`
- `totalFeesCharged`
- `totalBonusesReceived`
- `netFeeDrag`

to `projection.rows[getMipEndProjectionIndex(input)]`.

For finite policies, `getMipEndProjectionIndex()` throws when:

- `getRemainingMipYears(input) <= 0`

Current message:

- `Cannot resolve MIP end row for policy "...\" because it is already mature.`

This is broader than SmartRetire:

- the comparison table
- decision panel
- NPV timeline
- opportunity cost card

all depend on a full `analyzeIlpPolicy()` result, which in turn depends on the projection and summary metrics succeeding.

## What Already Exists

The current death-benefit kernel already contains a SmartRetire-specific branch in:

- `frontend/src/lib/calculations/ilp.ts`

That branch already computes the during-MIP protected-floor corridor for:

- `manulife-smartretire-v-income`
- `manulife-smartretire-v-sum`

But it explicitly returns `undefined` when:

- the policy is not finite, or
- `currentPolicyYear > mipLength`

So the code already acknowledges the family, but only within a pre-post-MIP boundary.

## Why A Small Gate Lift Would Be Misleading

Changing only the schema check or only `assertBeforeMip()` would not produce honest support.

If validation were widened alone:

- the policy would enter analysis
- projection / NPV would still throw

If projection were widened alone:

- summary metrics would still fail on `getMipEndProjectionIndex()`

If summary metrics were widened by reusing the projection end row:

- existing "to horizon" and "best exit" semantics would change for every finite mature policy
- the change would affect more than SmartRetire and would need an explicit product/UI decision

## Honest Platform Options

### Option 1: Full finite-post-MIP current analysis support

Admit finite policies at or beyond MIP into the main analysis pipeline.

This requires:

- validation changes
- projection / NPV changes
- summary-metric anchoring changes
- explicit product decisions for charts, best-exit scan, and fee totals when no remaining MIP corridor exists

This is the truest platform direction, but not a narrow mechanic slice.

### Option 2: Current-snapshot-only post-MIP surface

Keep full projection/NPV pre-MIP-only, but admit a narrower "current metrics only" path for mature finite policies.

This would require:

- a separate current-state analysis path
- page/UI behavior for missing projection/NPV charts
- a clear split between current snapshot support and full policy analysis support
- store/hydration support so mature finite policies are no longer dropped as schema-invalid

The narrower viability screen for this option is recorded in:

- `mature-finite-current-only-mode-screen.md`

This is narrower, but product-surface heavy.

### Option 3: Keep mature finite policies out of V1 analysis

Do not widen the platform yet.

Implication:

- SmartRetire post-MIP / target-age death-benefit work remains blocked
- later-corridor formulas stay metadata-only until the platform boundary changes

## Recommendation

1. Treat this as a platform lane, not as a SmartRetire formula lane.
2. Do not lift only the schema or only the projection guard.
3. Before any code change, decide whether mature finite policies should:
   - participate in full ILP analysis, or
   - use a narrower current-snapshot-only mode.
4. Until that decision is accepted, keep SmartRetire post-MIP / target-age corridors metadata-only.
