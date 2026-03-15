# ILP Tokio Monthly Protection Charge Kernel Execution Spec

Last updated: 2026-03-16

## Goal

Add one bounded assurance-kernel extension for Tokio Marine ILPs whose Monthly Protection Charge (`MPC`) is:

- rate-table driven
- charged on a published Tokio sum-at-risk basis during a finite policy window
- deducted from a primary account with a published fallback account order
- economically material to fee drag and lapse pressure

This is not a full death-benefit kernel.

It is a reusable charge slice for Tokio products where the missing executable mechanic is the published MPC deduction path, not the whole payout contract.

## Why This Is Next

Parser throughput now converges on Tokio products that publish the same missing mechanic family:

1. `Harvest Builder@Future`
2. `Wealth Pro (II)`
3. `#goClassic Secure`

All three publish:

- an MPC charged only under selected death-benefit options
- annual rates by age and sex
- a deterministic sum-at-risk corridor
- a published deduction order from a primary investment account to a top-up account

The cheapest honest kernel proof target is `Harvest Builder@Future` because it does not add:

- locked-in value ratchets
- adjusted single-premium state
- accrued-first-three-years lump-sum MPC handling

## Mandatory Proof Product

### Primary proof parser

`tokio-marine-harvest-builder-atfuture`

Required proof corridor:

- `Basic Death Benefit` variant remains without MPC
- `Advanced Death Benefit` variant consumes the new kernel
- MPC applies only during the 10-year minimum investment period
- sum at risk is:
  - `max(0, midpointNetPremiumBase - 1.01 * midpointAccumulationValue)`
- primary deduction account is `accumulation`
- fallback deduction account is `topup`

## Structural Contract

A product belongs in this kernel extension only when all are true:

- the product publishes MPC or a materially equivalent monthly protection charge
- the charge uses a published age/sex rate table
- the published sum-at-risk corridor is source-complete
- the primary applicable-value scope is known
- the fallback deduction order is known
- the product can still be presented honestly as `partial` without claiming full death-benefit modeling

Examples in scope:

- age/sex rate tables where smoker and non-smoker share the same rates
- MIP-only MPC windows
- `net premium less 101% of accumulation account value` sum-at-risk bases
- primary-account deduction with top-up fallback

Examples out of scope:

- advanced-death payout simulation
- life-benefit-rider payout state
- accrued-first-three-years-then-lump-sum MPC timing
- locked-in policy value or ratchet mechanics
- adjusted single-premium state after withdrawals
- multi-life benefit selection state

## Keep vs Add

### Keep

Keep the current assurance runtime shape:

- `basis: 'assurance-sum-at-risk'`
- `assuranceConfig.formula`
- existing annualized assurance deduction path
- existing fallback deduction mechanics
- existing assurance profile fields for age / sex / smoker status and optional premium bases

### Add

Add the smallest reusable extension:

1. one new assurance formula family for Tokio MPC
2. one Tokio sex-only rate table parser/helper
3. one Tokio Harvest Builder@Future advanced-death proof parser corridor

Do not create a separate protection subsystem.

## Runtime Definition

For each active policy year:

1. confirm the assurance rule is active for the current window
2. compute midpoint applicable value from the configured `appliesTo` accounts
3. compute midpoint net premium base from:
   - starting regular premium base
   - regular premium paid this year
   - withdrawals from the applicable base
4. compute Tokio sum at risk:
   - `max(0, midpointNetPremiumBase - 1.01 * midpointApplicableValue)`
5. resolve the age/sex MPC rate from the authored Tokio rate table
   - the published Tokio Appendix A table is already monthly, so the existing annualized assurance path must use a monthly modal factor of `1`
6. annualize with the existing monthly-modal-factor path
7. deduct from the configured primary accounts, then `fallbackAppliesTo`

## Formula Family

### `tokio-mpc-net-premium-floor`

Published basis:

- `Net Premium paid ... less 101% of Accumulation Units Account value`
- zero when `101%` of the applicable value is greater than or equal to net premium

Behavior:

- uninterrupted regular premiums grow the protected base
- top-ups do not increase the base unless a future product source explicitly says they count
- withdrawals from the applicable account reduce the effective base through the existing midpoint paid-premium path
- the charge stays isolated from non-Tokio assurance families

## Rate Tables

Tokio proof products publish age/sex tables with the note:

- `Same MPC rate for non-smoker & smoker`

Implementation requirement:

- add a reusable parser/helper that maps a published male/female table onto all four runtime risk classes
- keep the existing `sex` and `smokerStatus` inputs unchanged so future Tokio tables with smoker differences can still fit

## Parser Authoring Rules

For proof products with selectable death-benefit options:

- do not silently force a single option onto the default variant
- split the authored product into explicit variants when needed
- only the variant whose published option actually levies MPC should consume the kernel

For `Harvest Builder@Future`:

- add `SGD / MIP 10 (Basic Death)` without MPC
- add `SGD / MIP 10 (Advanced Death)` with MPC

## Acceptance Criteria

This slice is complete only if all are true:

1. one normalized Tokio MPC evaluator exists inside the assurance runtime
2. one reusable sex-only Tokio rate table helper exists
3. direct calculator tests prove:
   - baseline Tokio sum-at-risk math
   - zero floor when `101%` of applicable value reaches net premium
   - fallback deduction from `topup` when `accumulation` is insufficient
   - no regression of existing assurance families
4. `Harvest Builder@Future` consumes the kernel in an explicit advanced-death variant
5. the basic-death variant remains without MPC
6. `npm run catalog:build` passes
7. `npm run catalog:family-classification` passes
8. `npm run type-check` passes
9. required vitest bundle passes
10. `npm run golden:check` passes

## Direct Calculator Proof Requirements

Minimum required tests:

1. Tokio baseline:
- regular-premium base exceeds `101%` of accumulation value
- charge equals published rate times Tokio sum at risk

2. Tokio zero floor:
- `101%` of applicable value is greater than or equal to net premium
- MPC is zero

3. Tokio fallback deduction:
- primary account has insufficient value
- remainder is deducted from `topup`

4. No regression:
- existing Prudential / HSBC / Manulife assurance tests stay green

## Follow-on Products After Kernel Commit

Once the kernel is green, likely next honest consumers are:

- `Wealth Pro (II)` for the same MIP-only Tokio MPC family
- `#goClassic Secure` after a separate accrued-first-three-years timing slice
