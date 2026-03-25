## Task: Close bonus gap #3 — Etiqa Invest Plus SP power-up bonus vintage accounting

### Context
The ILP fee dashboard shows fee breakdowns for catalog products. The `etiqa-invest-plus-sp-historical-top-up-power-up-bonus-vintage-accounting` is marked as `metadataOnlyBehaviors`. The core power-up bonus for the base policy is already modeled — this residual gap is about vintage-specific tracking for top-up premiums (each top-up gets its own bonus vintage with separate year counting).

### Phase 1: Screen and classify (do this FIRST, report before implementing)

1. Read the Etiqa Invest Plus SP product summary PDF in `/Users/tj/Downloads/pdfs` to find the exact top-up power-up bonus vintage mechanics: does each top-up start its own bonus schedule? What rates apply? How does it differ from the base power-up bonus?
2. Read the existing parser: `frontend/scripts/ilp-catalog/parsers/etiqaInvestPlusSp.ts` — see what's already modeled for the base power-up bonus
3. Read the existing parser test: `frontend/scripts/ilp-catalog/parsers/etiqaInvestPlusSp.test.ts` — note line 124 confirms this is intentionally metadata-only
4. Read the engine: `frontend/src/lib/calculations/ilp.ts` — check if the bonus computation loop tracks per-contribution vintage state, or if it only operates on aggregate account values
5. Read the template types: `frontend/src/lib/ilp-catalog/types.ts` — check if `IlpTemplateBonus` can express per-vintage bonus schedules

Classify as:
- **(A) Parser-only** — can express as a standard bonus (e.g., same rate applied to a top-up account)
- **(B) Small template extension** — needs a field to link a bonus to a specific contribution phase (top-ups only)
- **(C) Engine extension** — needs per-vintage tracking in the bonus computation loop
- **(D) Keep metadata-only** — per-top-up vintage tracking is fundamentally different from account-level bonuses, too complex for now

**Key question:** Is the top-up power-up bonus just the same rate applied to the top-up account balance (in which case it's a second bonus rule targeting the top-up account), or does each individual top-up get its own year-1-to-N schedule? The former is (A/B), the latter is (D).

**Report the classification with reasoning before proceeding to implementation.**

### Phase 2: Implement (after classification is approved)

**If classified as A or B:**

**Allowed changes (in order of preference):**
1. Parser file: `frontend/scripts/ilp-catalog/parsers/etiqaInvestPlusSp.ts`
2. Template types: `frontend/src/lib/ilp-catalog/types.ts` (new optional fields only, backward-compatible)
3. Mapper: `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — extend `mapTemplateBonus()`
4. Engine: `frontend/src/lib/calculations/ilp.ts` — minimal changes if needed

**If genuinely per-vintage:** Use a simplified approximation — apply the bonus rate to the aggregate top-up account balance rather than tracking individual top-up dates. Add a note in `bonus.notes[]` explaining the simplification.

**For the bonus implementation:**
- Add/modify the bonus in `variant.bonuses[]` in the parser
- Remove `etiqa-invest-plus-sp-historical-top-up-power-up-bonus-vintage-accounting` from `metadataOnlyBehaviors` and add to `modeledEconomics`
- Update parser test accordingly
- Add/update `templateToPolicy.test.ts` seed proof
- Add/update `ilp.test.ts` runtime bonusCredit proof
- Rebuild catalog: `npm run -s catalog:build`
- Run focused tests: parser test, templateToPolicy test, ilp.test.ts

### Do NOT
- Modify the dashboard UI
- Build per-contribution vintage date tracking in the engine
- Add bonus types or modes that aren't needed for this specific gap
- Skip the Phase 1 classification step

### Files to read for reference
- `frontend/src/lib/ilp-catalog/types.ts` — `IlpTemplateBonus`, `IlpTemplateBonusTier`
- `frontend/src/lib/calculations/ilp.ts` — `IlpBonusRule`, bonus computation loop
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — `mapTemplateBonus()`
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — `IlpPolicySeed`
- The existing Etiqa parser for base power-up bonus patterns
