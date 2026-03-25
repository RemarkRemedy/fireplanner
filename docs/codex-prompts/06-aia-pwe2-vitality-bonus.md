## Task: Close bonus gap #6 — AIA Platinum Wealth Elite 2 Vitality bonus

### Context
The ILP fee dashboard shows fee breakdowns for catalog products. AIA Platinum Wealth Elite 2 has a Vitality-linked bonus whose rate depends on the policyholder's AIA Vitality membership tier.

**Prerequisite:** This prompt assumes prompt #5 (AIA Pro Lifetime Protector II Vitality PowerUp Dollar) has already been implemented, establishing:
- A `vitalityStatus` field on `IlpPolicySeed`
- Template/mapper support for Vitality tier-based bonus rates
- A dashboard dropdown for Vitality tier selection

If prompt #5 has NOT been completed yet, do that first.

### Phase 1: Screen and classify (do this FIRST, report before implementing)

1. Read the AIA Platinum Wealth Elite 2 product summary PDF in `/Users/tj/Downloads/pdfs` to find:
   - What Vitality bonus rates apply at each tier
   - When the bonus starts/ends (policy year range)
   - Which account the bonus credits
   - How it differs from the PLP II Vitality PowerUp Dollar (same mechanics or different?)
2. Read the existing parser: `frontend/scripts/ilp-catalog/parsers/aiaPlatinumWealthElite2.ts` (or similar name — glob for `*platinumWealth*` or `*pwe*`)
3. Verify that the `vitalityStatus` seed field and template support from prompt #5 exist
4. Check if the bonus mechanics match the pattern established in prompt #5, or if they need additional template/engine changes

Classify as:
- **(A) Parser-only** — same Vitality pattern as PLP II, just add the bonus entry with tier rates
- **(B) Small extension** — mostly follows the PLP II pattern but needs minor additions
- **(D) Keep metadata-only** — fundamentally different from PLP II Vitality mechanics

**Report the classification with reasoning before proceeding to implementation.**

### Phase 2: Implement (after classification is approved)

**Allowed changes:**
1. Parser file for AIA PWE 2
2. Template types if the bonus mechanics differ from PLP II (unlikely)
3. Mapper if additional mapping logic is needed (unlikely)

**For the bonus implementation:**
- Add the bonus to `variant.bonuses[]` in the parser with per-tier rates (following the PLP II pattern)
- Remove the Vitality bonus from `metadataOnlyBehaviors` and add to `modeledEconomics`
- Update parser test
- Add/update `templateToPolicy.test.ts` seed proof
- Add/update `ilp.test.ts` runtime bonusCredit proof
- Rebuild catalog: `npm run -s catalog:build`
- Run focused tests

### Do NOT
- Duplicate the Vitality infrastructure from prompt #5 — reuse it
- Modify the dashboard (prompt #5 already added the dropdown)
- Skip the Phase 1 classification step

### Files to read for reference
- The AIA PLP II parser (from prompt #5) as the reference pattern
- `frontend/src/lib/ilp-catalog/types.ts` — `IlpTemplateBonus`, `IlpTemplateBonusTier`
- `frontend/src/lib/calculations/ilp.ts` — `IlpBonusRule`, bonus computation
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — `mapTemplateBonus()`
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — `IlpPolicySeed` (should now have `vitalityStatus`)
