## Task: Move 48 "already captured" charge/fee items from metadataOnlyBehaviors to a new coveredElsewhereBehaviors array

### Context
The ILP fee dashboard shows "Metadata-only behaviors still outside the calculator" for ALL items in `metadataOnlyBehaviors`. Currently 48 charge/fee items are in that list even though they're already captured through other mechanisms (fund OCF, EEC table, or other modeled charge rules). This misleads users into thinking fees are missing when they're not.

### What to do

1. **Add a new `coveredElsewhereBehaviors` field** to the catalog product type and schema:
   - `frontend/src/lib/ilp-catalog/types.ts` — add `coveredElsewhereBehaviors: string[]` to `IlpCatalogProduct`
   - `frontend/src/lib/ilp-catalog/schema.ts` — add to the catalog product schema
   - `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — add to `catalogSource` if it's passed through to the seed
   - `frontend/src/lib/validation/ilpSchema.ts` — add to runtime schema if needed

2. **Move the following 48 IDs** from `metadataOnlyBehaviors` to `coveredElsewhereBehaviors` in each parser file. The IDs are grouped by reason:

**Fund/NAV/OCF charges already captured through `funds[].ocf` (38):**
- `aia-elite-secure-income-5p-fund-management-charge`
- `aia-elite-secure-income-sp-fund-management-charge`
- `aia-invest-easy-cash-srs-fund-management-charge`
- `aia-invest-easy-cpf-fund-management-charge`
- `aia-pro-lifetime-protector-ii-fund-management-charge`
- `aia-platinum-retirement-elite-fund-management-charge`
- `aia-platinum-wealth-elite-2-fund-management-charge`
- `aia-platinum-wealth-legacy-fund-management-charge`
- `aia-platinum-wealth-venture-2-fund-management-charge`
- `aia-wealth-venture-fund-management-charge`
- `aia-pro-achiever-3-fund-management-charge`
- `fwd-invest-flexi-vii-fund-level-charges`
- `fwd-invest-first-max-fund-management-charge`
- `fwd-invest-first-summit-fund-management-charge`
- `fwd-invest-first-horizon-fund-level-charges`
- `fwd-invest-goal-1-fund-management-fees`
- `income-snack-investment-fund-management-fee`
- `manulife-investready-growth-fund-management-charge`
- `manuinvest-duo-fund-management-charge`
- `manulink-investor-ii-fund-management-fee`
- `manulife-smartretire-v-income-fund-management-charge`
- `manulife-smartretire-v-sum-fund-management-charge`
- `etiqa-dash-pet-plus-fund-management-fee`
- `etiqa-invest-plus-sp-fund-management-fee`
- `great-life-advantage-4-fund-level-fees`
- `great-eastern-pla-fund-level-fees`
- `great-eastern-prestige-portfolio-fund-level-fees`
- `hsbc-life-wealth-invest-cpf-fund-management-charge`
- `hsbc-life-wealth-invest-cpf-additional-ilp-sub-fund-charges`
- `hsbc-life-wealth-invest-cash-srs-fund-management-charge`
- `hsbc-life-wealth-invest-cash-srs-additional-ilp-sub-fund-charges`
- `tokio-marine-wealth-enhancer-cpfis-fund-management-fee`
- `tokio-marine-wealth-enhancer-cpfis-accounting-and-custody-fees`
- `tokio-marine-goassure-third-party-charges`
- `tokio-marine-goelite-fund-level-and-third-party-charges`
- `tokio-marine-goelite-secure-fund-level-and-third-party-charges`
- `tokio-marine-gowealth-enrich-fund-management-fee`
- `tokio-marine-gowealth-enrich-third-party-charges`

**FWD policy closure charges already captured through EEC/surrender surface (6):**
- `fwd-invest-flexi-elite-policy-closure-charge`
- `fwd-invest-flexi-vii-policy-closure-charge`
- `fwd-invest-first-max-policy-closure-charge`
- `fwd-invest-first-summit-policy-closure-charge`
- `fwd-invest-first-horizon-policy-closure-charge`
- `fwd-invest-goal-1-policy-closure-charge`

**Already captured under another modeled mechanic (4):**
- `fwd-invest-flexi-elite-premium-shortfall-charge-refund`
- `great-eastern-ilp2-choice10-fixed-fee-threshold-transition`
- `great-eastern-wa4-fixed-fee-threshold-transition`
- `great-eastern-prestige-portfolio-post-issue-fee-changes`

3. **Update the UI** in `frontend/src/components/ilp/PolicyInputForm.tsx` (around line 1182-1185):
   - Keep the existing "Metadata-only behaviors still outside the calculator" message for `metadataOnlyBehaviors`
   - Optionally add a separate line for `coveredElsewhereBehaviors`: "Covered through fund-level charges or other modeled mechanics:" — but this is lower priority. If it adds complexity, skip the UI display for `coveredElsewhereBehaviors` entirely (they just stop appearing in the "outside" message).

4. **Update the catalog build** if needed — check `frontend/scripts/ilp-catalog/` for how the manifest counts are computed. The new field should be included in the generated JSON.

5. **Update parser tests** — for each moved ID, change `expect(product.metadataOnlyBehaviors).toContain(id)` to `expect(product.coveredElsewhereBehaviors).toContain(id)` and add `expect(product.metadataOnlyBehaviors).not.toContain(id)`.

6. **Rebuild catalog:** `npm run -s catalog:build`

7. **Run full test suite:** `npm run test -- --run`

### Files to modify
- `frontend/src/lib/ilp-catalog/types.ts` — add `coveredElsewhereBehaviors: string[]` to `IlpCatalogProduct`
- `frontend/src/lib/ilp-catalog/schema.ts` — add to product schema
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — add to `catalogSource` if passed through
- `frontend/src/lib/validation/ilpSchema.ts` — add to runtime schema if passed through
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — pass through to seed's `catalogSource` if applicable
- `frontend/src/components/ilp/PolicyInputForm.tsx` — the metadata-only display (either exclude coveredElsewhere, or add a separate label)
- ~30 parser files in `frontend/scripts/ilp-catalog/parsers/` (one per affected product)
- Corresponding parser test files
- Catalog build script if it counts metadata-only items in the manifest

### Do NOT
- Move any of the 8 genuinely missing (B) items — those stay in metadataOnlyBehaviors
- Move any of the 24 correctly informational (C) items — those also stay in metadataOnlyBehaviors
- Change the engine or bonus/charge computation
- Skip the test updates — every moved ID needs its test assertion updated

### Acceptance criteria
- The 48 IDs no longer appear in `metadataOnlyBehaviors` in the generated catalog JSON
- They appear in `coveredElsewhereBehaviors` instead
- The "Metadata-only behaviors still outside the calculator" UI message no longer lists these 48 items
- All parser tests pass with updated assertions
- Full test suite passes
- Catalog rebuilds cleanly
