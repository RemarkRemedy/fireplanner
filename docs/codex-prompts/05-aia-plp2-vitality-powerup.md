## Task: Close bonus gap #5 — AIA Pro Lifetime Protector II Vitality PowerUp Dollar

### Context
The ILP fee dashboard shows fee breakdowns for catalog products. AIA Pro Lifetime Protector II has a Vitality-linked PowerUp Dollar bonus whose rate depends on the policyholder's AIA Vitality membership tier. There is no Vitality membership concept anywhere in the current seed or template system.

This is the first of two AIA Vitality-linked bonuses. If this implementation establishes a pattern (seed field + dashboard input), the second one (AIA Platinum Wealth Elite 2, prompt #6) should follow the same pattern.

### Phase 1: Screen and classify (do this FIRST, report before implementing)

1. Read the AIA Pro Lifetime Protector II product summary PDF in `/Users/tj/Downloads/pdfs` to find:
   - What Vitality tiers exist (e.g., Silver, Gold, Platinum)
   - What PowerUp Dollar rate applies at each tier
   - When the bonus starts/ends (policy year range)
   - Which account the bonus credits
   - Any other qualification conditions
2. Read the existing parser: `frontend/scripts/ilp-catalog/parsers/aiaProLifetimeProtector2.ts` (or similar name — glob for `*proLifetime*` or `*plp*`)
3. Read the template types: `frontend/src/lib/ilp-catalog/types.ts` — check `IlpTemplateBonus` and `IlpTemplateBonusTier` for any existing external-state fields
4. Read the seed schema: `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — check what user-provided assumption fields exist (e.g., `scheduledPayoutAssumption`, `distributionAssumption` as patterns)
5. Read the engine: `frontend/src/lib/calculations/ilp.ts` — check how `tieredRates` are resolved during bonus computation

Classify as:
- **(A) Parser-only** — can express with existing tiered rates (use tier bands as a proxy)
- **(B) Small template + seed extension** — needs a new optional Vitality tier field on the seed, tier-based rates on the template, and mapper logic to select the rate based on the seed field
- **(C) Engine extension** — needs new bonus resolution logic beyond tier lookup
- **(D) Keep metadata-only** — too entangled with external membership state

### Recommended approach (if B)

**Seed extension:**
Add an optional `vitalityStatus` field to `IlpPolicySeed`:
```typescript
vitalityStatus?: 'none' | 'silver' | 'gold' | 'platinum'
```
Default to `'silver'` when unset (conservative base tier).

**Template extension:**
Add an optional `externalTierBasis` field to `IlpTemplateBonus` (or use existing `tieredRates` with a new dimension). The bonus should have rates per Vitality tier.

**Dashboard extension (ALLOWED for this task):**
Add a minimal dropdown input that only appears when the selected catalog product has Vitality-linked bonuses. This surfaces in the policy configuration panel alongside other seed inputs (monthly contribution, premium frequency, etc.). Use the existing `requiresManualInput` pattern as reference for how the dashboard conditionally shows product-specific inputs.

**Report the classification with reasoning before proceeding to implementation.**

### Phase 2: Implement (after classification is approved)

**Allowed changes:**
1. Parser file for AIA PLP II
2. Seed schema: `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — add optional `vitalityStatus` field
3. Template types: `frontend/src/lib/ilp-catalog/types.ts` — add fields if needed for Vitality tier expression
4. Mapper: `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — extend `mapTemplateBonus()` to resolve Vitality tier from seed
5. Engine: `frontend/src/lib/calculations/ilp.ts` — if tier resolution needs engine-level changes
6. Dashboard: Add a Vitality tier dropdown that surfaces only for products with Vitality-linked bonuses. Find the component that renders seed input fields and add the dropdown there.

**For the bonus implementation:**
- Add the bonus to `variant.bonuses[]` in the parser with per-tier rates
- Remove the Vitality PowerUp Dollar from `metadataOnlyBehaviors` and add to `modeledEconomics`
- Update parser test
- Add/update `templateToPolicy.test.ts` seed proof (test with different Vitality tiers)
- Add/update `ilp.test.ts` runtime bonusCredit proof
- Rebuild catalog: `npm run -s catalog:build`
- Run focused tests

### Do NOT
- Build a full Vitality membership state machine (tier changes over time, earned vs purchased status)
- Add more than the 3-4 tiers defined in the PDF
- Skip the Phase 1 classification step

### Files to read for reference
- `frontend/src/lib/ilp-catalog/types.ts` — `IlpTemplateBonus`, `IlpTemplateBonusTier`
- `frontend/src/lib/calculations/ilp.ts` — `IlpBonusRule`, bonus computation, tieredRates resolution
- `frontend/src/lib/ilp-catalog/templateToPolicy.ts` — `mapTemplateBonus()`
- `frontend/src/lib/ilp-catalog/policySeedSchema.ts` — `IlpPolicySeed`, existing assumption patterns
- Dashboard component that renders seed configuration inputs (glob for components referencing `IlpPolicySeed` or seed input fields)
