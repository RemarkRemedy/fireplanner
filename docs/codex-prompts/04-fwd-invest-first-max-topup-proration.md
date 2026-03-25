## Task: Close bonus gap #4 — FWD Invest First Max accumulation bonus top-up proration

### Context
The ILP fee dashboard shows fee breakdowns for catalog products. The `fwd-invest-first-max-accumulation-bonus-current-year-top-up-proration` is marked as `metadataOnlyBehaviors`. The core accumulation bonus is already modeled — this residual gap is about prorating the bonus for top-ups received partway through the policy year.

### Phase 1: Screen and classify (do this FIRST, report before implementing)

1. Read the FWD Invest First Max product summary PDF in `/Users/tj/Downloads/pdfs` to find the exact proration rule: how is the accumulation bonus reduced for mid-year top-ups? Is it a simple months-remaining/12 fraction?
2. Read the existing parser: `frontend/scripts/ilp-catalog/parsers/fwdInvestFirstMax.ts` — see the already-modeled accumulation bonus
3. Read the existing parser test: `frontend/scripts/ilp-catalog/parsers/fwdInvestFirstMax.test.ts` — note line 47 confirms this proration is intentionally metadata-only
4. Read the engine: `frontend/src/lib/calculations/ilp.ts` — check if bonus computation has access to within-year timing (month of top-up) or only operates at annual granularity
5. Read the template types: `frontend/src/lib/ilp-catalog/types.ts` — check if `IlpTemplateBonus` has any proration or partial-year fields

Classify as:
- **(A) Parser-only** — proration can be expressed with existing fields (unlikely for mid-year timing)
- **(B) Small template extension** — needs a proration flag/rule on `IlpTemplateBonus`
- **(C) Engine extension** — needs within-year timing awareness in bonus computation
- **(D) Keep metadata-only** — annual simulation granularity makes mid-year proration impossible to model accurately

**Key question:** Since the simulation runs in annual steps (per CLAUDE.md), mid-year top-up timing isn't tracked. Is it worth adding a simplified proration assumption (e.g., assume mid-year = 50% proration), or is the impact too small to justify the complexity?

**Report the classification with reasoning before proceeding to implementation.**

### Phase 2: Implement (after classification is approved)

**If classified as A, B, or C:**

**Allowed changes (in order of preference):**
1. Parser file: `frontend/scripts/ilp-catalog/parsers/fwdInvestFirstMax.ts`
2. Template types: `frontend/src/lib/ilp-catalog/types.ts` (new optional fields only, backward-compatible)
3. Mapper: `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — extend `mapTemplateBonus()`
4. Engine: `frontend/src/lib/calculations/ilp.ts` — minimal changes if needed

**Simplification approach:** If mid-year timing can't be tracked, use a conservative 50% proration for the top-up portion in the year of top-up, with a note explaining the assumption.

**For the bonus implementation:**
- Modify the bonus or add a proration rule in the parser
- Remove `fwd-invest-first-max-accumulation-bonus-current-year-top-up-proration` from `metadataOnlyBehaviors` and add to `modeledEconomics`
- Update parser test accordingly
- Add/update `templateToPolicy.test.ts` seed proof
- Add/update `ilp.test.ts` runtime bonusCredit proof
- Rebuild catalog: `npm run -s catalog:build`
- Run focused tests: parser test, templateToPolicy test, ilp.test.ts

### Do NOT
- Modify the dashboard UI
- Change the simulation from annual to sub-annual steps
- Add bonus types or modes that aren't needed for this specific gap
- Skip the Phase 1 classification step

### Files to read for reference
- `frontend/src/lib/ilp-catalog/types.ts` — `IlpTemplateBonus`, `IlpTemplateBonusTier`
- `frontend/src/lib/calculations/ilp.ts` — `IlpBonusRule`, bonus computation loop
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — `mapTemplateBonus()`
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — `IlpPolicySeed`
- The existing FWD Invest First Max parser for base accumulation bonus patterns
