# Property Tab Review Findings

## Original Feedback
> "I couldn't get the green button to light up for the property tab when selecting a new property purchase. Please consider adding a field for tracking annual value and computing ppty taxes. The current property tab is for own stay only so to consider adding investment property."

## Issue 1: Green Button Not Lighting Up (Bug — Likely Fixed)

Pre-household bug. The current `hasPropertyData()` in `useSectionCompletion.ts` checks `purchasePrice > 0` which is always true for both legacy defaults ($1.5M) and household defaults ($850K). This appears resolved by the household planner migration.

## Issue 2: Annual Value & Property Tax (Feature Request)

## Issue 3: Investment Property Support (Feature Request)

## Comparison: Property Tax (AV) vs Investment Property

| Dimension | Property Tax via Annual Value | Investment Property Support |
|-----------|------------------------------|----------------------------|
| **Core change** | New calculation + 1 new field | New property mode + income/tax/expense pipeline changes |
| **New fields on `PropertyPlan`** | `annualValue: number` | `purpose: 'own-stay' \| 'investment'`, `vacancyRate`, `managementFee`, `annualValue` |
| **New data file** | `lib/data/propertyTaxRates.ts` (owner-occupied brackets) | Same file, but needs **both** owner-occupied AND non-owner-occupied brackets |
| **New calc file** | `lib/calculations/propertyTax.ts` (~40 lines) | Same, plus rental income logic in `income.ts` |
| **Projection impact** | Property tax as annual expense line item | Rental income as taxable income stream; rental expenses as deductible; vacancy as variable cash flow |
| **Tax integration** | None (property tax is separate from income tax) | Rental income must flow into `tax.ts` progressive brackets |
| **Store migration** | Bump version, backfill `annualValue` default | Bump version, backfill `purpose`, `vacancyRate`, `managementFee` |
| **UI changes** | 1 new input field + computed tax display | New "Investment" tab/mode in property section, rental income config panel, ABSD warning for 2nd property |
| **Files touched** | ~5-6 | ~12-15 |
| **Risk** | Low — additive, no existing calc changes | Medium — rental income enters the projection pipeline, could affect FIRE number, MC sims |
| **Dependency** | Standalone | Needs property tax (uses non-owner-occupied rates), so includes feature 1 |
| **User value** | Moderate — property tax is $2-8K/yr, visible in projections | High — investment property is a major SG wealth strategy |

### Key Tradeoff

**Property tax** is a clean, low-risk addition that delivers immediate accuracy improvement. Every property owner pays it, so it's a missing expense line today.

**Investment property** is the higher-value feature but it's ~3x the scope and **subsumes property tax** (you need AV-based tax for both own-stay and investment, just different rate tables). It also crosses the 3-file rule, so it needs a proper plan.

### Recommendation

- **Incremental path:** Do property tax first, then extend to investment property later — the tax calculation and `annualValue` field carry forward directly.
- **All-at-once path:** Go straight to investment property since it includes property tax anyway, but budget for a proper design doc.
