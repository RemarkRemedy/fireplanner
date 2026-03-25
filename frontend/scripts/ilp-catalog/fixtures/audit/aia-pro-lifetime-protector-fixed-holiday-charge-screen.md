# AIA Pro Lifetime Protector (II) Fixed Holiday Charge Screen

This note records the follow-on bounded AIA charge slice after the `AIA Pro Achiever 3.0` bonus lane.

Product screened:

- `aia-pro-lifetime-protector-ii`

## Conclusion

The fixed `S$50` monthly Premium Holiday Charge in the first two policy years was a real executable kernel gap, not a source gap.

That slice is now landed:

- a new fixed-monthly premium-holiday event-charge basis exists on the kernel
- `AIA Pro Lifetime Protector (II)` now models the published `S$50` monthly Premium Holiday Charge during policy years 1 to 2

## Why this was honest to model

The summary wording is narrow and explicit:

- during premium holiday in the first 2 policy years, a `Premium Holiday Charge of S$50` is charged on a monthly basis
- the charge is a fixed monthly amount, not a percentage of annual premium or account value

The prior blocker was purely mechanical:

- the event-charge kernel already handled premium-holiday charges derived from annual premium
- it did not have a basis for a fixed monthly amount applied only across overlapping holiday months

Once that basis existed, the product fit cleanly without adding new manual state.

## Remaining residual on this product

The remaining PLP2 residuals are still heavier than this fixed-charge slice:

- No Lapse Privilege debt carry
- claim-side death-benefit settlement
- insured-amount variation and milestone increase administration
- AIA Vitality and rider administration

Those stay metadata-only for now.

## Recommendation

1. Treat the fixed `S$50` monthly Premium Holiday Charge as landed support for `AIA Pro Lifetime Protector (II)`.
2. Keep the remaining PLP2 residuals behind claim-side or administrative state, not this fixed-charge lane.
