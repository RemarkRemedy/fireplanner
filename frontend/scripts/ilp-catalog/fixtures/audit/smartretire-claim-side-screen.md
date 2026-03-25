# Manulife SmartRetire Claim-Side Screen

This note records the next source-backed screen after the later SmartRetire death-benefit corridor was landed for:

- `manulife-smartretire-v-income`
- `manulife-smartretire-v-sum`

## Conclusion

There is no honest cheap SmartRetire claim-side kernel in the current summary corpus.

The remaining SmartRetire residuals are a coupled claim family:

- Waiver of Premium on TPD before flexi start
- a separate WOP cost-of-insurance path
- a refund-of-COI benefit that only pays if there was no death claim and no WOP-on-TPD claim before target retirement age

That combination is not a simple current-state estimate. It requires explicit claim-history or claim-status semantics plus future-premium context.

## Published mechanics

Both product summaries publish the same claim-side shape:

- if TPD happens before flexi start and before the policy anniversary immediately after age 70, future basic premiums are waived until flexi start
- 100% of each waived future basic premium is invested into the prevailing fund allocation when due
- WOP has its own COI path during MIP until before flexi start
- the WOP NAAR is the amount of remaining basic premiums until before flexi start, capped at `S$1,000,000`
- WOP COI stops once the TPD conditions are met
- COI for the basic death benefit is refunded only if there was no death-benefit claim and no WOP-on-TPD claim before target retirement age

## Why this is not another cheap current-only metric

The WOP branch is not just a payout cap or a one-time deduction:

- it changes future premium funding behavior until flexi start
- it has its own COI stream and its own stop-charging rule
- the later COI refund depends on the absence of earlier death or WOP claims before target retirement age

That means even a narrow summary-only slice would need more than current account value and current assurance bases.

## Minimum state an honest implementation would need

At minimum, the platform would need:

- whether a WOP-on-TPD claim has already been admitted
- the current remaining waived-premium runway until flexi start
- the current remaining WOP COI base or an equivalent remaining-premiums state
- whether the eventual COI refund gate is already broken by a prior death or WOP claim

Even then, the current user surface would still need to decide whether it is showing:

- current WOP status
- future waived-premium value
- refund eligibility only
- or the eventual COI refund amount

## Recommendation

1. Do not force SmartRetire claim-side behavior into the current summary-metric kernel yet.
2. Keep WOP-on-TPD, WOP COI, and refund-of-COI gating metadata-only unless a dedicated claim-state surface is accepted.
3. A follow-up narrow-slice screen has now closed the obvious smaller questions too: neither `current WOP admitted?` nor `COI refund eligibility only?` is honest on the existing claim surface.
4. If this family is revisited later, start with a dedicated claim-status input design, not another parser-only or formula-only pass.
