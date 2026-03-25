# ILP Claim-State Family Discovery

This note records the first source-backed pass over the remaining claim-side residuals after the support-boundary and review-page drift lanes were burned down.

## Conclusion

There is no single cheap "claim-state" kernel spanning the current residual set.

The products split into at least three distinct families:

1. TI advancement with remaining death-cover continuation
2. post-MIP / retirement-corridor death-benefit transitions with separate TPD or waiver claims
3. assurance-corridor claim caps and staged TPD payout handling

The best next executable candidate is no longer a universal claim-state kernel.

Family 1 is now screened more tightly:

- Wealth Focus needs its own protected-floor post-claim reduction state
- InvestReady still lacks enough published post-claim detail in the summary corpus for an honest TI-snapshot kernel with residual death-cover continuation

Family 2 remains a later mechanic lane, but it is blocked on the broader finite-MIP current-snapshot platform boundary rather than only missing formula inputs.

## Family 1

### TI advancement with remaining death-cover continuation

Products:
- `hsbc-life-wealth-focus-flexi-1`
- `hsbc-life-wealth-focus-flexi-3`
- `hsbc-life-wealth-focus-flexi-5`
- `manulife-investready-iii`
- `manulife-investready-iii-sep-2025`
- `manulife-investready-growth`

Source-backed common shape:
- terminal-illness benefit is an acceleration of death benefit
- policy may remain in force for residual death benefit if the full death benefit was not exhausted
- cross-policy cap state matters
- claim handling depends on a claim-time snapshot, not only today's static account value

Wealth Focus source facts:
- TI is paid "in one lump sum as an advancement of the Death Benefit"
- TI is capped at an aggregate `SGD 3 Million` across all policies issued by HSBC and other insurers for the same life assured
- the TI claim reduces the policy death benefit by deducting against either the protected premium floor corridor or total account value, with proportional reduction wording in the account-value-higher branch
- overdue or outstanding policy charges are deducted from the death or TI benefit payable

Manulife InvestReady III / Growth source facts:
- TI is paid as an acceleration of death benefit
- TI is subject to a shared insurer-level `TI/CI limit` and a separate `TI limit`
- the policy remains in force for death benefit if the death benefit has not been fully accelerated
- charges deducted before death-claim notification are not refunded
- parsers still classify amount-owed deductions, claim-notification valuation timing, and post-claim continuation as residual behavior beyond the current death-benefit estimate

Why this is not already one finished kernel:
- Wealth Focus has product-specific post-claim reduction against the `P` floor versus total-account-value corridor
- Manulife InvestReady ties the claim corridor to claim-notification timing and insurer-specific TI / TI+CI limits
- both need claim-state inputs that the current calculator does not carry

Minimum honest kernel candidate:
- represent a current TI-claim snapshot rather than full historical claim replay
- carry an explicit remaining cross-policy TI cap input
- carry an explicit remaining cross-policy TI-plus-CI cap input when the insurer wording requires it
- carry claim-time amount-owed / outstanding-charge input when the product deducts these at claim
- compute remaining post-claim death benefit only for products whose source wording preserves residual death cover after partial TI advancement

### Wealth Focus vs InvestReady Comparison

Shared current-claim inputs that look reusable:
- claim is a current TI advancement event rather than a pure current-state estimate
- remaining cross-policy cap matters
- residual death-cover continuation matters when the TI claim does not exhaust the entire death benefit

Wealth Focus-only published mechanics:
- the summary itself specifies how the TI claim reduces the protected premium-floor corridor versus total account value
- if `P` is higher, the TI claim is deducted from `P` and total account value is reduced by the same percentage
- if total account value is higher, the TI claim is deducted from total account value and `P` is reduced by the same percentage
- overdue or outstanding policy charges are deducted from the TI benefit payable

InvestReady published mechanics:
- the summary publishes death-claim valuation timing using the second business day after death notification
- the summary publishes remaining insurer-wide `TI/CI limit` and `TI limit`
- the summary confirms the policy remains in force for death benefit if the TI advancement does not fully exhaust it
- the summary does not publish the detailed post-claim reduction math and instead says to refer to the policy contract for details

