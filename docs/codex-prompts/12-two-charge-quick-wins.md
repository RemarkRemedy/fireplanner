## Task: Close 2 parser-only charge gaps (HSBC Voyage premium holiday charge, Etiqa rep management charge)

### Context
The charge/fee audit identified 8 genuinely missing charges. Two of them are expressible with existing template types — no engine changes needed. These are the last quick wins before the remaining 6 require engine extensions.

---

### Gap 1: `hsbc-voyage-premium-holiday-charge-after-free-duration`

**What it is:** HSBC Wealth Voyage has a free premium-holiday window. After that window expires, a monthly premium-holiday charge applies. The parser explicitly leaves this metadata-only today.

**Phase 1: Read and confirm**
1. Read the HSBC Wealth Voyage product summary PDF in `/Users/tj/Downloads/pdfs` to find:
   - The free premium-holiday duration (months)
   - The charge rate/amount after the free window
   - The charge basis (annualised regular premium? account value? fixed amount?)
   - When it starts and stops
2. Read the existing parser: `frontend/scripts/ilp-catalog/parsers/hsbcWealthVoyage.ts` — check what premium-holiday mechanics are already modeled
3. Read the template types: `frontend/src/lib/ilp-catalog/types.ts` — check `IlpTemplateEventChargeRule` for `trigger: 'premium-holiday'` patterns
4. Read existing parsers that already model premium-holiday charges (e.g., search for `trigger: 'premium-holiday'` in other parser files) as reference patterns

**Implementation:**
- Add the premium-holiday charge as an `IlpTemplateEventChargeRule` with `trigger: 'premium-holiday'` in the parser
- Use `freeLifetimeMonths` to express the free window, then the charge rate kicks in after
- Remove `hsbc-voyage-premium-holiday-charge-after-free-duration` from `metadataOnlyBehaviors`, add to `modeledEconomics` with `branch:` prefix
- Add parser test, templateToPolicy seed proof
- If the engine already handles premium-holiday event charges with free windows, add an ilp.test.ts runtime proof showing the charge appears after the free duration

---

### Gap 2: `etiqa-invest-plus-sp-representative-management-charge`

**What it is:** A real ongoing advice/representative management charge deducted from initial and top-up account values. Currently only used indirectly inside one projected top-up bonus lane. Up to 0.75% p.a. of account value.

**Phase 1: Read and confirm**
1. Read the Etiqa Invest Plus SP product summary PDF in `/Users/tj/Downloads/pdfs` to find:
   - The charge rate (is it fixed at 0.75% or variable/tiered?)
   - Which accounts it applies to (initial only? top-up too?)
   - When it starts and stops
   - Whether it's a standard annual deduction or has special conditions
2. Read the existing parser: `frontend/scripts/ilp-catalog/parsers/etiqaInvestPlusSp.ts` — check what fee rules are already modeled and how the rep charge is referenced indirectly
3. Check if `requiresManualInput` should be set (if the rate varies by advisor arrangement)

**Implementation:**
- Add as an `IlpTemplateFeeRule` with `basis: 'account-value'` in the parser
- If the rate varies by advisor, set `requiresManualInput: true` and use a default rate (e.g., 0.75% as the published maximum)
- Apply to the correct account IDs
- Remove `etiqa-invest-plus-sp-representative-management-charge` from `metadataOnlyBehaviors`, add to `modeledEconomics` with `branch:` prefix
- Add a note explaining the rate is the published maximum and actual rate depends on advisor arrangement
- Add parser test, templateToPolicy seed proof, runtime charge proof

---

### For both gaps

After implementation:
1. Rebuild catalog: `npm run -s catalog:build`
2. Run focused tests: parser tests, templateToPolicy tests, ilp.test.ts
3. Run full suite: `npm run test -- --run`

### Files to read for reference
- `frontend/src/lib/ilp-catalog/types.ts` — `IlpTemplateFeeRule`, `IlpTemplateEventChargeRule`
- `frontend/src/lib/calculations/ilp.ts` — how event charges and fee rules are computed
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — how fee rules and event charges map to the seed
- Existing parsers with premium-holiday charges and account-value fee rules as patterns

### Do NOT
- Modify the engine (`ilp.ts`) — these should be expressible with existing charge types
- Add new fee bases or event charge types
- Skip reading the PDFs — confirm the exact rates before implementing

### Acceptance criteria
- Both charges produce non-zero values in the projection when their conditions are met
- Both IDs removed from `metadataOnlyBehaviors` and added to `modeledEconomics`
- Parser tests, seed proofs, and runtime proofs pass
- Full test suite passes
- Catalog rebuilds cleanly
- Assumptions documented in notes (rep charge rate = published max, premium holiday charge = post-free-window)
