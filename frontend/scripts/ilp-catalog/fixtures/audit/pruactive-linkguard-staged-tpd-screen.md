# PRUActive LinkGuard Staged TPD Screen

This note records the next-lane screen for:

- `prudential-pruactive-linkguard`

## Conclusion

`PRUActive LinkGuard` now has an honest current-only staged `TPD Benefit Today` slice on the current surface.

The summary is explicit enough to rule out a parser-only or one-field extension:

- TPD before age 50 uses the Multiplier benefit
- TPD on or after age 50 depends on whether the Multiplier benefit was retained
- if TPD sum assured matches death benefit, account value is also paid and the policy ends
- only the first `$2,000,000` of TPD sum assured is payable after the deferment period
- any TPD amount above `$2,000,000` is paid later:
  - `12 months` after the first lump-sum payment, or
  - on death,
  whichever happens first
- if disability ceases before the balance payment falls due, the balance stops
- if TPD sum assured is lower than death benefit, the policy continues with reduced death cover

That is a real staged-claim branch, not a current-value shortcut.

## Landed Surface

The current runtime now carries the dedicated claim-state needed for a payable-now TPD snapshot:

- `currentTpdSettlementMode`
- `currentTpdPayoutStage`
- `currentTpdRemainingBalance`

That supports two honest current-only cases:

- the initial payable lump sum, computed from the published TPD sum assured corridor and the fixed `$2,000,000` first-payment threshold
- the later balance lump sum, entered manually as the currently payable remaining balance

This keeps the calculator current-only:

- it does not project future balance release
- it does not attempt to predict whether disability will cease before the later payment date
- it does not model broader post-claim continuation

## Why The Old Current Surface Was Not Enough

The current support surface already carries:

- `currentSumAssured`
- `currentAmountOwing`
- `currentRetainedMultiplierStatus`
- `currentAcceleratedTiPayoutMode`

That is enough for:

- current death snapshot
- current TI snapshot
- assurance-charge sum-at-risk

It is not enough for current TPD payable-now, because the summary requires claim-stage state that is not represented anywhere in the runtime.

## Missing Claim-State Inputs

At minimum, an honest staged-TPD snapshot would need a dedicated claim-state surface with values like:

- `currentTpdSettlementMode`
  - whether the current TPD sum assured still matches death, or is lower than death
- `currentTpdPayoutStage`
  - not yet payable
  - first lump-sum payable now
  - balance lump-sum payable now
- `currentTpdRemainingBalance`
  - the unpaid balance after the first lump-sum payment, if any

Without that state, the calculator cannot distinguish between:

- a full-benefit TPD claim that is currently payable now
- a deferred claim still inside the waiting period
- a staged claim where only the first payment is payable now
- a later claim where only the remaining balance is payable now
- a claim that ceased qualifying before the balance payment date

## Why A Simple Cap Field Is Not Enough

A manual cap field like `remainingAggregateTpdCap` is sufficient only when:

- the summary publishes one current payout corridor, and
- the cap is the main missing cross-policy state

That worked for:

- `hsbc-life-flexi-protector`
- `great-eastern-investment-linked-insurance-plan-2`
- `great-eastern-great-life-advantage-4`
- `great-eastern-wealth-advantage-4`
- `income-astralink-va2`

It does not work here, because the hard part is not only the cap. The hard part is payout staging and continuation.

## Residual Metadata-Only Tail

The remaining unsupported mechanics are now narrower:

- deferment timing before the first payment becomes due
- the “balance payable 12 months later or on death” release rule
- stop-payment if disability ceases before the balance due date
- post-claim continuation after a lower-than-death TPD settlement

## Recommendation

1. Treat `PRUActive LinkGuard` as the landed proof case that validated a dedicated current-only staged-claim surface.
2. Keep only the later timing / cease-disability / post-claim continuation tail metadata-only.
3. Screen the next staged-TPD candidate against this landed surface instead of reopening LinkGuard itself.
