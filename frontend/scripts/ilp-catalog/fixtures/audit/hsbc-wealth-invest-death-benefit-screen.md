# HSBC Wealth Invest Death-Benefit Screen

This note records the next small current-state protection slice after the AIA Invest Easy and Etiqa Tiq / Dash lanes.

Products screened:

- `hsbc-life-wealth-invest-cpf`
- `hsbc-life-wealth-invest-cash-srs`

## Conclusion

The current-state base death-benefit corridor is now landed support for both products.

The product summaries publish the same executable core:

- death benefit is the higher of `101% of total premiums paid to date less any partial withdrawals` or `Policy Value`
- overdue policy charges are deducted from the benefit if applicable

That fits the current shell honestly:

- current policy value is already carried
- initial single premium, ad hoc top-ups, recurring single premiums, and withdrawals are already tracked in event history
- the only extra current-state surface needed is manual `currentAmountOwing`

## What landed

The supported boundary now includes:

- `Death Benefit Today` for `HSBC Life Wealth Invest (CPF)`
- `Death Benefit Today` for `HSBC Life Wealth Invest (Cash/SRS)`
- deduction of manual `currentAmountOwing` / overdue policy charges
- current-state support across cash, SRS, and CPF corridors

## What remains outside support

Still metadata-only:

- terminal-illness benefit and post-claim continuation
- recurring-single-premium enrollment approval / failed-deduction administration
- fund-level and additional ILP-sub-fund charges
- switching administration and payout-routing operations
- free-look refund and termination-side administration

## Roadmap impact

This closes another real small protection lane. The nearby residuals now look less like one reusable family:

- `WealthLink (GL3)` still needs the missing basic-benefit table
- `TM Wealth Enhancer (CPFIS)` still needs split single-premium versus top-up value tracking
- `Invest plus SP` still needs top-up-vintage accounting
- the Great Eastern open-ended products still need source-backed screening before any similar death-benefit claim is made

## Recommendation

1. Treat the HSBC Wealth Invest base death-benefit lane as landed.
2. Keep terminal-illness / post-claim branches metadata-only unless the team accepts a claim-state surface.
3. Continue the small-protection lane only where the source wording is explicit and the current shell does not need split-value or vintage state.
