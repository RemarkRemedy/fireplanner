# SmartRetire Narrow Claim-Slice Screen

This note records the follow-up screen after the broader SmartRetire claim-side family was already classified as too stateful for a cheap kernel.

Products screened:

- `manulife-smartretire-v-income`
- `manulife-smartretire-v-sum`

## Question

Is there any honest narrower SmartRetire claim-side slice on the current surface, such as:

- `current WOP admitted?`
- `COI refund eligibility only?`
- `current remaining WOP cap / runway?`

## Conclusion

No.

The current runtime surface has no truthful way to represent even those narrower questions without adding dedicated claim-status inputs.

The only manual claim inputs that exist today are:

- `currentIndebtedness`
- `remainingAggregateTiCap`
- `remainingAggregateTpdCap`

That is enough for the already-landed HSBC payable-now TI / TPD snapshots. It is not enough for SmartRetire, whose remaining behavior depends on WOP admission state, future waived-premium runway, and a no-prior-claim gate for later COI refund.

## Why the narrow candidates still fail

### `current WOP admitted?`

This is not just a boolean label.

If WOP on TPD has been admitted, the product summary says:

- future basic premiums are waived until Flexi Start
- 100% of each waived basic premium is invested when due
- WOP has its own COI path during MIP until before Flexi Start
- WOP COI stops once the TPD conditions are met

So even a current WOP status question implies a remaining waived-premium runway and WOP-specific COI state. The current calculator has neither.

### `COI refund eligibility only?`

The summary does not define refund eligibility as an isolated present-state flag. It says the refund only happens if there was:

- no death-benefit claim before target retirement age, and
- no WOP-on-TPD claim before target retirement age

That is explicit claim-history gating. The runtime does not carry a prior-claim status surface for this family.

### `current remaining WOP cap / runway?`

The summary frames WOP against remaining basic premiums until before Flexi Start, capped at `S$1,000,000`.

That means an honest snapshot would still need:

- whether WOP has already been admitted
- the remaining premium schedule or an equivalent remaining basic-premium base
- where the policy currently sits relative to Flexi Start

The current surface does not expose that family of inputs.

## Recommendation

1. Treat the SmartRetire claim-side lane as exhausted on the current surface.
2. Keep WOP-on-TPD, WOP COI, and refund-of-COI logic metadata-only unless a dedicated claim-status input surface is accepted.
3. Move the live cursor to the remaining HSBC staged-TPD / claim-settlement branch instead of reopening SmartRetire again.
