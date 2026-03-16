# ILP Assurance Valuation Accounts Kernel Execution Spec

Last updated: 2026-03-16

## Goal

Add one bounded assurance-kernel extension that lets an assurance charge rule:

- calculate sum at risk from one published account set
- deduct the resulting charge from a different published account order

This is not a new assurance formula family.

It is a reusable account-scoping extension for existing `assurance-sum-at-risk` rules whose published valuation basis does not match their deduction order.

## Why This Is Next

Parser throughput has reached Tokio Marine products that are otherwise parser-ready but cannot be modeled honestly on the current kernel:

1. `#goLuxe`
2. `#goAffluence`

Both publish the same pattern:

- MPC applies only under an advanced-death corridor
- the sum at risk is based on net premium less `101%` of the Initial Units Account value and `101%` of the Accumulation Units Account value
- the actual deduction is taken from the Accumulation Units Account first
- if that is insufficient, the outstanding MPC is deducted from the Initial Units Account and/or Top-up Units Account

The current kernel couples those two concerns under `rule.appliesTo`, which makes either the valuation basis wrong or the deduction order wrong.

## Mandatory Proof Product

### Primary proof parser

`tokio-marine-goluxe`

Required proof corridor:

- keep `SGD / MIP 15` as the basic-death variant without MPC
- add `SGD / MIP 15 (Advanced Death)` consuming the new valuation-account extension
- use Initial + Accumulation for sum-at-risk valuation
- deduct from Accumulation first, then Initial and/or Top-up
- preserve the published accrual window:
  - policy years `1` to `3` accrue
  - policy year `4` settles the carried balance

## Structural Contract

Add an optional assurance-specific account list on charge rules:

- `assuranceValueAppliesTo?: string[]`

Semantics:

- if absent, assurance valuation uses `appliesTo`
- if present, assurance valuation uses `assuranceValueAppliesTo`
- deduction order remains:
  - primary `appliesTo`
  - then `fallbackAppliesTo`

This keeps the existing contract unchanged for already-modeled products while unlocking policies whose source splits valuation basis from deduction order.

## Runtime Definition

For each `assurance-sum-at-risk` rule:

1. resolve the valuation account set from:
   - `assuranceValueAppliesTo`, if present
   - otherwise `appliesTo`
2. compute open, provisional-close, midpoint value, and applicable withdrawals from that valuation account set
3. compute the assurance formula from those valuation balances
4. allocate the resulting charge through the published deduction order:
   - `appliesTo`
   - then `fallbackAppliesTo`

For rules without `assuranceValueAppliesTo`:

- behavior remains exactly unchanged

## Validation Requirements

At both catalog/template and runtime/seed layers:

- `assuranceValueAppliesTo`, if present, must be non-empty
- each account id must reference a valid account
- duplicate account ids should be rejected through existing unique-display-order resolution assumptions

Do not require `assuranceValueAppliesTo` to be a subset of `appliesTo`.
The whole point of the extension is to allow different valuation and deduction scopes.

## Keep vs Add

### Keep

- existing `assurance-sum-at-risk` basis
- existing assurance formulas, including Tokio MPC
- existing accrued-MPC timing extension
- existing primary/fallback charge allocation logic

### Add

- optional assurance valuation account set
- normalized runtime resolution of valuation accounts separate from deduction accounts
- direct calculator tests proving the new separation

## Acceptance Criteria

This slice is complete only if all are true:

1. charge rules can declare `assuranceValueAppliesTo`
2. the calculator values assurance from `assuranceValueAppliesTo` while still deducting through `appliesTo` and `fallbackAppliesTo`
3. rules without `assuranceValueAppliesTo` remain unchanged
4. the accrued Tokio MPC path still works with the new valuation-account extension
5. `#goLuxe` consumes the extension in an explicit advanced-death variant
6. the full kernel gate is green

## Direct Calculator Proof Requirements

Minimum required tests:

1. assurance sum at risk can use `initial + accumulation` while deduction still starts from `accumulation`
2. Tokio MPC fallback still reaches `initial` and/or `topup` after `accumulation`
3. rules without `assuranceValueAppliesTo` still behave exactly as before
4. accrued Tokio MPC still settles correctly when valuation accounts differ from deduction accounts

## Immediate Follow-ons After Kernel Commit

Once this kernel slice is green, return to parser throughput and continue with:

1. `#goAffluence`
2. any remaining Tokio advanced-death corridor that uses the same valuation/deduction split
