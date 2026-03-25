# TI Claim Snapshot Discovery

This note records the narrower follow-up screen for the TI-advancement family:

- `hsbc-life-wealth-focus-flexi-1/3/5`
- `manulife-investready-iii`
- `manulife-investready-iii-sep-2025`
- `manulife-investready-growth`

## Conclusion

There is still no honest summary-only TI-claim snapshot kernel spanning Wealth Focus and InvestReady.

The family splits more sharply than the earlier broad claim-state note suggested:

- Wealth Focus publishes explicit post-claim reduction math and therefore needs its own protected-floor post-claim state
- InvestReady publishes the TI cap structure and confirms residual death-cover continuation, but pushes the detailed post-claim mechanics into the policy contract

Result:

- Wealth Focus is not a candidate for an InvestReady-first reusable kernel
- InvestReady does not yet have enough published summary detail to support an honest current TI-claim snapshot with residual death-benefit continuation

## Wealth Focus

Published summary mechanics:

- TI is paid in one lump sum as an advancement of the death benefit
- TI is capped at an aggregate `SGD 3 Million` across all policies issued by HSBC and other insurers for the same life assured
- the TI claim reduces the policy death benefit by deducting against either:
  - `P = 101% of total regular premiums paid less cumulative withdrawals`, or
  - total account value
- whichever branch is reduced, the other branch is reduced by the same percentage
- overdue or outstanding policy charges are deducted from the benefit payable
- the remaining death benefit after deducting the TI claim remains payable on later death or accidental death

Why this keeps Wealth Focus separate:

- the summary specifies product-shaped post-claim reduction math rather than a simple cap on today’s death benefit
- the calculator would need an explicit post-claim protected-floor and account-value state transition, not only a TI-cap input

## InvestReady Growth

Published summary mechanics:

- death benefit is the higher of:
  - `101% of total basic premium paid plus any top-up premium less any withdrawal made`, or
  - account value
  - less any amount owing
- TI benefit is paid as an acceleration of the death benefit
- TI is subject to:
  - insurer-wide `TI/CI limit`
  - insurer-wide `TI limit`
- payment of TI reduces those limits
- the policy remains in force for death benefit if the death benefit has not been fully accelerated and paid following the TI claim
- the summary says: `Please see the policy contract for details.`

What is still missing from the summary slice:

- how the policy’s own death-benefit corridor is reduced after a partial TI claim
- whether the remaining death benefit should be modeled as:
  - current death benefit less TI paid, or
  - a re-based protected-floor/account-value corridor
- enough claim-time detail to propagate the post-claim state into later projections or current residual death-benefit estimates

## InvestReady (III)

The current repo does not carry the matching local summary PDF for direct re-check in this slice, but the parser already classifies the same residual bucket:

- terminal-illness acceleration limits
- amount-owed deductions
- claim-notification valuation timing
- post-claim continuation

The InvestReady (III) and InvestReady Growth parsers intentionally keep those behaviors metadata-only beyond the current death-benefit estimate.

## Current executable surface

The existing runtime can already support the current no-claim death-benefit estimate for InvestReady-family products because it uses:

- current net regular premium base
- current net supplementary premium base
- the published `101%` protected-base floor

What it cannot support honestly yet:

- current TI claim payable amount with full residual-death-benefit continuation
- post-claim death-benefit state after a partial TI claim
- insurer-wide remaining TI caps without a dedicated claim-state surface

## Recommendation

1. Keep Wealth Focus on its own protected-floor post-claim branch.
2. Do not implement an InvestReady-first TI snapshot kernel from the current summary corpus alone.
3. Only reopen this lane if one of these changes:
   - the policy-contract wording for InvestReady TI post-claim handling is added to the source corpus
   - the product goal narrows to a metadata-backed TI-cap indicator rather than an executable post-claim benefit state
