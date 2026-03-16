# P3: Unmapped Fields Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 6 Category 2 unmapped nudge flow fields to their store/engine targets so collected data actually affects projections.

**Architecture:** Each field follows the same pattern: add optional field to type → update engine calculation → update seed/apply layer → test. No UI changes needed (fields are already collected in nudge flows).

**Tech Stack:** TypeScript, Vitest

**Worktree:** `/Users/tj/TJDevelopment/fireplanner-setup` (branch: `feat/guided-setup-flow`)

**Spec:** `docs/superpowers/specs/2026-03-16-unmapped-nudge-fields-audit.md` Category 2

---

## File Map

| File | Action | Fields |
|------|--------|--------|
| `frontend/src/lib/types.ts:53-67` | Modify | Add 3 fields to HealthcareConfig |
| `frontend/src/lib/household/types.ts` | Modify | Add 2 fields to PlanningAdult, 1 to PropertyPlan |
| `frontend/src/lib/calculations/healthcare.ts` | Modify | ISP/CareShield premium overrides, MediSave routing |
| `frontend/src/lib/calculations/healthCheck.ts` | Modify | Configurable emergency fund target |
| `frontend/src/lib/calculations/propertyProjection.ts` | Modify | Rental income end year cutoff |
| `frontend/src/lib/calculations/projection.ts` | Modify | Insurance premium deduction |
| `frontend/src/lib/household/applyFlowValues.ts` | Modify | Wire all 6 fields |
| `frontend/src/lib/household/seedFlowValues.ts` | Modify | Seed all 6 fields |
| `frontend/src/lib/household/runtimeLegacyInputs.ts` | Modify | Pass new fields to legacy inputs |
| Test files | Modify | Tests for engine changes |

---

## Task 1: Type Changes (all 6 fields)

**Files:**
- Modify: `frontend/src/lib/types.ts:53-67` (HealthcareConfig)
- Modify: `frontend/src/lib/household/types.ts` (PlanningAdult, PropertyPlan)
- Modify: `frontend/src/lib/calculations/projection.ts:61-125` (ProjectionParams)

- [ ] **Step 1: Add 3 fields to HealthcareConfig** (`lib/types.ts`)

After `premiumInflationRate`:
```typescript
/** Override tier-based ISP premium with user-specified annual amount */
customIspPremium?: number
/** Override default CareShield Life premium with user-specified annual amount */
customCareShieldPremium?: number
/** Route premiums to MediSave deduction (true) or cash outflow (false). Default: true */
useMediSaveForPremiums?: boolean
```

- [ ] **Step 2: Add 2 fields to PlanningAdult** (`household/types.ts`)

After `insuranceDisabilityMonthly`:
```typescript
/** Annual insurance premium cost (deducted from cash flow in projection) */
annualInsurancePremiums?: number
/** Emergency fund target in months of expenses (default: 6) */
emergencyFundTarget?: number
```

- [ ] **Step 3: Add 1 field to PropertyPlan** (`household/types.ts`)

After `rentalExpensesPercent`:
```typescript
/** Age at which rental income stops (converted from calendar year at apply time) */
rentalIncomeEndAge?: number
```

- [ ] **Step 4: Add `annualInsurancePremiums` to ProfileState AND ProjectionParams**

In `lib/types.ts` `ProfileState`, after `parentSupport`:
```typescript
/** Annual insurance premium cost (deducted from cash flow in projection) */
annualInsurancePremiums?: number
```

In `lib/calculations/projection.ts` `ProjectionParams`, after `parentSupportEnabled`:
```typescript
/** Annual insurance premium deducted from cash flow (alongside parent support, healthcare) */
annualInsurancePremiums?: number
```

**IMPORTANT:** The full plumbing path is:
`PlanningAdult.annualInsurancePremiums` → `runtimeLegacyInputs` maps to `ProfileState.annualInsurancePremiums` → `buildFullProjectionParams` reads from `profile.annualInsurancePremiums` → `ProjectionParams.annualInsurancePremiums`

Task 5 (seed/apply) must wire all three links.

- [ ] **Step 5: Run type-check**

```bash
cd frontend && npm run type-check 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/household/types.ts frontend/src/lib/calculations/projection.ts
git commit -m "feat: add type fields for 6 P3 unmapped nudge flow fields"
```

---

## Task 2: Healthcare Engine Changes (ISP/CareShield overrides + MediSave routing)

**Files:**
- Modify: `frontend/src/lib/calculations/healthcare.ts`
- Modify: `frontend/src/lib/calculations/healthcare.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests to `healthcare.test.ts`:
```typescript
describe('custom premium overrides', () => {
  it('uses customIspPremium when set, ignoring tier lookup', () => { ... })
  it('falls back to tier lookup when customIspPremium is undefined', () => { ... })
  it('uses customCareShieldPremium when set', () => { ... })
  it('falls back to table lookup when customCareShieldPremium is undefined', () => { ... })
})

