# Broader Claim-History Surface Contract

This note defines the first honest surface beyond the landed current-only payable-now claim snapshots.

It exists because the following families are now blocked on claim history or future-dependent state rather than on one more current-value field:

- `manulife-smartretire-v-income`
- `manulife-smartretire-v-sum`
- Wealth Focus / InvestReady TI continuation families

## Purpose

The current runtime can now support:

- current death snapshots
- current TI snapshots
- current payable-now TPD snapshots
- staged payable-now TPD snapshots

What it still cannot support honestly is any mechanic that depends on:

- whether a claim was already admitted in the past
- what future premium or benefit runway remains after that claim
- whether a later refund or continuation gate has already been broken

## Minimum New Surface

The first broader claim-history surface should stay current-only and explicit.

Do not try to infer history from current account value.

Do not project future claim sequencing in the first slice.

At minimum, the platform would need a separate claim-history object with fields like:

- `currentClaimFamily`
  - `none`
  - `ti-advancement`
  - `tpd-waiver`
  - `tpd-staged-payout`
- `currentClaimAdmissionStatus`
  - `not-admitted`
  - `admitted`
  - `admitted-and-settled`
- `currentRemainingClaimRunway`
  - remaining waived-premium base
  - remaining protected death-cover base
  - remaining staged-benefit balance
- `currentRefundGateStatus`
  - whether a later refund-style benefit is still eligible
  - whether it has already been broken by a prior death or WOP claim

The exact field names may differ, but the surface needs those semantic buckets.

## What This Unlocks

### SmartRetire

This would make an honest SmartRetire claim-side slice possible by carrying:

- whether WOP-on-TPD is already admitted
- remaining waived-premium runway until Flexi Start
- whether the refund-of-COI gate is still intact

Without that, SmartRetire still collapses future waiver and refund logic into fake current values.

### Wealth Focus / InvestReady

This would also be the first surface that could honestly support a TI continuation lane, because those products need:

- whether the current state is an admitted TI-advancement claim
- what residual death-cover base remains
- whether claim-time deductions have already been applied

The current payable-now snapshot surface is insufficient for that.

## What This Still Does Not Try To Solve

The first broader claim-history surface should still leave these out:

- full future claim projection
- claim-currency conversion
- documentary proof and insurer admission workflow
- claim notification valuation timing if the summary pushes it into the policy contract
- dynamic post-claim charge sequencing unless the summary states it directly

Those are a second lane, not part of the first contract.

## Entry Criteria

Only open implementation against this contract when both conditions are true:

1. the local source corpus contains enough product wording to define the current claim-history state honestly
2. the product family needs claim history, not just a payable-now claim stage

Right now:

- `PRUActive LinkGuard` does not need this broader surface for its landed staged payable-now TPD snapshot
- `HSBC Life Flexi Protector` does not need this broader surface for its landed staged payable-now TPD snapshot
- `SmartRetire` still does
- Wealth Focus / InvestReady still do

## Recommendation

1. Treat the payable-now staged-claim surface as a finished lower layer.
2. Treat this claim-history surface as the next heavier kernel lane.
3. Do not reopen SmartRetire or Wealth Focus / InvestReady for code until the team accepts this broader contract.

The local source PDFs are now present for the first-screen products in this lane:

- Wealth Focus Flexi 1 / 3 / 5
- Manulife SmartRetire (V) Income / Sum
- Manulife InvestReady (III) / Growth cohorts

So the blocker is no longer corpus absence. The blocker is that the remaining semantics still need broader claim-history state or policy-contract detail that the summaries do not fully expose.
