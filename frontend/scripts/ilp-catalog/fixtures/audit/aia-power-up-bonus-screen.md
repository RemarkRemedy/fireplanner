# AIA Power-up Bonus Screen

This note records the first small-lane screen after the reinstatement family was judged mostly administrative.

## Conclusion

`Power-up Bonus` is repeated, but it is not a free bonus-rate lane.

The closest repeated candidates are:

- `aia-elite-secure-income-5-pay`
- `aia-platinum-retirement-elite`

Both already expose the same core problem: the published bonus is tied to withdrawal-adjusted policy value and downstream payout behavior, not just a fixed anniversary rate table.

## Why it looked attractive

At first glance this seems like a cheap next step:

- both products are already supported
- both already model partial-withdrawal charges
- both already support payout-state handling
- both still list `Power-up Bonus` as a residual

## Why it is not a cheap bonus-only kernel

The parser evidence already narrows the blocker:

- `aia-elite-secure-income-5-pay` states that Power-up Bonus depends on a withdrawal-adjustment factor after policy year 5
- `aia-platinum-retirement-elite` states that Power-up Bonus depends on a withdrawal-adjustment factor and separately documented single-premium versus regular-premium policy values
- both product families also note that partial withdrawals change downstream payout behavior, not just the bonus amount

That means the missing mechanic is not only:

- anniversary timing
- rate windows
- or a one-line additive bonus schedule

It is a stateful bonus base that depends on:

- how prior withdrawals changed the eligible policy value
- which premium-value bucket the product uses
- and how that interacts with payout-state / income mechanics

## Recommendation

1. Do not treat AIA Power-up Bonus as the next cheap executable slice.
2. Keep it behind simpler bonus families that only need anniversary-rate windows or existing bonus-account bases.
3. Reopen this lane only if a narrower reusable `withdrawal-adjusted bonus base` mechanic becomes valuable across multiple supported products.
