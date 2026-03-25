## Task: Close bonus gap #1 — ManuInvest Duo welcome bonus (SA-ratio tier lookup)

### Context
The ILP fee dashboard shows fee breakdowns for catalog products. The `manuinvest-duo-welcome-bonus` is marked as `metadataOnlyBehaviors` because the welcome bonus rate depends on the sum-assured-to-premium ratio at issue time. The template type system already has `minSumAssured`/`maxSumAssured` on `IlpTemplateBonusTier` and `annualPremiumTierBasis` supports `'initial-basic-sum-assured-at-issue'` — the tier lookup machinery may already exist.

### Phase 1: Screen and classify (do this FIRST, report before implementing)

1. Read the ManuInvest Duo product summary PDF in `/Users/tj/Downloads/pdfs` to find the exact welcome bonus rates, tiers, and eligibility rules
2. Read the existing parser: `frontend/scripts/ilp-catalog/parsers/manulifeManuinvestDuo.ts`
3. Read the template types: `frontend/src/lib/ilp-catalog/types.ts` — focus on `IlpTemplateBonus`, `IlpTemplateBonusTier`, and the `annualPremiumTierBasis` field
4. Read the mapper: `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — focus on `mapTemplateBonus()` to see how tiered rates and `annualPremiumTierBasis` are resolved
5. Read the engine: `frontend/src/lib/calculations/ilp.ts` — search for `tieredRates` handling in bonus computation to see if SA-ratio tier lookup is already implemented
6. Read the seed schema: `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — check if sum assured is available in the seed (via `assuranceProfile` or otherwise)

Classify as:
- **(A) Parser-only** — current fields can express this, just need to add the bonus entry with SA-based tiers
- **(B) Small template extension** — needs new fields on `IlpTemplateBonus`/`IlpTemplateBonusTier`, plus mapper logic
- **(C) Engine extension** — needs new logic in `ilp.ts` bonus computation for SA-ratio tier resolution
- **(D) Keep metadata-only** — too complex to model now

**Report the classification with reasoning before proceeding to implementation.**

### Phase 2: Implement (after classification is approved)

**Allowed changes (in order of preference):**
1. Parser file: `frontend/scripts/ilp-catalog/parsers/manulifeManuinvestDuo.ts`
2. Template types: `frontend/src/lib/ilp-catalog/types.ts` (new optional fields only, backward-compatible)
3. Mapper: `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — extend `mapTemplateBonus()`
4. Engine: `frontend/src/lib/calculations/ilp.ts` — extend bonus tier resolution if needed

**For the bonus implementation:**
- Add the bonus to `variant.bonuses[]` in the parser
- Remove `manuinvest-duo-welcome-bonus` from `metadataOnlyBehaviors` and add to `modeledEconomics`
- Update parser test to assert `not.toContain` for the bonus ID
- Add/update `templateToPolicy.test.ts` seed proof
- Add/update `ilp.test.ts` runtime bonusCredit proof
- Rebuild catalog: `npm run -s catalog:build`
- Run focused tests: parser test, templateToPolicy test, ilp.test.ts

### Do NOT
- Modify the dashboard UI
- Add bonus types or modes that aren't needed for this specific gap
- Skip the Phase 1 classification step

### Files to read for reference
- `frontend/src/lib/ilp-catalog/types.ts` — `IlpTemplateBonus`, `IlpTemplateBonusTier`
- `frontend/src/lib/calculations/ilp.ts` — `IlpBonusRule`, bonus computation loop
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — `mapTemplateBonus()`
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — `IlpPolicySeed`
- Existing modeled bonuses in parsers with `variant.bonuses[]` entries as reference patterns