describe('useMediSaveForPremiums routing', () => {
  it('deducts premiums from MediSave when useMediSaveForPremiums is true (default)', () => { ... })
  it('skips MediSave deduction when useMediSaveForPremiums is false', () => { ... })
})
```

- [ ] **Step 2: Implement ISP premium override**

In `healthcare.ts` `calculateHealthcareCostAtAge()`, where ISP premium is looked up from `ISP_ADDITIONAL_PREMIUMS[effectiveTier][age]`:
- If `config.customIspPremium` is defined and > 0, use it instead of the table lookup
- The custom premium is in **today's dollars**. Do NOT apply inflation inside
  `calculateHealthcareCostAtAge` — `inflateHealthcareCost` handles future-dollar
  conversion externally. Just substitute the table value with the custom value.

- [ ] **Step 3: Implement CareShield premium override**

In `healthcare.ts` where CareShield premium is looked up from `CARESHIELD_LIFE_PREMIUMS[age]`:
- If `config.customCareShieldPremium` is defined and > 0, use it instead
- Same as ISP: custom value is in today's dollars, inflation handled externally

- [ ] **Step 4: Implement MediSave routing toggle**

**IMPORTANT:** `calculateMediSaveDeduction()` takes primitive params, not `HealthcareConfig`.
Do NOT modify its signature. Instead, handle `useMediSaveForPremiums` at the **caller level**
in `calculateHealthcareCostAtAge()`:

After the `calculateMediSaveDeduction` call (which returns `{ mediSaveDeductible, cashOutlay }`),
if `config.useMediSaveForPremiums === false`:
- Set `mediSaveDeductible = 0` (no MediSave deduction)
- Recalculate `cashOutlay = totalPremium` (user pays all premiums in cash)

This avoids modifying `calculateMediSaveDeduction`'s signature and its 3 other call sites.
The same pattern should be applied in `inflateHealthcareCost` and `calculateHealthcareLAE`
if they also route through MediSave. Read those functions to confirm.

Keep `mediSaveTopUpAnnual` credit independent of this toggle (top-ups are voluntary).

- [ ] **Step 5: Run tests**

```bash
cd frontend && npx vitest run src/lib/calculations/healthcare.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/calculations/healthcare.ts frontend/src/lib/calculations/healthcare.test.ts
git commit -m "feat: add ISP/CareShield premium overrides and MediSave routing toggle"
```

---

## Task 3: Rental Income End Age Cutoff

**Files:**
- Modify: `frontend/src/lib/calculations/propertyProjection.ts`
- Modify: `frontend/src/lib/calculations/projection.ts`
- Modify: `frontend/src/lib/household/compileHouseholdPlan.ts`

**IMPORTANT:** The rental income cutoff must be applied in THREE places:
1. `propertyProjection.ts` — property detail view
2. `projection.ts` — main projection engine (uses `params.annualRentalIncome`)
3. `compileHouseholdPlan.ts` — household compilation path

**Year→age conversion:** The nudge flow collects `rentalIncomeEndYear` (calendar year).
Convert to `rentalIncomeEndAge` at the apply boundary in `applyFlowValues.ts`:
```typescript
rentalIncomeEndAge = selfAdult.currentAge + (rentalIncomeEndYear - currentYear)
```
The engine receives an age, NOT a year. This avoids `new Date().getFullYear()` in engine code.

- [ ] **Step 1: Add `rentalIncomeEndAge` to PropertyProjectionParams** (top level, not downsizing)

- [ ] **Step 2: Apply cutoff in `generatePropertyProjection`**

`rentalIncome` is computed ONCE as a constant (line ~150, outside loop).
Apply cutoff INSIDE the per-year loop when assigning to each row:
```typescript
rentalIncome: (params.rentalIncomeEndAge != null && age >= params.rentalIncomeEndAge) ? undefined : rentalIncome,
```

- [ ] **Step 3: Add `rentalIncomeEndAge` to `ProjectionParams`**

After `annualRentalIncome`:
```typescript
/** Age at which rental income stops */
rentalIncomeEndAge?: number
```

In `projection.ts`, where `effectiveRentalIncome` is assigned (~line 597):
```typescript
const effectiveRentalIncome = (params.rentalIncomeEndAge != null && age >= params.rentalIncomeEndAge)
  ? 0
  : annualRentalIncome
