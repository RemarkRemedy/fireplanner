# Etiqa Premium-Floor Death-Benefit Screen

This note records the next smaller death-benefit lane after the plain `policy value today` AIA Invest Easy corridor was landed.

Products screened:

- `etiqa-tiq-invest`
- `etiqa-dash-pet-plus`

## Conclusion

The current-state base death-benefit corridor is now landed support for both products.

The published current death-benefit wording is still small enough to fit the existing current-state shell:

- `Tiq Invest`: higher of current account value or `105%` of paid single/top-up premiums, less partial withdrawals and current amounts owing
- `Dash PET Plus`: higher of current rider account value or `105%` of paid rider single/top-up premiums, less rider withdrawals

That is still a current-snapshot floor, not a full claim-state workflow:

- the kernel already carries current account value
- the event history already carries ad hoc top-ups, recurring single premiums, and withdrawals
- `Tiq Invest` only needed one additional manual current-state field: `currentAmountOwing`

## What landed

The supported boundary now includes:

- `Death Benefit Today` for `Tiq Invest`
- `Death Benefit Today` for `Dash PET Plus`
- recurring single-premium history folded into the premium-floor basis
- manual `currentAmountOwing` input exposure for `Tiq Invest`

## What still remains outside support

This lane did not make the products fully protection-complete.

Still metadata-only:

- `Tiq Invest` terminal-illness benefit and post-claim continuation
- `Tiq Invest` fund-switching administration
- `Tiq Invest` grace-period funding / reinstatement handling
- `Dash PET Plus` terminal-illness benefit and post-claim continuation
- `Dash PET Plus` yearly renewability and basic-policy dependency
- `Dash PET Plus` payout-method charges, dividend crediting to the basic policy, and rider admin operations

## What this screened out

The next nearby products were not equally cheap:

- `Invest plus SP` still needs top-up-vintage accounting and net-premium floor handling
- `TM Wealth Enhancer (CPFIS)` still needs separate single-premium versus top-up policy-value tracking
- `WealthLink (GL3)` still needs the missing published basic-benefit table before the death-benefit floor can be modeled honestly

## Recommendation

1. Treat the Tiq / Dash premium-floor death-benefit lane as landed.
2. Keep the TI / post-claim branches metadata-only unless the team accepts a dedicated claim-state surface.
3. Screen the remaining small protection candidates only if they do not require split policy-value tracking, top-up-vintage accounting, or missing table reconstruction.
