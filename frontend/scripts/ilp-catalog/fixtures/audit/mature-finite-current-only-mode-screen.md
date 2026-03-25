# Mature Finite Current-Only Mode Screen

This note answers the narrower platform question raised after the finite-MIP current-snapshot discovery:

Can the repo support a smaller "current snapshot only" mode for mature finite-MIP policies without first widening the full projection / NPV pipeline?

## Conclusion

Yes, but only as a distinct product mode with its own analysis shape and page behavior.

It is not a cheap kernel tweak.

The current app architecture assumes one analysis object that always includes:

- projections
- NPV analysis
- opportunity-cost analysis
- summary metrics

So a mature finite current-only path is viable only if the platform accepts a second, narrower analysis surface rather than trying to fake a full `IlpPolicyAnalysis`.

## Why It Is Not A Small Existing-Surface Patch

## 1. The store and hydration currently treat schema-invalid policies as disposable

`frontend/src/stores/useIlpStore.ts`

Persisted policies are reloaded through `ilpPolicySchema.safeParse`.

Current consequence:

- if mature finite policies remain schema-invalid, they are dropped during hydration
- that means a current-only mode cannot start as a page-level exception alone

So the platform must decide whether mature finite policies are:

- fully valid policies, or
- valid drafts under a second schema / mode

## 2. The page currently treats validity as a binary gate into the full analysis stack

`frontend/src/pages/IlpReviewPage.tsx`

Current flow:

- `ilpPolicySchema.safeParse(policy)` determines validity
- only valid policies enter `analyzeAllPolicies`
- invalid selected policies fall back to "showing analysis for another valid policy"

That means a current-only mode needs page-level semantics like:

- "current snapshot available"
- "full projection unavailable"

rather than today's single valid/invalid split.

## 3. The components expect a fully-populated `IlpPolicyAnalysis`

Current component dependencies:

- `SummaryCards` can work with summary metrics alone
- `ComparisonTable` currently mixes summary rows with NPV / horizon rows
- `FeeWaterfallChart` requires `analysis.npvAnalysis.holdToMip.finalValue`
- `DecisionPanel` requires `analysis.npvAnalysis`
- `NpvTimelineChart` requires `analysis.npvAnalysis.futureExitOptions`
- `ProjectionTable` requires `analysis.projections[...]` and `getMipEndProjectionIndex(policy)`
- `OpportunityCostCard` requires `analysis.opportunityCost`

Implication:

- a current-only mode cannot safely reuse the current page layout unchanged
- at minimum, several panels must be hidden or replaced

## What A Narrow Honest First Slice Would Look Like

The smallest honest current-only platform slice would be:

1. admit mature finite policies into editing/persistence
2. compute current-state summary metrics only
3. show only the panels that remain honest from current-state inputs

That likely means:

- keep `SummaryCards`
- optionally keep a reduced `ComparisonTable` limited to current-state rows
- hide `FeeWaterfallChart`
- hide `DecisionPanel`
- hide `NpvTimelineChart`
- hide `ProjectionTable`
- hide `OpportunityCostCard`

## Required Structural Decision

The repo needs one of these approaches before any implementation:

### Option 1: Separate mature-current analysis type

Add a second analysis result shape, for example:

- full projected analysis
- current-only mature analysis

Pros:

- honest
- explicit UI behavior
- avoids pretending NPV / projection data exists

Cons:

- broader page/component branching

### Option 2: Make large parts of `IlpPolicyAnalysis` optional

Pros:

- one top-level type

Cons:

- spreads optionality through almost every analysis consumer
- easier to accidentally render incomplete charts or decision surfaces

This looks worse than an explicit second mode.

## Recommendation

1. If the lane reopens as code, do not start by relaxing only the schema gate.
2. Prefer an explicit second mode:
   - full projected analysis
   - mature finite current-only analysis
   - see `mature-finite-current-only-analysis-contract.md` for the smallest explicit contract
3. In the first mature-current slice, limit the UI to current-state metrics and clearly suppress projection / NPV surfaces.
4. Only after that mode exists should SmartRetire post-MIP / target-age formulas be reconsidered as executable support.
