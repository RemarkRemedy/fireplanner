# AIA Pro Achiever 3.0 Bonus / Protection Screen

This note records the next screen after the smaller current-state protection lane was largely burned down on the local corpus.

Product screened:

- `aia-pro-achiever-3`

## Conclusion

`AIA Pro Achiever 3.0` splits into two different lanes:

- an honest executable bonus slice that is now landed
- a still-blocked protection-side death-benefit / benefit-charge slice

The landed slice is the smaller one:

- `Welcome Bonus` tiers for premium years 1 to 3 on the published IIP 10 corridor
- `Special Bonus` at `5%` from premium years 10 to 20
- `Special Bonus` at `8%` from premium year 21 onward

Those fit the existing premium-allocation bonus kernel because they are paid on each received regular premium and depend only on:

- annualised regular premium tier
- premium-year position
- the selected IIP corridor

## Why the protection side is still blocked

The same summary also publishes:

- death benefit as the higher of:
  - total regular premium paid plus total top-up premium plus premium reduction top-up amount less total withdrawals, or
  - policy value
- monthly `Benefit Charge = annual rate / 12 x Sum-at-Risk`
- `Sum-at-Risk = 100% of total regular premiums paid + total top-ups + total premium reduction top-up amount - total withdrawals - policy value`

That protection corridor is not a cheap follow-on on the current shell because it depends on `premium reduction top-up amount`, which the current platform does not carry as a reconstructible current-state input or executable event balance.

The existing `regular-premium-reduction` event surface models charge and bonus interactions, but it does not retain a trustworthy current `premium reduction top-up amount` balance for death-benefit or sum-at-risk estimation.

## Recommendation

1. Treat `Welcome Bonus` and `Special Bonus` as landed support for `AIA Pro Achiever 3.0`.
2. Keep `Benefit Charge` and death-benefit support blocked until the platform can represent current `premium reduction top-up amount` honestly.
3. Do not reopen the protection branch on this product with an inferred shortcut that silently drops premium-reduction top-up state.