Decision:
- Wealth Focus and InvestReady can probably share a few manual claim inputs
- they do not yet support one honest first executable kernel from the current summary corpus alone
- a follow-up screen shows Wealth Focus needs its own protected-floor post-claim reduction state, while InvestReady still pushes the detailed residual-death-cover mechanics into the policy contract
- this means there is no honest summary-only InvestReady-first TI snapshot kernel to land today

### Current Input-Surface Check

The current manual assurance surface is not sufficient for a TI-claim snapshot.

Existing supported manual assurance fields:
- current age next birthday
- sex
- smoker status
- current net regular premium base
- current net supplementary premium base
- current net repayment base
- current sum assured / current basic sum assured
- product-specific values such as Wealth Assure Value and Locked-in Policy Value

Missing claim-state fields for an honest InvestReady-family TI implementation:
- remaining insurer-wide TI limit
- remaining insurer-wide TI-plus-CI limit
- claim-time amount owing / outstanding charges to deduct
- explicit claim mode or current TI-claim snapshot state

Important source gap:
- InvestReady summaries publish death-claim valuation timing and cross-policy TI limits
- they do not publish the detailed TI post-claim calculation path and instead refer the reader to the policy contract
- they do not publish a complete TI-claim valuation-date rule in the summary slice comparable to the death-notification wording

Result:
- the current lane is not ready for an honest InvestReady TI-snapshot implementation
- before any code change, this family needs both:
  - a new manual claim-state input surface
  - enough source wording to define TI payable amount and remaining post-claim death-benefit math from the summary or policy contract

## Family 2

### Post-MIP / retirement-corridor death-benefit transitions with separate TPD or waiver claims

Products:
- `manulife-smartretire-v-income`
- `manulife-smartretire-v-sum`

Source-backed shape:
- the later current-state death-benefit corridor is now modeled on the mature finite current-only surface
- TPD behavior is not just a deduction or claim cap; it drives Waiver of Premium state and separate COI handling

Source facts:
- SmartRetire death benefit during MIP uses a protected-floor corridor
- there is no parallel TI advancement clause in the current summary slice like the InvestReady family
- WOP on TPD can waive future premiums until flexi start
- WOP has its own COI table and claim-state consequences
- refund-of-COI at target retirement age depends on there being no death or WOP claim before target retirement age

Why this is a separate family:
- the live residual is no longer "later death-benefit formula support"
- the hard state is later-lifecycle death-benefit transition plus TPD/WOP status and no-claim gating

## Family 3

### Assurance-corridor claim caps and staged TPD payout handling

Products:
- `hsbc-life-flexi-protector`

Source-backed shape:
- the monthly death / TI insurance-charge corridor is already modeled
- the current death-benefit estimate is modeled
- the current TI capped snapshot is now modeled with manual current claim inputs
- remaining gaps are staged TPD treatment, claim-currency settlement, cross-policy cap details beyond the TI-only input surface, and post-claim continuation

Parser facts:
- the current `TPD Benefit Today` snapshot is now modeled with manual `currentIndebtedness` and `remainingAggregateTpdCap`
- metadata-only residuals now primarily represent the staged TPD and post-claim remainder
- TPD cross-policy cap derivation remains metadata-only
- metadata-only residuals include staged TPD activities-of-daily-living payout handling
- metadata-only residuals include TI / TPD claim-currency settlement and post-claim continuation

Why this is separate:
- this is not a current-death-benefit-estimate family
- this is not primarily a post-MIP corridor family
- staged TPD payout semantics make it heavier than a first TI-advancement claim kernel

## Recommendation

1. Do not design a universal claim-state kernel for all current residuals.
2. Treat the payable-now staged-claim surface as landed for `PRUActive LinkGuard` and `HSBC Life Flexi Protector`.
3. Keep family 1 blocked unless policy-contract wording or a broader claim-history surface appears.
4. Treat the SmartRetire later-corridor and claim-side screens as landed and exhausted on the current payable-now surface.
5. Use the broader claim-history contract as the next heavier lane for SmartRetire and TI-continuation families.

## Immediate Next Step

The next discovery slice should answer one heavier question first:

1. Do not reopen SmartRetire unless the platform accepts a dedicated claim-status input surface for WOP / refund gating.
2. Do not reopen the remaining HSBC staged-TPD / claim-settlement branch unless the platform accepts a dedicated staged-claim surface.
3. Prefer smaller non-claim mechanics, such as plain current-value death-benefit corridors, before returning to staged claim-state work.
