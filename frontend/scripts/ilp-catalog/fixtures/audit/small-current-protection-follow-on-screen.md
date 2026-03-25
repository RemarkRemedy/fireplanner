# Small Current Protection Follow-On Screen

This note records the first follow-on screen after the AIA Invest Easy and Etiqa Tiq / Dash current-state death-benefit lanes were landed.

Products screened:

- `income-wealthlink-gl3`
- `tokio-marine-wealth-enhancer-cpfis`
- `etiqa-invest-plus-sp`
- `great-eastern-great-invest-advantage-sp`
- `great-eastern-great-invest-advantage-rsp`
- `great-eastern-great-invest-advantage-2-sp`
- `great-eastern-great-invest-advantage-2-rsp`

## Conclusion

There is no next cheap shared follow-on inside this immediate group.

All three still sit outside the current shell for different reasons:

- `WealthLink (GL3)` depends on a missing basic-benefit table from the source summary corpus
- `TM Wealth Enhancer (CPFIS)` depends on separate single-premium versus top-up policy-value tracking
- `Invest plus SP` depends on top-up-vintage accounting and net-premium floor state
- the Great Eastern open-ended family is not screenable honestly from this local lane right now because the corresponding source PDFs are not present in the local corpus / downloads set

That means this is not one more reusable “small death-benefit floor” family. It is three different blockers.

## Product-by-product screen

### `income-wealthlink-gl3`

The summary wording does not reduce to plain account value. It publishes a death benefit tied to the higher of policy value and a separate basic-benefit table.

The blocker is not just implementation time. The currently extracted summary corpus does not give a stable machine-usable version of that table, so landing support now would require reconstructing a missing numeric schedule rather than reusing the current shell honestly.

### `tokio-marine-wealth-enhancer-cpfis`

The parser residue here is already pointing at the real blocker:

- `tokio-marine-wealth-enhancer-cpfis-single-premium-policy-value-tracking`

The published death-benefit corridor distinguishes single-premium policy value from top-up policy value. The current shell only carries total account value, so it cannot reproduce the protected corridor honestly without split policy-value state.

### `etiqa-invest-plus-sp`

The parser residue is also already accurate here:

- `etiqa-invest-plus-sp-death-benefit-floor`
- `etiqa-invest-plus-sp-top-up-vintage-accounting`

The published death-benefit corridor is a `101%` net-premium floor, but the product also has top-up-specific premium-charge, policy-charge, and surrender / withdrawal clocks. That means the current state is not just “gross premiums paid minus withdrawals”; it depends on top-up vintage accounting that the current shell does not retain.

### Great Eastern `Invest Advantage` family

The parser residue here still points at possible small open-ended protection corridors, but this lane does not currently have the local source PDFs needed to verify the exact death-benefit wording before making another support claim.

Without the source summaries on disk, this is not an implementation blocker we should silently guess through. It is a corpus blocker.

## Recommendation

1. Treat this follow-on group as screened out for the current shell.
2. Do not reopen `WealthLink (GL3)` without the missing basic-benefit table in the source corpus.
3. Do not reopen `TM Wealth Enhancer (CPFIS)` without split single-premium versus top-up policy-value state.
4. Do not reopen `Invest plus SP` without top-up-vintage accounting and net-premium floor state.
5. Do not reopen the Great Eastern open-ended family until the local source summaries are available for source-backed screening.
6. Treat the small current-protection lane as close to exhaustion on the current local corpus; move to a different lane unless new source material appears.
