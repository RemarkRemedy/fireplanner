# Handover: Investment Property Support

## Context

User feedback requested: (1) annual value field + property tax computation, (2) investment property support (current property tab is own-stay only). We decided to go the **all-at-once path** — implement investment property support which subsumes property tax.

See `findings.md` for the full comparison analysis.

## What Exists Today

### PropertyPlan Interface (`lib/household/types.ts:197-229`)
Already has fields that partially support investment: `rentalYield`, `propertyCount`, `residencyForAbsd`. But there is no `purpose` field — every property is implicitly own-stay. The `rentalYield` field exists but is only used by `calculateRentalYield()` in the property analysis view, not integrated into income projection.

### Property Calculations (`lib/calculations/property.ts`)
Exports: `calculateBSD`, `calculateABSD`, `leaseDecayFactor`, `calculateLTV`, `mortgageAmortization`, `outstandingMortgageAtAge`, `calculateSellAndDownsize`, `calculateSellAndRent`, `calculateRentalYield`, `calculatePropertyNPV`. All are pure functions, well-tested.

### ABSD Rates (`lib/data/stampDutyRates.ts:25-28`)
Already structured by residency + property count: `citizen: [0, 0.20, 0.30]`, `pr: [0.05, 0.30, 0.35]`, `foreigner: [0.60, 0.60, 0.60]`. The `propertyCount` field on `PropertyPlan` drives ABSD lookup — investment properties would need `propertyCount >= 2`.

### Tax Calculation (`lib/calculations/tax.ts`)
`calculateChargeableIncome()` and `calculateProgressiveTax()` handle Singapore progressive income tax. Rental income from investment property would need to flow into chargeable income here.

### Income Projection (`lib/calculations/income.ts`)
`generateIncomeProjection()` is the main projection engine (~470 lines). It produces year-by-year rows. Rental income would need to appear as an income stream here. The household path uses `mergePerAdultProjections()` to combine per-adult projections.

### Property UI (`components/household/AssetsPropertySection.tsx`)
Renders property cards with an `ownsProperty` toggle. When ON: shows existing home fields. When OFF: shows purchase planning fields. No "investment" mode exists.

### HDB Note (`lib/calculations/hdb.ts:49`)
Comment already notes: "No property tax deductions for HDB owner-occupied. Rental income is fully taxable." — shows awareness of the distinction but no implementation.

## What Needs to Be Built

### 1. Data: Property Tax Rates (`lib/data/propertyTaxRates.ts` — NEW)
Singapore property tax uses Annual Value (AV) brackets. Two rate tables needed:

**Owner-Occupied (2024 rates):**
| AV Band | Rate |
|---------|------|
| First $8,000 | 0% |
| Next $22,000 | 4% |
| Next $10,000 | 6% |
| Next $15,000 | 10% |
| Next $15,000 | 14% |
| Next $15,000 | 20% |
| Next $15,000 | 26% |
| Above $100,000 | 32% |

**Non-Owner-Occupied (2024 rates):**
| AV Band | Rate |
|---------|------|
| First $30,000 | 12% |
| Next $15,000 | 20% |
| Next $15,000 | 28% |
| Above $60,000 | 36% |

Source: IRAS. Verify rates are current before implementing.

### 2. Types: Extend PropertyPlan (`lib/household/types.ts`)
Add to `PropertyPlan`:
```typescript
purpose: 'own-stay' | 'investment'
annualValue: number           // IRAS Annual Value for property tax
vacancyRate: number           // e.g. 0.08 for 8% vacancy
managementFeePercent: number  // e.g. 0.10 for 10% of gross rent
```

### 3. Calculation: Property Tax (`lib/calculations/propertyTax.ts` — NEW)
```typescript
calculatePropertyTax(annualValue: number, isOwnerOccupied: boolean): number
```
Progressive bracket lookup, same pattern as `calculateProgressiveTax` in `tax.ts`.

### 4. Calculation: Rental Income (`lib/calculations/property.ts` — EXTEND)
```typescript
calculateNetRentalIncome(params: {
  propertyValue: number
  rentalYield: number      // already exists on PropertyPlan
  vacancyRate: number
  managementFeePercent: number
  propertyTax: number      // from calculatePropertyTax with non-owner-occupied rates
}): { grossRental: number, netRental: number, expenses: number }
```

### 5. Income Projection Integration (`lib/calculations/income.ts`)
Rental income from investment properties needs to appear as a line item in `generateIncomeProjection()`. Key decisions:
- Rental income is **taxable** — it flows into `calculateChargeableIncome()`
- Rental income starts when property is purchased (or immediately if `ownsProperty: true`)
- Rental income grows with property appreciation (AV tracks property value loosely)
- Expenses (property tax, management fees, maintenance) are deductible against rental income

