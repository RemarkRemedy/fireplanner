# ILP Tokio Locked-in Protection-State Kernel Execution Spec

Last updated: 2026-03-16

## Goal

Add one bounded assurance-kernel extension for Tokio Marine products whose Monthly Protection Charge (`MPC`) depends on a published protection state beyond simple paid-premium floors:

- a ratcheting `Locked-in Policy Value`
- an optional `Adjusted Single Premium` floor
- published proportional reductions after partial withdrawals
- published downgrade or disablement behavior when MPC can no longer be fully deducted

This is not a full death-benefit kernel.

It is a reusable protection-state slice for Tokio secure products whose missing executable mechanic is the source-backed protected-value state that feeds sum at risk.

## Why This Is Next

Parser throughput has now reached Tokio products whose remaining honest gap is the same repeated mechanic family:

1. `#goClassic Secure`
2. `#goElite Secure`

Both publish:

- a monthly high-water protected value
- protection-state reductions after partial withdrawals
- MPC charged on death-benefit-driven sum at risk
- indebtedness language for unpaid MPC

The current runtime already covers:

- assurance rate tables by age and sex
- accrued-then-settle timing
- permanent disablement after failed deduction
- published deduction-order routing

What it does not cover is the protected-value state that feeds Tokio secure sum at risk.

## Mandatory Proof Product

### Primary proof parser

`tokio-marine-goclassic-secure`

Required proof corridor:

- keep the existing `SGD / premium-payment-term-25` corridor as the basic-death variant without MPC
- add `SGD / premium-payment-term-25 (Advanced Death)` consuming the new kernel
- death benefit floor is based on:
  - `Locked-in Policy Value`
- valuation basis remains:
  - total policy value (`initial + accumulation`)
- deduction account remains:
  - `accumulation`
- years `1` to `2` accrue
- year `3` settles accrued MPC and current-year MPC
- if deduction still leaves unpaid MPC, future new MPC stops permanently while the unpaid carried balance remains collectible as indebtedness

### Immediate follow-on proof candidate

`tokio-marine-goelite-secure`

The same kernel should also fit the single-premium secure family by adding:

- `Adjusted Single Premium`
- valuation basis on the Single Premium Units Account
- top-up value remaining outside the locked-in floor but still relevant to published death-benefit wording

That widening is intentionally out of scope for this first proof slice unless it lands cheaply after `#goClassic Secure`.

## Structural Contract

Add one optional protected-state contract under `assuranceConfig`:

- `tokioProtectionState?: { ... }`

Minimum fields:

- `mode: 'locked-in-policy-value' | 'locked-in-policy-value-with-adjusted-single-premium'`
- `trackedValueAccountIds: string[]`
- `withdrawalReductionAccountIds: string[]`
- `minimumFloor: 'none' | 'account-value' | 'adjusted-single-premium'`

Add optional assurance-profile seed fields for products that start mid-stream:

- `currentLockedInPolicyValue?: number`
- `currentAdjustedSinglePremium?: number`

## Runtime Definition

For a Tokio assurance rule with `tokioProtectionState`:

1. Start each year from the carried protected state:
   - `lockedInPolicyValue`
   - optional `adjustedSinglePremium`
2. Compute the current year valuation scope from the configured tracked-value accounts.
3. Compute end-of-year protected state before MPC deduction:
   - ratchet `lockedInPolicyValue` to the higher of:
     - carried locked-in value after withdrawal reductions
     - open tracked value
     - provisional close tracked value
4. If the published product applies proportional withdrawal reductions:
   - reduce `lockedInPolicyValue` by:
     - `tracked value after withdrawal / tracked value before withdrawal`
   - and, when configured, reduce `adjustedSinglePremium` by the same ratio
5. Enforce the configured minimum floor:
   - none
   - account value
   - adjusted single premium
6. Compute sum at risk from the published secure-product corridor:
   - for locked-in-only products:
     - `max(0, max(lockedInPolicyValue, trackedValue) - indebtedness - trackedValue)`
   - for locked-in-plus-adjusted-single-premium products:
     - use the maximum published protected base before subtracting the valuation basis
7. Feed that sum at risk into the existing assurance-rate / accrual / disable-on-failed-deduction path.

## Published Approximation Boundary

The engine projects annually, while Tokio publishes monthiversary updates.

This kernel must therefore keep one explicit approximation boundary:

- annual runtime approximates the published monthiversary high-water state using the highest value visible at the current annual open/provisional-close boundary

That approximation is acceptable for this partial-support kernel as long as:

- it is documented in parser warnings
- the source-backed direction of the protected-value mechanics remains correct
- the product does not get promoted beyond the honest support boundary

## Keep vs Add

### Keep

- existing `assurance-sum-at-risk` basis
- existing Tokio MPC rate table support
- existing accrued MPC timing
- existing failed-deduction disablement
- existing primary/fallback deduction routing

### Add

- generic Tokio protected-state contract
- carried locked-in-value state across projection years
- optional carried adjusted-single-premium state
- proportional withdrawal reduction helper
- new secure-product sum-at-risk formulas
- direct calculator tests for the protected-state transitions

Do not add a full death-benefit payout engine in this slice.

## Validation Requirements

At catalog/template and runtime/seed layers:

- `tokioProtectionState` is optional
- it may only be used on `basis: 'assurance-sum-at-risk'`
- all configured tracked and withdrawal-reduction account ids must exist
- `currentLockedInPolicyValue` and `currentAdjustedSinglePremium` are optional non-negative manual inputs
- `currentAdjustedSinglePremium` is only required when the selected formula uses it

## Acceptance Criteria

This slice is complete only if all are true:

1. assurance rules can declare Tokio protected-state tracking
2. the calculator carries locked-in policy value across years
3. partial withdrawals proportionally reduce the protected state when authored
4. the secure sum-at-risk formula works with indebtedness carried by the existing accrued-charge path
5. `#goClassic Secure` consumes the kernel in an explicit advanced-death variant
6. the basic-death variant remains without MPC
7. direct calculator tests cover ratchet, withdrawal reduction, and disable-after-failed-deduction interaction
8. the full kernel gate is green

## Direct Calculator Proof Requirements

Minimum required tests:

1. locked-in-value ratchet raises the protected state when tracked value reaches a new high
2. partial withdrawal proportionally reduces the locked-in value
3. the secure Tokio sum-at-risk formula becomes zero when tracked value meets or exceeds the protected floor
4. failed deduction still disables future new MPC while leaving the unpaid remainder collectible
5. rules without Tokio protected-state config remain unchanged

## Non-goals

Do not add in this slice:

- full secure-product death-benefit payout simulation
- multiple-life sequencing
- change-of-life-assured administration
- aggregation-limit enforcement
- regular-withdrawal facility logic
- fund-switch administration
- single-premium secure-product top-up-inclusive death-benefit kernels beyond the protected-state contract

## Immediate Follow-ons After Kernel Commit

Once this kernel is green, return to parser throughput and continue with:

1. `#goElite Secure` if the adjusted-single-premium widening fits the same contract cleanly
2. any remaining Tokio secure product that publishes the same locked-in-value family
