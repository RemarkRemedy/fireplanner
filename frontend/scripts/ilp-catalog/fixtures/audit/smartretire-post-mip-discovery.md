# Manulife SmartRetire Later-Corridor Status

This note records the current source-backed status for:

- `manulife-smartretire-v-income`
- `manulife-smartretire-v-sum`

## Landed support

The first honest later-corridor SmartRetire slice is now landed.

The current platform/runtime now supports:

- mature finite policies through a dedicated current-only analysis mode
- manual `targetRetirementAge`
- manual `currentAmountOwing`
- reuse of `currentBasicSumAssured` as the accumulation-period floor input
- current-state death-benefit estimates across:
  - the MIP corridor
  - the post-MIP pre-retirement accumulation corridor
  - the post-target-retirement-age account-value-only corridor

## Published mechanics now covered

### SmartRetire Income

The current-state estimate now covers:

1. During MIP:
   - higher of `105% of total basic premium + top-up premium - withdrawals` or `account value`
   - less any `amount owing`
2. During accumulation period:
   - higher of `basic sum insured` or `account value`
   - less any `amount owing`
3. On or after Target Retirement Age:
   - `account value`
   - less any `amount owing`

### SmartRetire Sum

The current-state estimate now covers the same three phases:

1. During MIP:
   - higher of `105% of total basic premium + top-up premium - withdrawals` or `account value`
   - less any `amount owing`
2. During accumulation period:
   - higher of `basic sum insured` or `account value`
   - less any `amount owing`
3. On or after Target Retirement Age:
   - `account value`
   - less any `amount owing`

## Current modeled surface

The parser/runtime surface now supports:

- current-state death-benefit estimation across all three SmartRetire phases above
- administrative charge path
- MIP withdrawal and surrender charge schedule
- premium-shortfall charge before Flexi Start
- prevailing 0% top-up charge
- welcome bonus and loyalty bonus
- automatic lapse on account-value depletion
- distribution-mode assumption
- scheduled payout manual assumption for Income only

The remaining SmartRetire metadata-only tags are now narrowed to:

- `manulife-smartretire-v-income-claim-handling`
- `manulife-smartretire-v-sum-claim-handling`
- existing non-death-benefit residuals such as TPD waiver, COI refund, reinstatement, and fund admin behavior

## Remaining residual

The remaining SmartRetire gap is not another later-death-benefit formula slice.

It is the separate claim-side family:

- Waiver of Premium on TPD
- separate COI-on-WOP treatment
- refund-of-COI no-claim gating at target retirement age
- broader post-claim handling and settlement state

Those behaviors still require explicit claim-state semantics rather than another current-value floor extension.

## Recommendation

1. Treat the later SmartRetire death-benefit corridor as landed support on the current-only mature-finite surface.
2. Treat the remaining WOP-on-TPD, separate COI-on-WOP treatment, refund-of-COI no-claim gating, and broader claim settlement work as the separate SmartRetire claim-side family documented in `smartretire-claim-side-screen.md`.
3. Keep those claim-side mechanics metadata-only unless a dedicated claim-state surface is accepted.
4. Do not reopen the later-corridor formula lane unless a new current-summary surface beyond death-benefit estimation is added.
