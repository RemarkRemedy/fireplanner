# HSBC Life Flexi Protector Claim Discovery

This note records the first narrower screen of the remaining claim-side residuals for:

- `hsbc-life-flexi-protector`

## Conclusion

HSBC Life Flexi Protector should not be treated as one single TI/TPD claim branch.

The summary splits into:

- a narrower TI capped-payout snapshot candidate
- a much heavier TPD staged-payout branch

The current supported boundary is also cleaner now:

- the monthly Choice/Max death-TI insurance charge remains modeled
- the current-state death-benefit estimate from the same Choice/Max corridor is now modeled
- the current TI snapshot from the same Choice/Max corridor is now modeled once manual claim inputs are provided
- the remaining Flexi Protector claim gap is now the narrower staged-TPD qualification / later-release / settlement tail rather than TI-only payout estimation

## TI branch

Published summary mechanics:

- TI benefit is paid in lump sum as an advancement of the death benefit
- TI payout is limited to the lower of:
  - `$3 million`, or
  - `Death Benefit at the point of Terminal Illness claim`
- overdue or outstanding policy charges are deducted from the TI benefit
- payout is made in policy currency, with optional conversion at prevailing exchange rate
- if the death benefit is fully paid out, the policy terminates
- if the death benefit is not fully paid out, the policy remains in force with the remaining account value after deducting `$3 million`

What this now means:

- the TI branch was materially cleaner than Wealth Focus and InvestReady because the summary publishes both the cap and the post-claim continuation wording directly
- that narrower lane is now landed as a current TI snapshot with two manual claim inputs:
  - `currentIndebtedness`
  - `remainingAggregateTiCap`
- the supported corridor now covers:
  - Choice Cover: `min(remainingAggregateTiCap, max(0, max(accountValue, basicSumAssured + supplementaryBase) - currentIndebtedness))`
  - Max Cover: `min(remainingAggregateTiCap, max(0, basicSumAssured + accountValue - currentIndebtedness))`

## TPD branch

Published summary mechanics:

- TPD benefit is the Basic Sum Assured less outstanding indebtedness, paid as an advancement of the death benefit
- cross-policy caps vary by residency / pass-holder status and age
- the life assured may elect an early staged payout:
  - advance 100% of TPD benefit up to `$3 million` or `$2 million` on the 2-ADL definition
  - remaining TPD benefit is then paid later on the 3-ADL or other qualifying definition
- overdue or outstanding policy charges are deducted
- payout is in policy currency with optional conversion
- if the death benefit is not fully paid out, the policy remains in force with the remaining account value after deducting `$6 million`

Why this was heavier:

- staged ADL payout introduces explicit claim-state progression
- residency / pass-holder status affects the cap
- a single admitted TPD claim can still have a later remaining-benefit release condition

## Landed staged-TDP current-only slice

The next narrower staged slice is now landed too.

What is now modeled:

- `TPD Benefit Today` can still represent the full payable-now benefit from:
  - `max(0, basic sum assured - current indebtedness)`
  - capped by a manual `remainingAggregateTpdCap`
- it can also now represent:
  - an initial ADL-based staged payment, by using the current-claim-stage TPD cap
  - a later staged balance payment, by entering the current remaining TPD balance

What this means:

- the runtime now supports a truthful payable-now TPD snapshot for:
  - full benefit payable now
  - initial staged payment payable now
  - later staged balance payable now
- it still does not try to derive:
  - residency / pass-holder cap logic
  - ADL qualification itself
  - later-release timing
  - claim-currency settlement
  - post-claim continuation

## Current recommendation

1. Treat the staged payable-now `TPD Benefit Today` surface as landed support, not as open screening work.
2. Keep the remaining Flexi Protector TPD branch focused on ADL qualification, later-release timing, claim-currency settlement, and post-claim continuation rather than reopening the payable-now snapshot.
3. The remaining staged-TPD tail is no longer the best next family, because it needs broader claim-status or settlement semantics than the current landed slice.