```

- [ ] **Step 4: Update `compileHouseholdPlan.ts`**

In `compilePropertyCashflows`, apply the same age cutoff to rental income calculations.

- [ ] **Step 5: Pass through from callers**

- `runtimeLegacyInputs.ts` `mapProperty()`: pass `rentalIncomeEndAge` from PropertyPlan
- `toLegacyIndividual.ts` `cloneProperty()`: include `rentalIncomeEndAge`
- `projectionParams.ts` `buildFullProjectionParams()`: pass from property state

- [ ] **Step 6: Run type-check and tests**

```bash
cd frontend && npm run type-check && npx vitest run src/lib/calculations/propertyProjection.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/calculations/propertyProjection.ts frontend/src/lib/calculations/projection.ts frontend/src/lib/household/compileHouseholdPlan.ts frontend/src/lib/household/runtimeLegacyInputs.ts frontend/src/lib/household/toLegacyIndividual.ts
git commit -m "feat: add rental income end age cutoff across all projection paths"
```

---

## Task 4: Protection Engine Changes (emergency fund + insurance premiums)

**Files:**
- Modify: `frontend/src/lib/calculations/healthCheck.ts`
- Modify: `frontend/src/lib/calculations/projection.ts`

- [ ] **Step 1: Make emergency fund target configurable**

The emergency fund thresholds (greenBound: 6, amberBound: 3) are defined in
`healthBenchmarks.ts` in the `HEALTH_RATIOS` array, NOT in `healthCheck.ts`.
`computeHealthRatios` uses static `HEALTH_RATIOS` and `classifyValue` reads `meta.thresholds`.

**Approach:** Add an optional `overrides` parameter to `computeHealthRatios`:
```typescript
interface HealthCheckOverrides {
  emergencyFundTarget?: number  // months, overrides greenBound for emergency-fund ratio
}
```

In `computeHealthRatios`, when processing the `emergency-fund` ratio:
- If `overrides.emergencyFundTarget` is set, patch the thresholds before classification:
  `greenBound = target`, `amberBound = target / 2`
- Otherwise use the static thresholds from `HEALTH_RATIOS`

Read `healthCheck.ts` and `healthBenchmarks.ts` to understand the exact structure
before implementing. The key function is `classifyValue` which takes thresholds.

- [ ] **Step 2: Add insurance premium deduction to projection**

In `projection.ts`, at line ~670 where `extraExpenses` is computed:
```typescript
const insurancePremiums = params.annualInsurancePremiums ?? 0
const extraExpenses = parentSupportExpense + healthcareCashOutlay + downsizingRentExpense + insurancePremiums
```

Also add to the `inflationAdjustedExpenses` line (~663) so total expenses include insurance:
```typescript
const inflationAdjustedExpenses = baseExpenses * Math.pow(1 + inflation, year) + parentSupportExpense + downsizingRentExpense + healthcareCashOutlay + insurancePremiums
```

**NOTE:** `inflationAdjustedExpenses` covers BOTH pre-retirement and retirement phases.
Adding `insurancePremiums` to it once (line ~663) is sufficient for display/withdrawal.
`extraExpenses` (line ~670) is only for pre-retirement portfolio deduction.
Do NOT duplicate in the retirement section.

- [ ] **Step 2b: Update `compileHouseholdPlan.ts`**

In the household compilation loop, include `annualInsurancePremiums` in the recurring
expense calculation (read the file to find the exact injection point — look for where
`parentSupportExpense` or `healthcareCashOutlay` are summed).

- [ ] **Step 3: Run type-check and tests**

```bash
cd frontend && npm run type-check && npx vitest run src/lib/calculations/projection.test.ts src/lib/calculations/healthCheck.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/calculations/healthCheck.ts frontend/src/lib/calculations/projection.ts
git commit -m "feat: add configurable emergency fund target and insurance premium deduction"
```

---

## Task 5: Seed & Apply Layer (all 6 fields)

**Files:**
- Modify: `frontend/src/lib/household/applyFlowValues.ts`
- Modify: `frontend/src/lib/household/seedFlowValues.ts`
- Modify: `frontend/src/lib/household/runtimeLegacyInputs.ts`

- [ ] **Step 1: Update `applyFlowValues` healthcare case**

Add to the healthcare case after existing field mappings:
```typescript
if (typeof values.annualIspPremium === 'number') {
  healthcareUpdates.customIspPremium = values.annualIspPremium
}
if (typeof values.annualCareShieldPremium === 'number') {
  healthcareUpdates.customCareShieldPremium = values.annualCareShieldPremium
}
if (typeof values.useMediSaveForPremiums === 'boolean') {
  healthcareUpdates.useMediSaveForPremiums = values.useMediSaveForPremiums
}
```

- [ ] **Step 2: Update `applyFlowValues` protection case**

Add to the protection case:
```typescript
if (typeof values.annualInsurancePremiums === 'number') {
  adultUpdates.annualInsurancePremiums = values.annualInsurancePremiums
}
if (typeof values.emergencyFundTarget === 'number') {
  adultUpdates.emergencyFundTarget = values.emergencyFundTarget
}
```

- [ ] **Step 3: Update `applyFlowValues` property case**

Add to the property case (within the rental income section):
```typescript
if (typeof values.rentalIncomeEndYear === 'number') {
  // Convert calendar year to age at apply boundary (engine works in age-space)
  const currentYear = new Date().getFullYear()
  const endAge = selfAdult.currentAge + (values.rentalIncomeEndYear - currentYear)
  if (endAge > selfAdult.currentAge) {
    propertyUpdates.rentalIncomeEndAge = endAge
  }
}
```

Also clear on toggle-off:
```typescript
if (values.hasRentalIncome === false) {
  propertyUpdates.rentalYield = 0
  propertyUpdates.rentalExpensesPercent = 0
  propertyUpdates.rentalIncomeEndAge = undefined
}
```

- [ ] **Step 4: Update `seedFlowValues` for all 3 flows**

Healthcare seeds:
```typescript
seeds.annualIspPremium = adult.healthcare.customIspPremium ?? undefined
seeds.annualCareShieldPremium = adult.healthcare.customCareShieldPremium ?? undefined
seeds.useMediSaveForPremiums = adult.healthcare.useMediSaveForPremiums ?? true
```

Protection seeds:
```typescript
seeds.annualInsurancePremiums = adult.annualInsurancePremiums ?? 0
seeds.emergencyFundTarget = adult.emergencyFundTarget ?? 6
```

Property seeds (in rental section):
```typescript
// Reverse-compute calendar year from stored age
if (property.rentalIncomeEndAge != null) {
  const selfAdult = getSelfAdult()
  if (selfAdult) {
    const currentYear = new Date().getFullYear()
    seeds.rentalIncomeEndYear = currentYear + (property.rentalIncomeEndAge - selfAdult.currentAge)
  }
}
```

- [ ] **Step 5: Update `runtimeLegacyInputs.ts`**

Pass `annualInsurancePremiums` through to `ProjectionParams` via the profile/income mapping.
Pass healthcare custom premiums through the `HealthcareConfig` mapping.
Pass `rentalIncomeEndYear` through the property mapping.

- [ ] **Step 6: Update unmapped fields comment**

Remove the 6 newly-wired fields from the "Known unmapped fields" comment at top of `applyFlowValues.ts`.

- [ ] **Step 7: Run type-check and tests**

```bash
cd frontend && npm run type-check && npm run test
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/household/applyFlowValues.ts frontend/src/lib/household/seedFlowValues.ts frontend/src/lib/household/runtimeLegacyInputs.ts
git commit -m "feat: wire 6 P3 unmapped fields through seed/apply/runtime layer"
```

---

## Parallelism Analysis

```
Task 1 (types) ──┬──→ Task 2 (healthcare engine) ──┐
                  ├──→ Task 3 (property engine) ────┤──→ Task 5 (seed/apply) ──→ Task 6 (verify)
                  └──→ Task 4 (protection engine) ──┘
