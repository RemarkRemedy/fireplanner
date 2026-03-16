# ILP Assurance Failed-Deduction Disable Kernel Execution Spec

Last updated: 2026-03-16

## Goal

Add one bounded assurance-kernel extension for products whose assurance charge:

- is modeled as an `assurance-sum-at-risk` rule
- keeps any unpaid balance as indebtedness
- but permanently stops generating new charge once a published failed-deduction condition is hit

This is not a full death-benefit kernel.

It is a reusable assurance-state extension for products whose protection option is lost when the charge can no longer be fully deducted from the published primary account.

## Why This Is Next

Parser throughput has now reached Tokio products that are otherwise parser-ready on the current assurance kernel except for one repeated missing behavior:

1. `#goClassic`
2. `TM Atlas Wealth`

Both publish the same source-backed rule:

- Advanced Death MPC is deducted from the `Accumulation Units Account`
- if that account cannot fully fund MPC, the policy downgrades to `Basic Death Benefit`
- the advanced corridor cannot be reinstated
- the unpaid MPC remains as indebtedness and is deducted later when units become available

The current kernel already covers:

- Tokio net-premium floor sum-at-risk math
- age/sex Tokio rate tables
- accrued-then-settle timing
- assurance valuation accounts separate from deduction order
- carry-forward of unpaid assurance charge as accrued balance

The remaining blocker is narrower:

- stopping future assurance charge generation after a published failed deduction

## Mandatory Proof Product

### Primary proof parser

`tokio-marine-goclassic`

Required proof corridor:

- keep `SGD / premium-payment-term-25` as the basic-death variant without MPC
- add `SGD / premium-payment-term-25 (Advanced Death)` consuming the new failed-deduction-disable extension
- valuation basis uses policy value:
  - `initial + accumulation`
- deduction account is:
  - `accumulation`
- years `1` to `2` accrue
- year `3` settles accrued MPC and current-year MPC
- if deduction still leaves unpaid MPC, future Advanced Death MPC stops permanently while the unpaid carried balance remains collectible

### Immediate follow-on proof candidate

`tokio-marine-atlas-wealth`

The same kernel should also fit Atlas Wealth after the proof slice lands because it shares:

- policy-value valuation basis
- Accumulation-only deduction
- irreversible downgrade to Basic Death after failed MPC deduction

## Structural Contract

Add one optional assurance-state flag inside `assuranceConfig`:

- `disableFutureChargesOnInsufficientDeduction?: boolean`

Semantics:

- default is `false`
- when `true`, a year that leaves unpaid assurance charge after published deduction order:
  - keeps the unpaid remainder as carried accrued balance
  - marks the assurance rule as disabled for future new charge generation
- once disabled, the rule:
  - no longer computes new annualized assurance charge
  - still attempts to collect any carried accrued balance in later years

This models products where the advanced protection corridor is lost permanently after failed deduction without pretending to model the entire death-benefit payout.

## Runtime Definition

For an assurance rule with `disableFutureChargesOnInsufficientDeduction: true`:

1. compute the current policy year's assurance charge normally
2. add any carried accrued balance if the rule already has one
3. attempt deduction through the authored primary/fallback order
4. if unpaid remainder is zero:
   - continue normally next year
5. if unpaid remainder is greater than zero:
   - carry that remainder forward
   - mark the rule disabled for future new charges
6. in later years while disabled:
   - do not compute new assurance charge
   - attempt collection of the carried remainder only

For rules without the flag:

- behavior remains exactly unchanged

## Keep vs Add

### Keep

- existing `assurance-sum-at-risk` basis
- existing `tokio-mpc-net-premium-floor` formula
- existing assurance valuation-account support
- existing accrued-MPC timing support
- existing primary/fallback allocation logic
- existing age/sex rate-table lookup

### Add

- per-rule disabled state after published failed deduction
- optional assurance-config flag to activate it
- direct calculator tests proving:
  - failed deduction disables future new charge
  - carried unpaid balance still remains collectible

Do not create a separate death-benefit or locked-in-value subsystem in this slice.

## Validation Requirements

At catalog/template and runtime/seed layers:

- `disableFutureChargesOnInsufficientDeduction` is optional and boolean
- it may only be used on `basis: 'assurance-sum-at-risk'`
- no new user-entered fields are introduced

## Acceptance Criteria

This slice is complete only if all are true:

1. assurance rules can declare `disableFutureChargesOnInsufficientDeduction`
2. the calculator can disable future new charge generation per rule after a failed deduction
3. any unpaid balance still remains carried and collectible after disablement
4. rules without the flag remain unchanged
5. accrued Tokio MPC still works correctly when the disable flag is absent
6. `#goClassic` consumes the new extension in an explicit advanced-death variant
7. the basic-death variant remains without MPC
8. the full kernel gate is green

## Direct Calculator Proof Requirements

Minimum required tests:

1. a Tokio assurance rule with the disable flag accrues in years `1` to `2` and settles in year `3`
2. if year `3` cannot fully deduct MPC, the unpaid remainder is carried forward
3. after that failed deduction, later years do not generate new MPC
4. later years still collect the carried remainder when balance becomes available
5. rules without the disable flag still continue charging as before

## Non-goals

Do not add in this slice:

- full Basic Death vs Advanced Death payout simulation
- change-of-life-assured administration
- locked-in policy value or adjusted single premium state
- multiple-life sequencing
- TPD sum-at-risk kernels

## Immediate Follow-ons After Kernel Commit

Once this kernel is green, return to parser throughput and continue with:

1. `TM Atlas Wealth`
2. any other product that publishes irreversible assurance-option loss after failed MPC deduction
