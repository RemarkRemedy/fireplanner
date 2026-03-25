# Mature Finite Current-Only Analysis Contract

This note defines the smallest explicit contract for a mature finite-MIP "current snapshot only" mode.

It is the follow-on to:

- `finite-mip-current-snapshot-platform-discovery.md`
- `mature-finite-current-only-mode-screen.md`

## Goal

Allow a mature finite-MIP policy to remain editable, persist across reloads, and surface honest current-state metrics without pretending that projection, NPV, best-exit, or opportunity-cost outputs still exist.

## Recommended Contract

Use an explicit discriminated union, not optional fields sprinkled across `IlpPolicyAnalysis`.

## 1. Separate editing validity from analysis mode

Current problem:

- `ilpPolicySchema` is used for:
  - page validation
  - store hydration
  - catalog seeding acceptance
- mature finite policies currently fail that schema outright

Recommended split:

- `ilpEditablePolicySchema`
- `ilpProjectedAnalysisEligiblePolicySchema`

Meaning:

- mature finite policies may still be valid editable policies
- only pre-MIP finite policies and open-ended policies are eligible for full projected analysis

This is cleaner than treating mature finite policies as invalid drafts forever.

## 2. Introduce two explicit analysis result shapes

### Full projected analysis

Keep the current shape, but name it as one branch:

```ts
interface IlpProjectedPolicyAnalysis {
  mode: 'projected'
  policyId: string
  policyName: string
  insurer: string
  currency: IlpPolicyInput['currency']
  projections: Record<ReturnScenario, IlpProjectionResult>
  npvAnalysis: IlpNpvAnalysis
  opportunityCost: IlpOpportunityCost
  summary: IlpSummaryMetrics
}
```

### Current-only analysis

New branch:

```ts
interface IlpCurrentOnlyPolicyAnalysis {
  mode: 'current-only'
  reason: 'mature-finite-policy'
  policyId: string
  policyName: string
  insurer: string
  currency: IlpPolicyInput['currency']
  summary: IlpSummaryMetrics
}
```

Union:

```ts
type IlpPolicyAnalysis =
  | IlpProjectedPolicyAnalysis
  | IlpCurrentOnlyPolicyAnalysis
```

Key rule:

- only the `projected` branch may carry `projections`, `npvAnalysis`, and `opportunityCost`

## 3. Add a dedicated current-only analyzer

Recommended entry point:

```ts
function analyzeIlpPolicyCurrentOnly(input: IlpPolicyInput): IlpCurrentOnlyPolicyAnalysis
```

Scope:

- compute current-state summary metrics only
- reuse:
  - `computeInitialSinglePremiumState()`
  - `computeCurrentValueSnapshot()`
  - `computeCurrentDeathBenefitEstimate()`
  - `computeCurrentTiBenefitEstimate()`
- do not run:
  - `projectIlpPolicy()`
  - `computeNpvAnalysis()`
  - `computeOpportunityCost()`

## 4. Promote analysis mode selection into the analysis entry layer

Recommended helper:

```ts
function getIlpAnalysisMode(input: IlpPolicyInput): 'projected' | 'current-only'
```

Initial rule:

- open-ended policy: `projected`
- finite policy with `currentPolicyYear < mipLength`: `projected`
- finite policy with `currentPolicyYear >= mipLength`: `current-only`

Then:

```ts
function analyzeIlpPolicy(input: IlpPolicyInput): IlpPolicyAnalysis
```

would dispatch by mode instead of always projecting.

## 5. Keep full comparison and mixed comparison separate in the first slice

Do not try to force `buildComparisonTable()` to mix projected and current-only analyses on day one.

Recommended first-slice rule:

- only projected analyses enter the existing comparison table
- current-only analyses can still show per-policy summary cards
- if the selected policy is current-only, suppress comparison rows that depend on horizon or NPV

This avoids immediate churn in:

- `ComparisonTable`
- cross-policy highlighting logic
- mixed-mode semantics for "Projection Horizon", "Best Exit Year", and "Opportunity Cost"

## 6. First UI contract

For a selected mature finite current-only policy:

Show:

- `PolicyInputForm`
- `SummaryCards`
- a neutral alert explaining:
  - current-state metrics are available
  - projection, NPV, and opportunity-cost panels are intentionally unavailable for mature finite policies in V1

Hide:

- `FeeWaterfallChart`
- `DecisionPanel`
- `NpvTimelineChart`
- `ProjectionTable`
- `OpportunityCostCard`

Comparison handling in the first slice:

- if at least two projected policies exist, keep showing the existing comparison table for those projected policies only
- do not include current-only policies in that table yet

## 7. Suggested first implementation slice

The smallest honest implementation order is:

1. Split editable-policy validity from projected-analysis eligibility
2. Preserve mature finite policies through store hydration and page selection
3. Add `IlpCurrentOnlyPolicyAnalysis`
4. Add `analyzeIlpPolicyCurrentOnly()`
5. Branch `IlpReviewPage` so selected current-only policies show:
   - summary cards
   - current-only alert
   - no projection / NPV panels
6. Leave comparison mixed-mode support for a second slice

## Why This Is Better Than Optional NPV Fields

Making `npvAnalysis`, `opportunityCost`, and `projections` optional on one giant type would:

- leak mode checks across every analysis consumer
- make accidental partial rendering easier
- blur the difference between:
  - analysis unavailable because the policy is broken
  - analysis intentionally current-only because the policy is mature finite

The discriminated union keeps that boundary explicit.

## Recommendation

1. If the platform lane continues as code, implement this contract before any SmartRetire-specific formula work.
2. Keep the first slice single-policy and summary-first.
3. Defer mixed-mode comparison semantics until the current-only mode exists and is user-visible.
