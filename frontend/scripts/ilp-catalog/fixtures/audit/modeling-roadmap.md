# ILP Modeling Roadmap

Generated from:
- `src/lib/data/generated/ilpCatalog.products.json`
- `scripts/ilp-catalog/fixtures/audit/outside-current-models.csv`
- `scripts/ilp-catalog/fixtures/audit/family-classification.json`

This roadmap is for deciding what to model next, not for describing every residual equally. The ranking is based on leverage:
- repeated executable mechanics first
- shared state kernels second
- claim/admin workflows after that
- persistent long-tail metadata-only behavior last

## Now

| Priority | Workstream | Why Now | Example Products | Exit Condition |
| --- | --- | --- | --- | --- |
| 1 | Broader claim-history surface | The cheap current-death / TI / one-cap TPD lane is materially burned down, and the staged current-only proof cases are now landed in `PRUActive LinkGuard` and `HSBC Life Flexi Protector`. What remains are families whose residual semantics still exceed that payable-now surface and need explicit claim history or future-runway state. | `manulife-smartretire-v-income`, `manulife-smartretire-v-sum`, Wealth Focus / InvestReady TI families | Accept or reject a broader current-only claim-history surface before reopening these families for code. |

## Next

| Priority | Workstream | Why Next | Example Products | Exit Condition |
| --- | --- | --- | --- | --- |
| 2 | Historical or future-dependent claim-state families | After the staged payable-now TPD slices landed, the remaining substantive gaps are the families already source-screened that still depend on future premium waiver, refund eligibility, or post-claim continuation history. The local source summaries for the first-screen Wealth Focus / SmartRetire / InvestReady set are now present, so the real blocker is kernel/state complexity rather than corpus absence. | `manulife-smartretire-v-income`, `manulife-smartretire-v-sum`, Wealth Focus / InvestReady TI families | Start only if the team accepts a broader claim-history surface beyond the current payable-now snapshot contract. |

## Later

| Priority | Workstream | Why Later | Example Products | Exit Condition |
| --- | --- | --- | --- | --- |
| 4 | Remaining Tokio administrative life-change residuals | The reusable current-only life-state support is already in, and the secure current-state boundary cleanups are now landed. What remains is mostly life-replacement paperwork, exclusion resets, and secure locked-in-value administration, which should stay behind heavier claim-state or fixed-charge work unless a much narrower executable slice appears. | `tokio-marine-goclassic-secure`, `tokio-marine-goelite-secure`, `tokio-marine-harvest-builder-atfuture` | Reopen only if screening reveals a concrete executable locked-in-value or approved-reduction mechanic beyond the current snapshot boundary. |

## Likely Metadata-Only

These behaviors should usually stay metadata-only unless there is a strong product or user-value reason to implement them:

- underwriting eligibility gates
- life-replacement paperwork and beneficiary reset administration
- fund switching, fund suspension, premium redirection, and fund rebalancing
- record-date processing, dividend payout operations, and payout routing administration
- minimum-withdrawal operational rules that are mostly form-validation or back-office checks
- no-claim, documentary-proof, and insurer-approval workflows

Examples with large metadata tails that should not drive the roadmap by themselves:

- `aia-pro-lifetime-protector-ii`
- `fwd-invest-first-max`
- `fwd-invest-first-summit`
- `hsbc-life-flexi-protector`
- `income-legacy-flex-solitaire`
- `tokio-marine-goassure`

## Operating Rules

Use these rules to choose the next slice:

1. Prefer one mechanic that unlocks multiple supported products over one product with a long metadata tail.
2. Stop quickly when a candidate requires new claim-state or multi-life state rather than calculator reuse.
3. Do not reopen parser-only cleanup unless a kernel slice reveals a misleading residual bucket.
4. Treat the `outside-current-models` report as a ranking input, not as a mandate to model every listed behavior.

## Immediate Recommendation

Run the next slice in this order:

1. Treat the cheap current-claim corridor lane as landed for the products already brought onto current death / TI / TPD support.
2. Treat `PRUActive LinkGuard` as the landed proof case for a staged current-only claim surface.
3. Reuse that surface only where the source wording supports a truthful payable-now snapshot.
4. Keep branches metadata-only when the remaining semantics are mostly future-timing, cease-qualification, claim-currency, or post-claim continuation logic.
5. Treat the remaining HSBC staged-TPD branch as narrowed to ADL qualification / later-release / settlement semantics rather than another payable-now slice.
6. Treat the next real kernel lane as the broader current-only claim-history surface for SmartRetire and TI-continuation families.
7. Do not reopen SmartRetire or Wealth Focus / InvestReady for broader claim-side code until the broader claim-history contract is accepted.
8. Treat the remaining reinstatement residuals as split and mostly administrative unless a narrower executable subfamily appears.
9. Treat `Invest plus SP`, `TM Wealth Enhancer (CPFIS)`, and `WealthLink (GL3)` as blocked until the missing state/table/corpus gaps are resolved.
