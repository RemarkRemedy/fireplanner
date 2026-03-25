# Tokio Multi-Life / Life-Assured Screen

This note records the next lane after the Tokio achievement-bonus family was closed.

Products screened:

- `tokio-marine-goaffluence`
- `tokio-marine-affluence-atfuture`
- `tokio-marine-goluxe`
- `tokio-marine-goclassic`
- `tokio-marine-atlas-wealth`
- `tokio-marine-wealth-max-ii`
- `tokio-marine-wealth-pro-ii`
- `tokio-marine-harvest-flexi`
- `tokio-marine-harvest-pro`
- `tokio-marine-wealth-flexi`
- `tokio-marine-wealth-flexi-link-5-10`
- `tokio-marine-wealth-flexi-link-3-12`
- `tokio-marine-wealth-builder-atfuture`
- `tokio-marine-harvest-max`

## Conclusion

This screen has now been partially resolved.

The non-secure Tokio advanced-death family did admit an honest first slice:

- static current multi-life last-life handling
- oldest-life MPC rating where published
- youngest-life rider age gating where published

That current-only life-state slice is now landed across the non-secure Tokio advanced-death family.

What remains is not another cheap parser-only or narrow bonus-style slice.

The shared source wording couples at least four state dimensions:

- last-life death settlement for policies with more than one life assured
- oldest-life age/sex driven MPC rating
- youngest-life rider expiry for Life Benefit Rider corridors
- change-of-life-assured administration that can recalculate MPC and reset exclusion timing

That work justified the explicit life-roster / life-state surface and the first current-only implementation. The remaining residual is now narrower: change-of-life-assured administration, life replacement, and secure locked-in-value families.

## Shared source facts

From `TML_UNYD_TPDN_CIN_Summary.pdf`:

- death benefit on multi-life policies is paid only on death of the last life assured
- Life Benefit Rider coverage on multi-life policies terminates after the 99th birthday of the youngest life assured
- Monthly Protection Charge is based on the age and sex of the oldest life assured
- if there are two or more life assureds with the same birth date and different sex, the male MPC rate is used
- change of life assured can adjust MPC based on the oldest life assured as of the effective date of change
- suicide / pre-existing-condition exclusions reference the effective date of any change of life assured

These are not isolated wording quirks in one parser. The same metadata buckets recur across many Tokio advanced-death families.

## Why this is heavier than the closed bonus lane

The closed Tokio achievement-bonus lane needed only reusable bonus timing / basis extensions.

This life-assured lane needs new state that the calculator does not currently carry:

- whether the policy is single-life or multi-life
- enough roster data to know oldest and youngest insured lives
- a way to represent change-of-life-assured events over time
- a way to distinguish last-life payout semantics from single-life payout semantics

Without that surface, modeling only one fragment would overstate support because the same products publish age-basis, payout-order, and exclusion-reset effects together.

## Smallest honest kernel candidate

The smallest honest candidate is not full death-claim modeling. It is a dedicated life-state surface with:

1. current roster summary
   - single-life vs multi-life
   - oldest age/sex for rating
   - youngest age for rider expiry
2. payout semantics
   - last-life settlement toggle for current death-benefit summaries
3. change-of-life-assured events
   - at minimum as metadata-aware current-state resets before any projected/eventful support

Even that is still materially heavier than the just-landed bonus slice.

## Recommendation

1. Treat the non-secure Tokio current-only multi-life lane as landed.
2. Keep change-of-life-assured / life-replacement administration metadata-only unless a narrower executable sub-slice appears.
3. Screen secure Tokio locked-in-value products separately rather than folding them back into this life-state family.
4. Use `tokio-secure-life-replacement-screen.md` for the current live cursor on the remaining Tokio branch.