```

Tasks 2, 3, 4 are independent (different engine files). Task 5 depends on all three.

**Recommended agent split:**
- **Agent A:** Tasks 1 + 2 (types + healthcare engine) — touches `lib/types.ts`, `healthcare.ts`
- **Agent B:** Tasks 1 + 3 + 4 (types + property + protection engine) — touches `household/types.ts`, `propertyProjection.ts`, `projection.ts`, `healthCheck.ts`
- **Main thread:** Task 5 (seed/apply wiring, depends on all engine work)

Note: Task 1 types must be applied before agents start. Either commit types first, or have both agents add their type fields independently (no conflicts since they touch different interfaces).

---

## toLegacyIndividual Considerations

**Healthcare fields:** `customIspPremium`, `customCareShieldPremium`, `useMediSaveForPremiums`
are added to `HealthcareConfig`. `toLegacyIndividual` copies `adult.healthcare` with a shallow
spread, so these fields flow automatically. No additional wiring needed.

**`annualInsurancePremiums`:** Flows through `ProfileState` → `ProjectionParams`. The
`toLegacyIndividual` shortcut maps `PlanningAdult` → `ProfileState`. This mapping must
include `annualInsurancePremiums`. Add `snapshot.profile.annualInsurancePremiums = adult.annualInsurancePremiums ?? 0`
in `toLegacyIndividual.ts`.

**`rentalIncomeEndAge`:** Flows through `PropertyState` → `ProjectionParams`. Add to
`cloneProperty` in `toLegacyIndividual.ts` and to `PropertyState` type if not present.

**`emergencyFundTarget`:** Consumed by health check which reads from `PlanningAdult` directly
(not via `ProfileState`). The health check call site already has access to `PlanningAdult` data.
No `toLegacyIndividual` wiring needed.

## What This Plan Does NOT Do

- Add UI for these fields (they're already collected in nudge flows)
- Surface these fields on the Inputs page (that's P7)
