# Tokio Achievement Bonus Screen

This note records the next live small-mechanic candidate after the FWD bonus / waiver family was screened out.

Products screened:

- `tokio-marine-goluxe`
- `tokio-marine-goaffluence`

## Conclusion

Tokio `Achievement Bonus` is now closed as an executable lane.

The family had two shapes, and both are now landed:

- `#goLuxe`: landed on a qualification-window bonus extension
- `#goAffluence`: landed on the same qualification-window support plus a one-time committed-annual-premium milestone bonus basis

## #goLuxe

Published summary facts:

- achievement bonus is paid at the end of each policy year
- no achievement bonus is paid if any of these happened during the first ten policy years:
  - premium holiday
  - regular-premium reduction
  - partial withdrawal from the Accumulation Units Account
- formula:
  - `Achievement Bonus = Achievement Bonus rate x Accumulation Units Account Value`
- rate:
  - `5.0%`
- policy years:
  - `30, 35 and 40`

Why this is close:

- the calculator already supports one-time bonus timing through `cadenceYears`
- it already supports annual-rate bonuses on account value
- it already has suspension triggers for premium holiday, regular-premium reduction, and partial withdrawal

What was missing and is now landed:

- the bonus kernel now supports qualification-window disqualification rules
- `#goLuxe` can now model the source wording honestly without over-suppressing achievement bonus after later events outside the first ten policy years

## #goAffluence

Published summary facts:

- achievement bonus is paid only at the end of eligible policy years
- conditions are tied to no premium holiday, no regular-premium reduction, and no partial withdrawal before the end of the eligible policy year
- formula:
  - `Achievement Bonus = applicable achievement bonus rate x annualised regular premium committed at commencement date`
- for the 15-year premium payment term shown in the summary, the eligible policy years are milestone years rather than every year

What was missing and is now landed:

- a one-time bonus basis keyed to committed annual premium at issue
- qualification rules that can disqualify through each milestone reference year instead of only a fixed cutoff year

That was enough to model the 15-year-premium-term corridor honestly at policy years 20 and 25.

## Smallest honest kernel candidate

The smallest reusable extension is not a full Tokio bonus family.

It was a bonus-surface extension with two pieces:

1. qualification-window support
   - allow bonus disqualification rules to apply only through a stated cutoff year such as `policy year 10`
2. one-time bonus basis expansion
   - add a way for `one-time` bonuses to use a formula basis such as committed annual premium instead of fixed amount only

With only the first piece, `#goLuxe` became the first landed consumer.
With both pieces, `#goAffluence` joined the same family.

## Recommendation

1. Treat the Tokio achievement-bonus family as landed support.
2. Move the live cursor to the next heavier repeated Tokio residual: multi-life / last-life / change-of-life-assured state.
