## Task: Close bonus gap #2 — AstraLink VA2 investment bonus (performance-based)

### Context
The ILP fee dashboard shows fee breakdowns for catalog products. The `astralink-va2-investment-bonus` is marked as `metadataOnlyBehaviors` because it's a periodic bonus based on investment performance vs a benchmark. This is fundamentally different from rate-on-account-value bonuses.

### Phase 1: Screen and classify (do this FIRST, report before implementing)

1. Read the AstraLink VA2 product summary PDF in `/Users/tj/Downloads/pdfs` to find the exact investment bonus mechanics: trigger conditions, calculation basis, payout frequency, and any caps
2. Read the existing parser: `frontend/scripts/ilp-catalog/parsers/incomeAstralinkVa2.ts`
3. Read the template types: `frontend/src/lib/ilp-catalog/types.ts` — check if any existing bonus type/mode combination can express a performance-contingent bonus
4. Read the engine: `frontend/src/lib/calculations/ilp.ts` — search for how `bonusCredit` is computed per year and whether gross return data is accessible during bonus computation
5. Read `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — `mapTemplateBonus()` to understand the current mapping surface

Classify as:
- **(A) Parser-only** — can express as an existing bonus type (e.g., annual-rate on account value as a proxy)
- **(B) Small template extension** — needs a new field to express the performance linkage
- **(C) Engine extension** — needs access to fund return data during bonus computation
- **(D) Keep metadata-only** — performance-contingent bonus can't be honestly modeled without simulation-level changes

**Key question to answer:** Does the PDF define a fixed rate that's labeled "investment bonus" (in which case it might just be a normal annual-rate bonus with a marketing name), or does it genuinely vary with investment returns? This distinction determines whether it's (A) or (C/D).

**Report the classification with reasoning before proceeding to implementation.**

### Phase 2: Implement (after classification is approved)

**Allowed changes (in order of preference):**
1. Parser file: `frontend/scripts/ilp-catalog/parsers/incomeAstralinkVa2.ts`
2. Template types: `frontend/src/lib/ilp-catalog/types.ts` (new optional fields only, backward-compatible)
3. Mapper: `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — extend `mapTemplateBonus()`
4. Engine: `frontend/src/lib/calculations/ilp.ts` — minimal changes if needed

**If genuinely performance-contingent:** Use a simplified flat-rate approximation based on the "illustrated" or "mid" scenario rate from the PDF. Add a note in `bonus.notes[]` explaining the actual rate varies with investment performance.

**For the bonus implementation:**
- Add the bonus to `variant.bonuses[]` in the parser
- Remove `astralink-va2-investment-bonus` from `metadataOnlyBehaviors` and add to `modeledEconomics`
- Update parser test to assert `not.toContain` for the bonus ID
- Add/update `templateToPolicy.test.ts` seed proof
- Add/update `ilp.test.ts` runtime bonusCredit proof
- Rebuild catalog: `npm run -s catalog:build`
- Run focused tests: parser test, templateToPolicy test, ilp.test.ts

### Do NOT
- Modify the dashboard UI
- Build a simulation-level performance-tracking system
- Add bonus types or modes that aren't needed for this specific gap
- Skip the Phase 1 classification step

### Files to read for reference
- `frontend/src/lib/ilp-catalog/types.ts` — `IlpTemplateBonus`, `IlpTemplateBonusTier`
- `frontend/src/lib/calculations/ilp.ts` — `IlpBonusRule`, bonus computation loop
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — `mapTemplateBonus()`
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — `IlpPolicySeed`
- Existing modeled bonuses in parsers with `variant.bonuses[]` entries as reference patterns
