# Tokio Life-State Current-Only Analysis Contract

This note defines the smallest honest first implementation shape for the Tokio multi-life / life-assured lane.

It is intentionally narrower than full multi-life support.

## Goal

Add a current-only life-state surface that lets the calculator price current Tokio MPC corridors and current death-benefit summaries using the published oldest-life / youngest-life rules, without pretending to model historical change-of-life-assured events or projected multi-life claim sequencing.

## Why current-only first

The existing engine already has a clean current-summary seam:

- `computeCurrentDeathBenefitEstimate`
- current Tokio MPC rate lookup and max-age gating
- mature-finite `current-only` analysis mode

What it does not have is any representation of a life roster over time.

Trying to solve current and projected life-state together would immediately drag in:

- change-of-life-assured event history
- rider-term resets
- suicide / pre-existing-condition reset timing
- last-life claim sequencing over projected years

That is too large for the first slice.

## First-slice scope

Support only current-state roster summary, with no projected life events.

The first slice should allow:

1. current Tokio MPC rating on multi-life policies
   - use oldest life assured age / sex for MPC rate lookup
2. current Life Benefit Rider corridor gating on multi-life policies
   - use youngest life assured age for rider-expiry checks
3. current death-benefit summary wording for multi-life policies
   - interpret `Death Benefit Today` as the payout amount if the last covered life dies today

The first slice should not attempt:

- add / remove / change-of-life-assured event timelines
- projected oldest/youngest-life transitions
- historical exclusion resets from past life-assured changes
- staged death ordering before the last-life trigger

## Proposed data shape

Extend `assuranceProfile` with an explicit current life-state summary:

- `lifeAssuredMode: 'single-life' | 'multi-life'`
- `currentOldestLifeAgeNextBirthday?: number`
- `currentOldestLifeSex?: 'male' | 'female'`
- `currentYoungestLifeAgeNextBirthday?: number`

Keep the existing single-life fields:

- `currentAgeNextBirthday`
- `sex`
- `smokerStatus`

Interpretation rules:

- single-life mode keeps using `currentAgeNextBirthday` and `sex`
- multi-life mode uses:
  - `currentOldestLifeAgeNextBirthday` and `currentOldestLifeSex` for Tokio MPC rate lookup
  - `currentYoungestLifeAgeNextBirthday` for rider-expiry gating
- smoker status remains one shared manual input unless source wording proves mixed-smoker multi-life handling matters for a supported current-state corridor

## Kernel contract

Add a narrow helper layer rather than scattering conditionals:

- `resolveCurrentAssuranceRateAge(profile, rule)`
- `resolveCurrentAssuranceRateSex(profile, rule)`
- `resolveCurrentTokioMaxAge(profile, rule)`
- `isCurrentLastLifeSettlement(profile)`

Use those helpers only in current-state summary / current-state charge code first.

Do not change projected annual assurance accrual until a projected life-state design exists.

## UI contract

In the assurance-input section:

- keep the current single-life fields as default
- when a Tokio MPC corridor is present, allow switching between:
  - `Single life`
  - `Multiple lives (current summary only)`
- in multi-life mode, show:
  - `Current Oldest Life Age Next Birthday`
  - `Current Oldest Life Sex`
  - `Current Youngest Life Age Next Birthday`

Copy should be explicit that this is current-summary-only support.

## Summary-card contract

If current life-state mode is multi-life:

- keep `Death Benefit Today`
- change subtitle/tooltip wording to say the amount is interpreted as payout if the last covered life dies today

Do not add a second multi-life metric in the first slice.

## Catalog boundary contract

Do not remove all Tokio multi-life metadata tags at once.

Only narrow the residual wording where the source-backed current-only slice is actually covered:

- current MPC rating on oldest-life basis
- current rider max-age gating on youngest-life basis
- current death-benefit amount interpreted on a last-life basis

Keep metadata-only tags for:

- change-of-life-assured administration
- exclusion resets tied to change of life assured
- projected multi-life sequencing
- oldest/youngest-life recalculation after future roster changes

## First proof case

Use `tokio-marine-affluence-atfuture` as the first proof product.

Why this is the cleanest pilot:

- the same summary document publishes last-life settlement
- it also publishes oldest-life MPC rating
- and it publishes youngest-life rider-expiry wording for the Life Benefit Rider corridor

That makes it the best single parser to validate the whole current-only life-state contract before touching the wider Tokio family.

## Expected write set

The first implementation slice should be able to stay inside this write set:

- `frontend/src/lib/calculations/ilp.ts`
- `frontend/src/lib/validation/ilpSchema.ts`
- `frontend/src/components/ilp/PolicyInputForm.tsx`
- `frontend/src/components/ilp/SummaryCards.tsx`
- `frontend/src/pages/IlpReviewPage.test.tsx`
- `frontend/src/lib/calculations/ilp.test.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineAffluenceAtFuture.ts`
- `frontend/scripts/ilp-catalog/parsers/tokioMarineAffluenceAtFuture.test.ts`
- `frontend/src/lib/ilp-catalog/templateToPolicy.test.ts`
- generated catalog outputs if the parser boundary changes

## Exit condition

This first life-state slice is complete when:

1. current-only Tokio MPC inputs can represent multi-life oldest/youngest rules
2. current death-benefit summary wording is honest for last-life settlement
3. at least one Tokio advanced-death family is re-screened and narrowed from broader metadata wording to the smaller remaining residual
