# Reinstatement Family Screen

This note records the next lane screen after the SmartRetire claim-side and HSBC staged-TPD branches were judged too stateful for another cheap kernel.

## Conclusion

There is no new broad reinstatement kernel ready to land.

The current reinstatement residuals split into two different families:

- an already-landed payout-state transition family
- a heavier underwriting / backpay / exclusion-reset family that is still metadata-only

The only honest reusable reinstatement mechanic already in the platform is the narrow AIA payout-state rule:

- scheduled payout is suppressed while lapsed
- payout state can fall back permanently after Premium Holiday activation
- payout state can remain on the fallback path after reinstatement

That is materially different from the remaining reinstatement wording in Manulife and HSBC.

## Existing landed reinstatement kernel

Current source-backed reusable support:

- `aia-elite-secure-income-5-pay`
- `aia-platinum-retirement-elite`

These products already use the `kernel:lapse-reinstatement-payout-state` surface for annual payout-state handling. The modeled state is narrow and specific:

- lapse suppresses scheduled payout
- Premium Holiday can change payout state
- reinstatement can preserve the downgraded payout state rather than restoring the original one

This is a real reusable mechanic, but it is a payout-state kernel, not a general reinstatement kernel.

## Remaining Manulife / HSBC reinstatement family

Remaining products with reinstatement residuals:

- `manulife-investready-iii`
- `manulife-investready-growth`
- `manulife-smartretire-v-income`
- `manulife-smartretire-v-sum`
- `hsbc-life-flexi-protector`

Their residual wording does not line up with the AIA payout-state kernel.

### HSBC Life Flexi Protector

The published reinstatement wording includes:

- reinstatement within 24 months from lapse
- backpay of refunded account value or missed premiums depending on when lapse occurred
- health evidence
- insurer approval and possible different post-reinstatement terms
- premium-charge continuation from where the last regular premium was made
- unit allocation after approval at prevailing dealing-day prices

This is not just a Boolean `reinstated` state. It mixes:

- approval workflow
- cashflow / backpay choices
- resumed premium-charge position
- post-approval allocation timing

### Manulife InvestReady / SmartRetire

The current residual wording in the parser family is also administrative rather than calculator-like:

- reinstatement underwriting
- approval
- premium-allocation carry-forward
- pre-existing-condition or exclusion resets

Those are not the same mechanic as AIA payout-state fallback, and they are not a cheap extension of the current lapse kernel.

## Why there is no next cheap reinstatement kernel

The broad reinstatement bucket only looks repeated at a label level.

In practice:

- AIA uses reinstatement mainly to affect payout-state continuity
- HSBC uses reinstatement as a backpay + approval + resumed-charge-position workflow
- Manulife residuals emphasize underwriting and exclusion-reset consequences

That means a single new `reinstatement` field would overstate support rather than unlock a real shared mechanic.

## Recommendation

1. Treat the narrow AIA payout-state reinstatement kernel as the only landed reusable reinstatement support.
2. Do not start a new broad reinstatement kernel from the remaining Manulife / HSBC residuals.
3. Keep HSBC and Manulife reinstatement semantics metadata-only unless one narrower executable subfamily emerges, such as:
   - resumed premium-charge position without underwriting, or
   - payout-state continuity after reinstatement for another already-supported payout product
