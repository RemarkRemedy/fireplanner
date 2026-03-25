# FWD Bonus / Waiver Screen

This note records the next repeated small-mechanic screen across the currently supported FWD products:

- `fwd-invest-flexi-elite`
- `fwd-invest-flexi-vii`
- `fwd-invest-first-horizon`
- `fwd-invest-first-max`
- `fwd-invest-first-summit`

## Conclusion

There is no cheap shared FWD bonus / waiver slice left after the insurance-charge lane.

The honest executable FWD bonus corridor is already landed:

- annual premium bonus on the annual-payment option for Flexi Elite / Flexi VII / First Horizon

The remaining repeated FWD residuals are not just bonus-rate windows. They are coupled to:

- premium shortfall / Premium Pause Waiver timing
- support-benefit approval and refund state
- repayment and restoration waterfalls
- increase-layer or reduction sequencing
- missed-premium / grace-period bonus suspension

## What is already modeled

Supported FWD bonus support already covers:

- `fwd-invest-flexi-elite`: first-year annual premium bonus on annual frequency
- `fwd-invest-flexi-vii`: annual premium bonus in the first seven policy years on annual frequency
- `fwd-invest-first-horizon`: annual premium bonus in the first five policy years on annual frequency

Those slices fit the current bonus surface because they are premium-allocation bonuses with simple annual-payment gating.

## What still remains outside support

### Flexi VII / First Horizon

The repeated residuals are:

- Booster Bonus
- Loyalty Bonus
- repayment-driven bonus restoration
- Premium Pause Waiver / Support Benefit waiver and refund behavior

The parser wording already narrows why they remain out:

- bonus restoration depends on repayment state
- Premium Pause Waiver timing affects whether premium shortfall charges and bonuses resume
- top-up and withdrawal repayment precedence matters

### Flexi Elite

The remaining residuals are:

- Booster Bonus
- Contribution Bonus
- premium-shortfall refund / unemployment-waiver behavior
- Free Partial Withdrawal Benefit waivers

These are tied to:

- unemployment-waiver or support-benefit approval state
- refund / restart timing
- life-event proof requirements

### First Max / First Summit

Their remaining bonus tails are also not isolated rate tables:

- Booster Bonus / Loyalty Bonus / Accumulation Bonus / Perpetual Bonus
- missed-premium and grace-period interactions
- increase-regular-premium layers or premium-restoration sequencing
- support-benefit waiver / refund logic

## Why this family is not the next cheap kernel

The repeated FWD residuals only look similar at the label level.

In practice they require one or more of:

- historical missed-premium state
- waiver approval state
- repayment ordering state
- layer-specific premium history
- permanent bonus-disqualification logic after certain events

That is not the same shape as the already-landed annual premium bonus support.

## Recommendation

1. Treat the shared FWD bonus / waiver family as screened out for cheap support expansion.
2. Do not reopen FWD bonus work unless a much narrower subfamily emerges with simple rate windows and no repayment / waiver / layer-history state.
3. Keep the live cursor on the Tokio achievement-bonus screen instead of spending more time on the FWD bonus tail.