### 6. Store Migration (`stores/useHouseholdPlanStore.ts`)
Bump persist version. Migration must backfill new fields on all existing `PropertyPlan` objects:
```typescript
purpose: 'own-stay'           // existing properties are own-stay
annualValue: 0                // user must set
vacancyRate: 0.08
managementFeePercent: 0
```
Also backfill in `lib/household/assetPropertyDefaults.ts` (`createDefaultHouseholdProperty`).
Also backfill in `lib/household/fromLegacyIndividual.ts` (`mapPropertyPlan`).

### 7. UI: Property Section (`components/household/AssetsPropertySection.tsx`)
- Add `purpose` selector (own-stay vs investment) at top of each property card
- When `purpose === 'investment'`:
  - Show `annualValue` input
  - Show `vacancyRate` input (%)
  - Show `managementFeePercent` input (%)
  - Show computed property tax (non-owner-occupied rates)
  - Show computed net rental income
  - Show ABSD warning if `propertyCount >= 2`
- When `purpose === 'own-stay'`:
  - Show `annualValue` input
  - Show computed property tax (owner-occupied rates)
  - Rest of existing UI unchanged

### 8. Validation (`lib/validation/` — rules or schemas)
- `annualValue >= 0`
- `vacancyRate` between 0 and 1
- `managementFeePercent` between 0 and 1
- If `purpose === 'investment'` and `propertyCount < 2`, warn (ABSD applies to 2nd property for citizens)

### 9. Section Completion (`hooks/useSectionCompletion.ts`)
`hasPropertyData()` may need updating if new fields affect completion logic. Current logic already works for non-zero `purchasePrice`, but verify `annualValue` doesn't create a false-negative.

## Key Architecture Rules (from CLAUDE.md)

1. **Do not aggregate inputs before computing** — compute per-entity first, then merge. Each investment property's rental income is computed independently.
2. **Dollar basis must match** — property tax and rental income are in nominal terms within the projection engine. Do not mix with real-terms FIRE metrics.
3. **Singapore-specific values in `lib/data/`** — property tax brackets go in a data file, not hardcoded in the calculation.
4. **Store migration required** — new fields on `PropertyPlan` need backfill in persist migration to avoid breaking existing users' localStorage.
5. **No `any` types** in calculation files.
6. **Test every calc file** — `propertyTax.ts` needs `propertyTax.test.ts` with bracket boundary tests.

## Files Likely Touched

| File | Change |
|------|--------|
| `lib/household/types.ts` | Add fields to `PropertyPlan` |
| `lib/data/propertyTaxRates.ts` | **NEW** — owner-occupied + non-owner-occupied brackets |
| `lib/calculations/propertyTax.ts` | **NEW** — bracket-based tax calculation |
| `lib/calculations/propertyTax.test.ts` | **NEW** — boundary tests |
| `lib/calculations/property.ts` | Add `calculateNetRentalIncome` |
| `lib/calculations/property.test.ts` | Add rental income tests |
| `lib/calculations/income.ts` | Integrate rental income into projection |
| `lib/calculations/income.test.ts` | Test rental income in projection |
| `lib/calculations/tax.ts` | Ensure rental income flows into chargeable income |
| `lib/household/assetPropertyDefaults.ts` | Add defaults for new fields |
| `lib/household/fromLegacyIndividual.ts` | Backfill new fields in legacy adapter |
| `stores/useHouseholdPlanStore.ts` | Bump version + migration |
| `components/household/AssetsPropertySection.tsx` | Investment property UI mode |
| `hooks/useSectionCompletion.ts` | Verify completion logic |
| `lib/data/sources.ts` | Add IRAS property tax source |

## Parallelism Analysis

**Agent 1 (Calculations — independent):**
- `propertyTaxRates.ts` (data)
- `propertyTax.ts` + tests
- `calculateNetRentalIncome` in `property.ts` + tests

**Agent 2 (Types + Store + Defaults — sequential):**
- `PropertyPlan` type changes
- `assetPropertyDefaults.ts` defaults
- `fromLegacyIndividual.ts` backfill
- Store migration in `useHouseholdPlanStore.ts`

**Agent 3 (Integration — depends on Agent 1 + 2):**
- Income projection integration
- Tax integration
- UI in `AssetsPropertySection.tsx`
- Section completion update

## Open Questions for Brainstorming

1. Should AV be auto-estimated from property value (e.g., AV ~ 4-5% of property value for condos) or always manual input?
2. Should investment property rental income reduce the FIRE number (since it's passive income)?
3. How should multiple investment properties interact? (Each is independent, but total `propertyCount` affects ABSD)
4. Should we model mortgage interest deduction for investment properties? (Singapore does not allow this for individuals, only for companies — so probably no)
5. Property tax for HDB is owner-occupied only (no investment HDB allowed by law) — should we enforce `purpose === 'own-stay'` when `propertyType === 'hdb'`?
