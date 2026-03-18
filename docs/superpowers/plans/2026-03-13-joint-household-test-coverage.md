# Joint/Household Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the joint/household test gap that let 7 bugs (RC1-RC3, Seam A-D) ship untested, by adding unit tests for `mergePerAdultProjections`, healthcare aggregation, and the RC1 fallback path, plus a joint actuarial golden scenario that exercises the full pipeline.

**Architecture:** 4 tasks, each independently testable. Tasks 1-3 are unit tests targeting specific bug categories. Task 4 is a joint golden scenario that exercises the complete pipeline (projection + MC + backtest + sequence risk) for a two-adult plan. The golden is the highest-leverage addition — it would have caught 3 of the 7 bugs automatically.

**Tech Stack:** Vitest, existing test helpers (`buildJointProjection`, `makeTwoAdultFixture`, `makeCouplePlan`), golden harness (`actuarialGoldens.ts`)

**Parallelism:** Tasks 1-3 are fully independent (different test files, no shared state). Task 4 depends on none of the others but is the largest — it can run in parallel with Tasks 1-3.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/lib/calculations/__tests__/mergePerAdultProjections.test.ts` | **Create** | Unit tests for `mergePerAdultProjections`: SRS/top-up deductions (RC3), parity with per-adult sum |
| `frontend/src/lib/household/__tests__/runtimeLegacyInputs.seam.test.ts` | **Modify** | Add healthcare aggregation test (RC2) and RC1 fallback path test |
| `frontend/src/test-helpers/actuarialGoldens.ts` | **Modify** | Add joint golden scenario definition, extend `seedGoldenScenario` to accept `HouseholdPlan` directly |
| `frontend/src/test-helpers/approvedActuarialGoldenOutputs.ts` | **Modify** | Add approved golden values for the joint scenario |
| `frontend/src/test-helpers/approvedSequenceRiskParamParityOutputs.ts` | **Modify** | Add SR param parity values for the joint scenario |
| `frontend/src/lib/household/__tests__/legacyParityFixtures.ts` | **Modify** | Export `JOINT_GOLDEN_PLAN` fixture for the joint golden scenario |

---

## Chunk 1: Unit Tests (Tasks 1-3)

### Task 1: `mergePerAdultProjections` unit tests (targets RC3 + regression guard)

**Files:**
- Create: `frontend/src/lib/calculations/__tests__/mergePerAdultProjections.test.ts`
- Reference (read-only): `frontend/src/lib/calculations/income.ts:930-1131` (`mergePerAdultProjections`)
- Reference (read-only): `frontend/src/lib/household/__tests__/runtimeLegacyInputs.seam.test.ts` (for `makeTwoAdultFixture` pattern)
- Reference (read-only): `frontend/src/lib/household/compileHouseholdPlan.ts` (`compileHouseholdPlan`)

**Context:** `mergePerAdultProjections` has zero dedicated unit tests. The function sums per-adult income projections and recomputes household-level savings. RC3 was caused by this function not deducting SRS contributions and CPF voluntary top-ups from merged savings. The fix is already in place (lines 1070-1087), but no test locks it.

- [ ] **Step 1: Write test file with SRS/top-up deduction test**

Create `frontend/src/lib/calculations/__tests__/mergePerAdultProjections.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { mergePerAdultProjections } from '@/lib/calculations/income'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import type { HouseholdPlan, PlanningAdult } from '@/lib/household/types'

/**
 * Minimal two-adult fixture focused on SRS + CPF top-up deductions.
 * TJ (self): age 32, $100K salary, SRS $5K/yr, CPF SA top-up $3K/yr
 * Chloe (partner): age 30, $80K salary, SRS $3K/yr, CPF SA top-up $2K/yr
 */
function makeMergeFixture(): HouseholdPlan {
  const tj: PlanningAdult = {
    id: 'adult-tj',
    owner: 'self',
    displayName: 'TJ',
    currentAge: 32,
    retirementAge: 55,
    lifeExpectancy: 85,
    lifeStage: 'pre-fire',
    maritalStatus: 'married',
    residencyStatus: 'citizen',
    prMonths: 0,
    annualIncome: 100_000,
    annualExpenses: 30_000,
    liquidNetWorth: 200_000,
    parentSupportEnabled: false,
    lifeEventsEnabled: false,
    healthcare: {
      enabled: false,
      mediShieldLifeEnabled: false,
      ispTier: 'none',
      careShieldLifeEnabled: false,
      oopBaseAmount: 0,
      oopModel: 'fixed',
      oopInflationRate: 0,
      oopReferenceAge: 32,
      mediSaveTopUpAnnual: 0,
    },
    cpf: {
      balances: { oa: 50_000, sa: 30_000, ma: 20_000, ra: 0 },
      annualTopUps: { oa: 0, sa: 3_000, ma: 0 },
      retirementPhase: null,
      lifeActualMonthlyPayout: 0,
      lifeStartAge: 65,
      lifePlan: 'standard',
      retirementSum: 'frs',
      oaWithdrawals: [],
      cpfisEnabled: false,
      cpfisOaReturn: 0.04,
      cpfisSaReturn: 0.04,
      autoFallback: false,
      autoFallbackIncludeSA: false,
      virtualRebalancing: true,
      virtualRebalancingMode: 'from55',
    },
    srs: {
      balance: 10_000,
      annualContribution: 5_000,
      investmentReturn: 0.04,
      drawdownStartAge: 62,
      postFireEnabled: true,
    },
    taxProfile: {
      momEducation: 'degree',
      momAdjustment: 1.0,
      personalReliefs: 3_000,
      reliefBreakdown: null,
      reliefBasisAge: 32,
    },
    lifeEvents: [],
    cashSavings: 50_000,
    nonMortgageDebtTotal: 0,
    nonMortgageDebtMonthlyPayment: 0,
    insuranceDeathCoverage: 500_000,
    insuranceCICoverage: 200_000,
    insuranceDisabilityMonthly: 3_000,
    funeralCosts: 15_000,
    ciRecoveryYears: 5,
  }

  const chloe: PlanningAdult = {
    ...structuredClone(tj),
    id: 'adult-chloe',
    owner: 'partner',
    displayName: 'Chloe',
    currentAge: 30,
    retirementAge: 55,
    lifeExpectancy: 85,
    annualIncome: 80_000,
    annualExpenses: 25_000,
    liquidNetWorth: 100_000,
    cpf: {
      ...structuredClone(tj.cpf),
      balances: { oa: 30_000, sa: 20_000, ma: 15_000, ra: 0 },
      annualTopUps: { oa: 0, sa: 2_000, ma: 0 },
    },
    srs: {
      ...structuredClone(tj.srs),
      balance: 5_000,
      annualContribution: 3_000,
    },
    taxProfile: {
      ...structuredClone(tj.taxProfile),
      reliefBasisAge: 30,
    },
  }

  return {
    schemaVersion: 1,
    id: 'test-merge-fixture',
    planType: 'couple',
    planYear: 2026,
    adults: [tj, chloe],
    dependents: [],
    income: [
      {
        id: 'income-salary-tj',
        owner: 'self',
        label: "TJ's Salary",
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: 55 },
        annualAmount: 100_000,
        growthRate: 0.03,
        growthModel: 'fixed',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
        streamType: 'employment',
        salaryModel: 'simple',
        bonusMonths: 2,
        employerCpfEnabled: true,
      },
      {
        id: 'income-salary-chloe',
        owner: 'partner',
        label: "Chloe's Salary",
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'partner', startAge: 30, endAge: 55 },
        annualAmount: 80_000,
        growthRate: 0.025,
        growthModel: 'fixed',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
        streamType: 'employment',
        salaryModel: 'simple',
        bonusMonths: 1,
        employerCpfEnabled: true,
      },
    ],
    expenses: [
      {
        id: 'expense-base-living',
        owner: 'shared',
        label: 'Household Expenses',
        kind: 'base-living',
        timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: null },
        amount: 4_000,
        periodicity: 'monthly',
        retirementSpendingAdjustment: 0.8,
      },
    ],
    assets: [],
    goals: [],
    properties: [],
    assumptions: {
      fire: { fireType: 'regular', swr: 0.04, fireNumberBasis: 'retirement' },
      returns: {
        expectedReturn: 0.07,
        usePortfolioReturn: false,
        inflation: 0.025,
        expenseRatio: 0.003,
        rebalanceFrequency: 'annual',
      },
      cashReserve: {
        enabled: false,
        mode: 'months',
        fixedAmount: 0,
        months: 6,
        returnRate: 0.02,
      },
      retirementMitigation: { type: 'none' },
    },
    parityMeta: {
      source: 'legacy-individual-store-adapter',
      persistedKeyCounts: { profile: 0, income: 0, property: 0 },
      mutationCouplings: [],
    },
  }
}

describe('mergePerAdultProjections', () => {
  describe('SRS and CPF top-up deductions (RC3 regression guard)', () => {
    it('deducts both adults SRS contributions from merged annual savings', () => {
      const plan = makeMergeFixture()
      const compiled = compileHouseholdPlan(plan)
      const runtime = buildHouseholdRuntimeLegacyInputs(plan, compiled)

      const merged = mergePerAdultProjections({
        perAdultProjections: compiled.incomeByAdultId,
        adultOrder: compiled.adultOrder,
        referenceCurrentAge: runtime.profile.currentAge,
        referenceRetirementYearOffset: compiled.householdRetirementYearOffset,
        annualExpenses: runtime.profile.annualExpenses,
        inflation: runtime.profile.inflation,
        lockedAssets: runtime.profile.lockedAssets,
        expenseAdjustments: runtime.profile.expenseAdjustments,
      })

      // Year 0: both adults contribute to SRS
      const year0 = merged[0]
      expect(year0.srsContribution).toBe(5_000 + 3_000) // TJ + Chloe

      // The critical RC3 assertion: annual savings must reflect SRS + CPF top-up deductions.
      // If RC3 regresses, savings would be ~$8K + $5K higher (SRS + CPF top-ups not deducted).
      // We verify by checking that savings < totalNet - inflatedExpenses
      // (i.e., something was deducted beyond just expenses).
      const totalNet = year0.totalNet
      const inflatedExpenses = runtime.profile.annualExpenses // year 0, no inflation yet
      const savingsIfNoDeductions = totalNet - inflatedExpenses
      expect(year0.annualSavings).toBeLessThan(savingsIfNoDeductions)

      // The gap should be at least SRS contributions + CPF SA top-ups
      const minDeductions = (5_000 + 3_000) + (3_000 + 2_000) // SRS + CPF SA top-ups
      // Allow some tolerance for CPF contribution rounding
      expect(savingsIfNoDeductions - year0.annualSavings).toBeGreaterThanOrEqual(minDeductions * 0.9)
    })
  })

  describe('per-adult parity (regression guard)', () => {
    it('merged savings equal sum of per-adult savings minus household expenses', () => {
      const plan = makeMergeFixture()
      const compiled = compileHouseholdPlan(plan)
      const runtime = buildHouseholdRuntimeLegacyInputs(plan, compiled)

      const merged = mergePerAdultProjections({
        perAdultProjections: compiled.incomeByAdultId,
        adultOrder: compiled.adultOrder,
        referenceCurrentAge: runtime.profile.currentAge,
        referenceRetirementYearOffset: compiled.householdRetirementYearOffset,
        annualExpenses: runtime.profile.annualExpenses,
        inflation: runtime.profile.inflation,
        lockedAssets: runtime.profile.lockedAssets,
        expenseAdjustments: runtime.profile.expenseAdjustments,
      })

      // Verify for first 5 years: merged savings = sum(per-adult savings) - inflated expenses
      const adultIds = compiled.adultOrder
      for (let y = 0; y < 5; y++) {
        let perAdultSavingsSum = 0
        for (const id of adultIds) {
          const adultRow = compiled.incomeByAdultId[id]?.[y]
          if (adultRow) perAdultSavingsSum += adultRow.annualSavings
        }
        const inflatedExpenses = runtime.profile.annualExpenses * Math.pow(1 + runtime.profile.inflation, y)
        const expectedSavings = perAdultSavingsSum - inflatedExpenses
        expect(merged[y].annualSavings).toBeCloseTo(expectedSavings, 0)
      }
    })

    it('merged CPF balances equal sum of per-adult CPF balances', () => {
      const plan = makeMergeFixture()
      const compiled = compileHouseholdPlan(plan)
      const runtime = buildHouseholdRuntimeLegacyInputs(plan, compiled)

      const merged = mergePerAdultProjections({
        perAdultProjections: compiled.incomeByAdultId,
        adultOrder: compiled.adultOrder,
        referenceCurrentAge: runtime.profile.currentAge,
        referenceRetirementYearOffset: compiled.householdRetirementYearOffset,
        annualExpenses: runtime.profile.annualExpenses,
        inflation: runtime.profile.inflation,
      })

      // Verify at year 5: merged CPF OA+SA+MA = sum of per-adult balances
      const y = 5
      const adultIds = compiled.adultOrder
      let expectedOA = 0, expectedSA = 0, expectedMA = 0
      for (const id of adultIds) {
        const adultRow = compiled.incomeByAdultId[id]?.[y]
        if (adultRow) {
          expectedOA += adultRow.cpfOA
          expectedSA += adultRow.cpfSA
          expectedMA += adultRow.cpfMA
        }
      }
      expect(merged[y].cpfOA).toBeCloseTo(expectedOA, 0)
      expect(merged[y].cpfSA).toBeCloseTo(expectedSA, 0)
      expect(merged[y].cpfMA).toBeCloseTo(expectedMA, 0)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/calculations/__tests__/mergePerAdultProjections.test.ts`
Expected: All 3 tests PASS (the RC3 fix is already in place)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/calculations/__tests__/mergePerAdultProjections.test.ts
git commit -m "test: add mergePerAdultProjections unit tests (RC3 regression guard)"
```

---

### Task 2: Healthcare aggregation + RC1 fallback tests

**Files:**
- Modify: `frontend/src/lib/household/__tests__/runtimeLegacyInputs.seam.test.ts`
- Reference (read-only): `frontend/src/lib/household/runtimeLegacyInputs.ts:355-407` (RC1 fallback), `frontend/src/lib/household/runtimeLegacyInputs.ts:562-567` (healthcare aggregation)
- Reference (read-only): `frontend/src/lib/household/compileHouseholdPlan.ts` (compiler healthcare output)

**Context:** Two specific gaps in `runtimeLegacyInputs.seam.test.ts`:
1. **RC2 gap:** No test verifies that `healthcareCashOutlayByYear` sums both adults' healthcare. The compiler test checks per-adult output exists, but nothing asserts the runtime aggregates them.
2. **RC1 gap:** No test covers the fallback path where `currentRecurringBaseExpense === 0` (all base-living items inactive at year 0). The fix correctly falls back to `referenceAdult.annualExpenses` instead of `retirementExpenseBase`, but this is untested.

- [ ] **Step 1: Add healthcare aggregation test**

Add to `runtimeLegacyInputs.seam.test.ts`, after the existing CPF merge strategies block (after line ~524):

```typescript
describe('household adapter seam: healthcare outlay aggregation', () => {
  it('sums both adults healthcare into healthcareCashOutlayByYear', () => {
    const plan = makeTwoAdultFixture()
    // Enable healthcare for both adults with different ISP tiers
    plan.adults[0].healthcare = {
      ...plan.adults[0].healthcare,
      enabled: true,
      mediShieldLifeEnabled: true,
      ispTier: 'none',
      careShieldLifeEnabled: false,
      oopBaseAmount: 500,
      oopModel: 'fixed',
      oopInflationRate: 0,
      oopReferenceAge: plan.adults[0].currentAge,
      mediSaveTopUpAnnual: 0,
    }
    plan.adults[1].healthcare = {
      ...plan.adults[1].healthcare,
      enabled: true,
      mediShieldLifeEnabled: true,
      ispTier: 'enhanced',
      careShieldLifeEnabled: false,
      oopBaseAmount: 1_000,
      oopModel: 'fixed',
      oopInflationRate: 0,
      oopReferenceAge: plan.adults[1].currentAge,
      mediSaveTopUpAnnual: 0,
    }

    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    // Joint mode must produce a healthcareCashOutlayByYear array
    expect(result.healthcareCashOutlayByYear).toBeDefined()
    expect(result.healthcareCashOutlayByYear!.length).toBeGreaterThan(0)

    // The array must equal the compiler's row-level totals (which sum both adults)
    for (let i = 0; i < Math.min(5, result.healthcareCashOutlayByYear!.length); i++) {
      expect(result.healthcareCashOutlayByYear![i]).toBe(compiled.rows[i].healthcareCashOutlay)
    }

    // Partner has ISP-A, so the combined healthcare must exceed reference-adult-only healthcare.
    // Verify the compiler's per-adult breakdown exists and partner contributes non-trivially.
    const partnerHealthcare = compiled.healthcareByAdultId?.['adult-chloe']
    expect(partnerHealthcare).toBeDefined()
    // At least some year should have non-zero partner healthcare
    const partnerHasNonZero = partnerHealthcare?.cashOutlayByYear.some((v) => v > 0)
    expect(partnerHasNonZero).toBe(true)
  })

  it('healthcareCashOutlayByYear is undefined for single-adult plans', () => {
    const plan = makeTwoAdultFixture()
    // Convert to single-adult by removing partner
    plan.planType = 'individual'
    plan.adults = [plan.adults[0]]
    plan.income = plan.income.filter((i) => i.owner !== 'partner')
    plan.expenses = plan.expenses.filter((e) => e.owner !== 'partner')
    plan.goals = []

    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    // Single-adult plans use healthcareConfig directly, not the override array
    expect(result.healthcareCashOutlayByYear).toBeUndefined()
  })
})
```

- [ ] **Step 2: Add RC1 fallback path test**

Add to `runtimeLegacyInputs.seam.test.ts`, after the healthcare block:

```typescript
describe('household adapter seam: expense base fallback (RC1 regression guard)', () => {
  it('uses referenceAdult.annualExpenses when no base-living items are active at year 0', () => {
    const plan = makeTwoAdultFixture()
    // Move all base-living expenses to start in the future
    for (const expense of plan.expenses) {
      if (expense.kind === 'base-living') {
        expense.timing = {
          kind: 'age-range',
          owner: 'self',
          startAge: plan.adults[0].currentAge + 5,
          endAge: null,
        }
      }
    }

    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    // The fallback should use referenceAdult.annualExpenses, NOT retirementExpenseBase.
    // retirementExpenseBase includes healthcare, parentSupport, dependents, and property
    // costs — using it as annualExpenses would double-count those in projection.ts.
    // The reference adult's annualExpenses is the raw per-adult expense field.
    expect(result.profile.annualExpenses).toBe(plan.adults[0].annualExpenses)

    // Critically: annualExpenses must NOT include healthcare or parent support amounts.
    // If RC1 regresses, this would be significantly higher than the raw field.
    // (makeTwoAdultFixture has TJ with healthcare enabled + Chloe with parent support)
    const retirementExpenseBase = compiled.rows[0]?.retirementExpenseBase ?? 0
    if (retirementExpenseBase > plan.adults[0].annualExpenses) {
      // Confirm the fallback did NOT use retirementExpenseBase
      expect(result.profile.annualExpenses).not.toBe(retirementExpenseBase)
    }
  })

  it('uses active base-living sum when base-living items are active at year 0', () => {
    const plan = makeTwoAdultFixture()
    // Default fixture has base-living starting at currentAge — should be active

    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    // $4,000/month = $48,000/year from makeTwoAdultFixture's base-living
    expect(result.profile.annualExpenses).toBe(48_000)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/lib/household/__tests__/runtimeLegacyInputs.seam.test.ts`
Expected: All existing + 4 new tests PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/household/__tests__/runtimeLegacyInputs.seam.test.ts
git commit -m "test: add healthcare aggregation and RC1 fallback regression guards"
```

---

### Task 3: Downsizing ownership scaling for couple plans

**Files:**
- Modify: `frontend/src/lib/calculations/__tests__/downsizing-ownership.test.ts`
- Reference (read-only): `frontend/src/lib/household/__tests__/compileHouseholdPlan.test.ts` (`makeCouplePlan` with property options)

**Context:** The existing downsizing ownership tests all use `planType: 'individual'`. No test covers a couple plan where the property has `ownershipPercent: 0.5` and both adults contribute to CPF housing. This gap means a regression in the partner-property-ownership path would go undetected.

- [ ] **Step 1: Add couple downsizing test**

Add a new describe block to `downsizing-ownership.test.ts`:

```typescript
describe('couple plan downsizing ownership scaling', () => {
  it('scales downsizing equity injection by ownership percent in couple plan', () => {
    // Build a couple plan with shared property at 50% ownership
    const fullPlan = makeDownsizingFixture(1.0)
    const halfPlan = makeDownsizingFixture(0.5)

    // Convert both to couple plans by adding a partner adult
    for (const plan of [fullPlan, halfPlan]) {
      plan.planType = 'couple'
      const partner: PlanningAdult = {
        ...structuredClone(plan.adults[0]),
        id: 'adult-partner',
        owner: 'partner',
        displayName: 'Partner',
        maritalStatus: 'married',
        currentAge: 30,
        retirementAge: 55,
        lifeExpectancy: 85,
        annualIncome: 60_000,
        liquidNetWorth: 100_000,
      }
      plan.adults.push(partner)
      plan.income.push({
        id: 'income-partner',
        owner: 'partner',
        label: 'Partner Salary',
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'partner', startAge: 30, endAge: 55 },
        annualAmount: 60_000,
        growthRate: 0.03,
        growthModel: 'fixed',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
        streamType: 'employment',
        salaryModel: 'simple',
        bonusMonths: 2,
        employerCpfEnabled: true,
      })
    }

    const fullCompiled = compileHouseholdPlan(fullPlan)
    const halfCompiled = compileHouseholdPlan(halfPlan)

    // Check that the equity injection is scaled.
    // portfolioAdjustments is on CompiledHouseholdPlan, not on individual rows.
    const fullAdj = fullCompiled.portfolioAdjustments.find((a) => a.amount !== 0)
    const halfAdj = halfCompiled.portfolioAdjustments.find((a) => a.amount !== 0)

    expect(fullAdj).toBeDefined()
    expect(halfAdj).toBeDefined()
    // 50% ownership should produce roughly half the equity injection
    const ratio = halfAdj!.amount / fullAdj!.amount
    expect(ratio).toBeGreaterThan(0.4)
    expect(ratio).toBeLessThan(0.6)
  })
})
```

Note: The implementer should check the actual `PlanningAdult` type to ensure all required fields are present. The `makeDownsizingFixture` already creates a full adult — `structuredClone` + override is the pattern.

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx vitest run src/lib/calculations/__tests__/downsizing-ownership.test.ts`
Expected: All existing + 1 new test PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/calculations/__tests__/downsizing-ownership.test.ts
git commit -m "test: add couple plan downsizing ownership scaling test"
```

---

## Review Fixes Applied

### Round 1: Two-agent plan review

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| B1 | BLOCKER | `parityMeta.source: 'test-fixture'` fails type check | Changed to `'legacy-individual-store-adapter'` in Tasks 1 and 4 |
| B2 | BLOCKER | Task 3 accesses `portfolioAdjustments` on rows (wrong location) | Changed to `compiled.portfolioAdjustments.find(...)` |
| B3 | BLOCKER | No discriminated union for `fixtureKey`/`householdPlan` | Used discriminated union type in Task 4 |
| B4 | BLOCKER | Step ordering: scenario definition before approved output keys | Reordered: placeholder keys added first (Step 2) |
| B5 | BLOCKER | `seedGoldenScenario` return type mismatch | Updated return type to `LegacyIndividualSnapshot \| undefined` |
| W1 | WARNING | MC param parity modification is dead code | Removed from scope |
| W3 | WARNING | RC1 coverage claim inaccurate | Fixed: "6 of 7 paths" (RC1 covered by Task 2 only) |
| W4 | WARNING | `makeJointGoldenPlan` left as comment stub | Fully specified with all fields |
| S2 | SUGGESTION | Partner `maritalStatus` inconsistent | Added `maritalStatus: 'married'` in Task 3 |

### Round 2: Codex MCP review

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| B6 | BLOCKER | `ispTier: 'A'` invalid — type is `'none'\|'basic'\|'standard'\|'enhanced'` | Changed to `'enhanced'` in Tasks 2 and 4 |
| B7 | BLOCKER | PropertyPlan fixture missing required fields (`label`, `purchasePrice`, `leaseYears`, etc.) + invalid `hdbMonetizationStrategy: 'sell'` | Added all missing fields, changed strategy to `'none'` |
| B8 | BLOCKER | `useNormalizedAnalysisParity.test.ts` reads `scenario.inputs.fixtureKey` unconditionally | Added guard + step to update this file in Task 4 |
| W5 | WARNING | Golden test file path wrong (`src/test-helpers/__tests__/` → `src/lib/__goldens__/actuarialGolden.test.ts`) | Fixed |
| W6 | WARNING | Projection horizon should be ~94 (not 90) due to partner age shift | Fixed sanity check description |

---

## Chunk 2: Joint Actuarial Golden Scenario (Task 4)

### Task 4: Joint golden scenario through the full pipeline

**Files:**
- Modify: `frontend/src/test-helpers/actuarialGoldens.ts:145-476` (extend `GoldenScenarioInputs` and `seedGoldenScenario`)
- Modify: `frontend/src/test-helpers/approvedActuarialGoldenOutputs.ts` (add joint golden values)
- Modify: `frontend/src/test-helpers/approvedSequenceRiskParamParityOutputs.ts` (add SR param values)
- Modify: `frontend/src/lib/household/__tests__/legacyParityFixtures.ts` (export joint fixture)
- Modify: `frontend/src/hooks/useNormalizedAnalysisParity.test.ts` (guard `fixtureKey` access for joint scenario)

**Note:** `approvedMonteCarloParamParityOutputs.ts` is NOT modified. That file is consumed by `monteCarloParams.parity.test.ts` which uses a separate test infrastructure based on `LegacyIndividualSnapshot`. Adding a joint key there without updating that infrastructure would create dead data.

**Context:** The golden harness (`actuarialGoldens.ts`) runs full pipeline tests: store seeding → hook rendering → projection → MC → backtest → sequence risk. All 4 existing scenarios use single-adult `LegacyIndividualSnapshot` fixtures loaded via `fixtureKey`. To add a joint golden, we need to:
1. Extend `GoldenScenarioInputs` with a discriminated union to accept either `fixtureKey` or `HouseholdPlan`
2. Extend `seedGoldenScenario` to call `setPlan()` with the joint plan (instead of `fromLegacyIndividual`)
3. Create a joint fixture based on `makeTwoAdultFixture` (the seam test fixture) with healthcare + SRS + property
4. Add placeholder keys to approved output files FIRST (before scenario definition, to satisfy `GoldenScenarioId` type)
5. Generate the golden values by running the pipeline once and capturing output
6. Replace placeholder values with generated values

**Important design decisions:**
- The joint fixture exercises 6 of 7 bug paths through the full pipeline (RC2, RC3, Seam A-D). RC1 (expense fallback) is only triggered when base-living items are inactive at year 0 — the golden fixture has active base-living items, so RC1 is covered by Task 2's dedicated unit test only.
- Use `inflation: 0.025` (default, not 0) to catch dollar-basis bugs.
- Both adults should have healthcare enabled (different ISP tiers) to catch RC2.
- Both adults should have SRS contributions to catch RC3.
- Partner should have timing-shifted expenses to catch Seam A.
- Property with downsizing to catch Seam D.

- [ ] **Step 1: Create the joint golden fixture**

Add to `frontend/src/lib/household/__tests__/legacyParityFixtures.ts`:

```typescript
import type { HouseholdPlan, PlanningAdult, ExpenseItem, GoalItem } from '@/lib/household/types'

/**
 * Joint golden scenario fixture: two adults with healthcare, SRS, CPF top-ups,
 * partner timing shifts, and property with downsizing.
 *
 * Exercises 6 of 7 bug paths through the full pipeline:
 * - RC2: healthcare aggregation (both adults have different ISP tiers)
 * - RC3: SRS + CPF top-up deductions (both adults contribute)
 * - Seam A: partner timing shifts (parent support, expense adjustments)
 * - Seam B: partner life events (career break)
 * - Seam C: CPF merge strategies (different lifePlan, retirementSum)
 * - Seam D: downsizing ownership scaling (50% ownership)
 *
 * RC1 (expense fallback) is not exercised here because base-living items are
 * active at year 0. RC1 is covered by Task 2's dedicated unit test.
 */
export function makeJointGoldenPlan(): HouseholdPlan {
  const tj: PlanningAdult = {
    id: 'adult-tj',
    owner: 'self',
    displayName: 'TJ',
    currentAge: 32,
    retirementAge: 55,
    lifeExpectancy: 85,
    lifeStage: 'pre-fire',
    maritalStatus: 'married',
    residencyStatus: 'citizen',
    prMonths: 0,
    annualIncome: 100_000,
    annualExpenses: 30_000,
    liquidNetWorth: 200_000,
    parentSupportEnabled: true,
    lifeEventsEnabled: false,
    healthcare: {
      enabled: true,
      mediShieldLifeEnabled: true,
      ispTier: 'none',
      careShieldLifeEnabled: false,
      oopBaseAmount: 500,
      oopModel: 'fixed',
      oopInflationRate: 0,
      oopReferenceAge: 32,
      mediSaveTopUpAnnual: 0,
    },
    cpf: {
      balances: { oa: 50_000, sa: 30_000, ma: 20_000, ra: 0 },
      annualTopUps: { oa: 0, sa: 3_000, ma: 0 },
      retirementPhase: null,
      lifeActualMonthlyPayout: 0,
      lifeStartAge: 65,
      lifePlan: 'standard',
      retirementSum: 'frs',
      oaWithdrawals: [],
      cpfisEnabled: false,
      cpfisOaReturn: 0.04,
      cpfisSaReturn: 0.04,
      autoFallback: false,
      autoFallbackIncludeSA: false,
      virtualRebalancing: true,
      virtualRebalancingMode: 'from55',
    },
    srs: {
      balance: 10_000,
      annualContribution: 5_000,
      investmentReturn: 0.04,
      drawdownStartAge: 62,
      postFireEnabled: true,
    },
    taxProfile: {
      momEducation: 'degree',
      momAdjustment: 1.0,
      personalReliefs: 3_000,
      reliefBreakdown: null,
      reliefBasisAge: 32,
    },
    lifeEvents: [],
    cashSavings: 50_000,
    nonMortgageDebtTotal: 0,
    nonMortgageDebtMonthlyPayment: 0,
    insuranceDeathCoverage: 500_000,
    insuranceCICoverage: 200_000,
    insuranceDisabilityMonthly: 3_000,
    funeralCosts: 15_000,
    ciRecoveryYears: 5,
  }

  const chloe: PlanningAdult = {
    ...structuredClone(tj),
    id: 'adult-chloe',
    owner: 'partner',
    displayName: 'Chloe',
    currentAge: 28,
    retirementAge: 60,
    lifeExpectancy: 90,
    annualIncome: 80_000,
    annualExpenses: 25_000,
    liquidNetWorth: 100_000,
    lifeEventsEnabled: true,
    healthcare: {
      ...structuredClone(tj.healthcare),
      ispTier: 'enhanced',
      oopBaseAmount: 1_000,
      oopReferenceAge: 28,
    },
    cpf: {
      ...structuredClone(tj.cpf),
      balances: { oa: 30_000, sa: 20_000, ma: 15_000, ra: 0 },
      annualTopUps: { oa: 0, sa: 2_000, ma: 0 },
      lifePlan: 'basic',
      retirementSum: 'brs',
      virtualRebalancingMode: 'always',
    },
    srs: {
      ...structuredClone(tj.srs),
      balance: 5_000,
      annualContribution: 3_000,
    },
    taxProfile: {
      ...structuredClone(tj.taxProfile),
      momEducation: 'diploma',
      momAdjustment: 0.9,
      personalReliefs: 2_000,
      reliefBasisAge: 28,
    },
    lifeEvents: [
      {
        id: 'chloe-career-break',
        name: 'Career Break',
        startAge: 35,
        endAge: 37,
        incomeImpact: 0,
        affectedStreamIds: [],
        savingsPause: true,
        cpfPause: true,
      },
    ],
  }

  const partnerParentSupport: ExpenseItem = {
    id: 'expense-parent-support-chloe-mom',
    owner: 'partner',
    label: "Chloe's Mom Support",
    kind: 'parent-support',
    timing: { kind: 'age-range', owner: 'partner', startAge: 30, endAge: 60 },
    amount: 500,
    periodicity: 'monthly',
    growthRate: 0.02,
    growthModel: 'fixed',
  }

  const partnerExpenseAdj: ExpenseItem = {
    id: 'expense-adjustment-childcare',
    owner: 'partner',
    label: 'Childcare',
    kind: 'expense-adjustment',
    timing: { kind: 'age-range', owner: 'partner', startAge: 32, endAge: 38 },
    amount: 12_000,
    periodicity: 'annual',
  }

  const baseLiving: ExpenseItem = {
    id: 'expense-base-living-household',
    owner: 'shared',
    label: 'Household Expenses',
    kind: 'base-living',
    timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: null },
    amount: 4_000,
    periodicity: 'monthly',
    retirementSpendingAdjustment: 0.8,
  }

  const partnerGoal: GoalItem = {
    id: 'goal-chloe-education',
    owner: 'partner',
    label: "Chloe's Masters",
    kind: 'financial-goal',
    timing: { kind: 'single-age', owner: 'partner', age: 40 },
    amount: 30_000,
    durationYears: 2,
    priority: 'important',
    inflationAdjusted: false,
    category: 'education',
  }

  return {
    schemaVersion: 1,
    id: 'joint-golden-fixture',
    planType: 'couple',
    planYear: 2026,
    adults: [tj, chloe],
    dependents: [],
    income: [
      {
        id: 'income-salary-tj',
        owner: 'self',
        label: "TJ's Salary",
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'self', startAge: 32, endAge: 55 },
        annualAmount: 100_000,
        growthRate: 0.03,
        growthModel: 'fixed',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
        streamType: 'employment',
        salaryModel: 'simple',
        bonusMonths: 2,
        employerCpfEnabled: true,
      },
      {
        id: 'income-salary-chloe',
        owner: 'partner',
        label: "Chloe's Salary",
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'partner', startAge: 28, endAge: 60 },
        annualAmount: 80_000,
        growthRate: 0.025,
        growthModel: 'fixed',
        taxTreatment: 'taxable',
        isCpfApplicable: true,
        isActive: true,
        streamType: 'employment',
        salaryModel: 'simple',
        bonusMonths: 1,
        employerCpfEnabled: true,
      },
    ],
    expenses: [baseLiving, partnerParentSupport, partnerExpenseAdj],
    assets: [],
    goals: [partnerGoal],
    properties: [
      {
        id: 'property-hdb',
        owner: 'shared',
        label: 'HDB Home',
        propertyType: 'hdb',
        purchasePrice: 500_000,
        leaseYears: 99,
        appreciationRate: 0.03,
        rentalYield: 0,
        mortgageRate: 0.026,
        mortgageTerm: 25,
        ltv: 0.75,
        purchaseYearsFromNow: 0,
        residencyForAbsd: 'citizen',
        propertyCount: 1,
        ownsProperty: true,
        existingPropertyValue: 800_000,
        existingMortgageBalance: 300_000,
        existingMonthlyPayment: 1_500,
        existingMortgageRate: 0.026,
        existingMortgageRemainingYears: 20,
        mortgageCpfMonthly: 0,
        ownershipPercent: 0.5,
        existingAppreciationRate: 0.03,
        existingLeaseYears: 80,
        existingApplyBalaDecay: true,
        downsizing: {
          scenario: 'sell-and-downsize',
          sellAge: 60,
          expectedSalePrice: 1_000_000,
          newPropertyCost: 600_000,
          newMortgageRate: 0.03,
          newMortgageTerm: 20,
          newLtv: 0.75,
          monthlyRent: 0,
          rentGrowthRate: 0,
        },
        hdbFlatType: '4-room',
        hdbMonetizationStrategy: 'none',
        hdbLbsRetainedLease: 30,
        hdbSublettingRooms: 1,
        hdbSublettingRate: 800,
        hdbCpfUsedForHousing: 0,
      },
    ],
    assumptions: {
      fire: { fireType: 'regular', swr: 0.04, fireNumberBasis: 'retirement' },
      returns: {
        expectedReturn: 0.07,
        usePortfolioReturn: false,
        inflation: 0.025,
        expenseRatio: 0.003,
        rebalanceFrequency: 'annual',
      },
      cashReserve: {
        enabled: false,
        mode: 'months',
        fixedAmount: 0,
        months: 6,
        returnRate: 0.02,
      },
      retirementMitigation: { type: 'none' },
    },
    parityMeta: {
      source: 'legacy-individual-store-adapter',
      persistedKeyCounts: { profile: 0, income: 0, property: 0 },
      mutationCouplings: [],
    },
  }
}
```

- [ ] **Step 2: Add placeholder keys to approved output files FIRST**

**This must happen BEFORE the scenario definition is added.** The `GoldenScenarioId` type is derived as:
```typescript
type GoldenScenarioId =
  keyof typeof APPROVED_GOLDEN_OUTPUTS
  & keyof typeof APPROVED_SEQUENCE_RISK_PARAM_PARITY_OUTPUTS
```
If `'joint-couple'` is missing from either file, the intersection type becomes `never` and the `id: 'joint-couple'` assignment fails.

Add empty placeholder to `frontend/src/test-helpers/approvedActuarialGoldenOutputs.ts`:
```typescript
'joint-couple': {} as any, // Placeholder — will be replaced with generated values
```

Add empty placeholder to `frontend/src/test-helpers/approvedSequenceRiskParamParityOutputs.ts`:
```typescript
'joint-couple': {} as any, // Placeholder — will be replaced with generated values
```

- [ ] **Step 3: Extend the golden harness to accept HouseholdPlan fixtures**

Modify `frontend/src/test-helpers/actuarialGoldens.ts`:

1. Use a **discriminated union** for `GoldenScenarioInputs` to enforce exactly one of `fixtureKey` or `householdPlan` (line ~145):
```typescript
interface GoldenScenarioInputsBase {
  allocationTemplate: Exclude<AllocationTemplate, 'custom'>
  targetAllocationTemplate?: Exclude<AllocationTemplate, 'custom'>
  glidePathConfig?: GlidePathConfig
  withdrawalStrategy: WithdrawalStrategyType
  withdrawalBasis: 'expenses' | 'rate'
  monteCarlo: {
    method: 'parametric' | 'bootstrap' | 'fat_tail'
    nSimulations: number
    seed: number
    deterministicAccumulation: boolean
  }
  backtest: {
    swr: number
    retirementDuration: number
    dataset: BacktestConfig['dataset']
    blendRatio: number
  }
  sequenceRisk: {
    nSimulations: number
    seed: number
    crisis: CrisisScenario
  }
}

type GoldenScenarioInputs =
  | (GoldenScenarioInputsBase & { fixtureKey: LegacyFixtureKey; householdPlan?: never })
  | (GoldenScenarioInputsBase & { householdPlan: HouseholdPlan; fixtureKey?: never })
```

2. Update `GoldenScenario` interface (line ~180) to make `snapshot` optional:
```typescript
export interface GoldenScenario extends GoldenScenarioDefinition {
  snapshot?: LegacyIndividualSnapshot  // Optional — absent for joint scenarios
  expected: ActuarialGoldenExpected
}
```

3. Update `seedGoldenScenario` (line ~436) to handle both paths. Return type becomes `LegacyIndividualSnapshot | undefined`:
```typescript
function seedGoldenScenario(input: GoldenScenarioInputs): LegacyIndividualSnapshot | undefined {
  withSuppressedFixtureWarnings(() => {
    act(() => {
      localStorage.clear()
      useNormalizedAnalysisStore.getState().clearEntries()
      useHouseholdPlanStore.getState().reset()
      useAllocationStore.getState().reset()
      useSimulationStore.getState().reset()
      useWithdrawalStore.getState().reset()

      if (input.householdPlan) {
        // Joint path: set the plan directly
        useHouseholdPlanStore.getState().setPlan(input.householdPlan, {
          source: 'manual',
          initializedAt: '2026-03-13T00:00:00.000Z',
        })
      } else {
        // Legacy path: convert from individual snapshot
        const snapshot = LEGACY_PARITY_FIXTURES[input.fixtureKey]
        const plan = fromLegacyIndividual(snapshot)
        useHouseholdPlanStore.getState().setPlan(plan, {
          source: 'manual',
          initializedAt: '2026-03-13T00:00:00.000Z',
        })
      }

      const allocation = useAllocationStore.getState()
      allocation.applyTemplate(input.allocationTemplate)
      if (input.targetAllocationTemplate) {
        allocation.applyTemplate(input.targetAllocationTemplate, 'target')
      }
      if (input.glidePathConfig) {
        allocation.setGlidePathConfig(input.glidePathConfig)
      }

      const simulation = useSimulationStore.getState()
      simulation.setField('selectedStrategy', input.withdrawalStrategy)
      simulation.setField('withdrawalBasis', input.withdrawalBasis)
      simulation.setField('mcMethod', input.monteCarlo.method)
      simulation.setField('nSimulations', input.monteCarlo.nSimulations)
      simulation.setField('deterministicAccumulation', input.monteCarlo.deterministicAccumulation)

      const withdrawal = useWithdrawalStore.getState()
      withdrawal.setField('selectedStrategies', [input.withdrawalStrategy])
    })
  })

  return input.fixtureKey ? LEGACY_PARITY_FIXTURES[input.fixtureKey] : undefined
}
```

4. Update `ACTUARIAL_GOLDEN_SCENARIOS` construction (line ~661) to handle optional snapshot:
```typescript
export const ACTUARIAL_GOLDEN_SCENARIOS: GoldenScenario[] = ACTUARIAL_GOLDEN_SCENARIO_DEFINITIONS.map((definition) => ({
  ...definition,
  snapshot: definition.inputs.fixtureKey
    ? LEGACY_PARITY_FIXTURES[definition.inputs.fixtureKey]
    : undefined,
  expected: structuredClone(APPROVED_GOLDEN_OUTPUTS[definition.id]) as unknown as ActuarialGoldenExpected,
}))
```

- [ ] **Step 4: Add the joint golden scenario definition**

Add to `ACTUARIAL_GOLDEN_SCENARIO_DEFINITIONS` array in `actuarialGoldens.ts`:

```typescript
{
  id: 'joint-couple',
  description: 'Joint couple plan with healthcare, SRS, CPF top-ups, partner timing shifts, life events, and property downsizing',
  source: 'makeJointGoldenPlan()',
  approvalDate: APPROVAL_DATE,
  tolerances: GOLDEN_TOLERANCES,
  inputs: {
    householdPlan: makeJointGoldenPlan(),
    allocationTemplate: 'balanced',
    targetAllocationTemplate: 'conservative',
    glidePathConfig: {
      enabled: true,
      method: 'linear',
      startAge: 55,
      endAge: 70,
    },
    withdrawalStrategy: 'vpw',
    withdrawalBasis: 'expenses',
    monteCarlo: {
      method: 'parametric',
      nSimulations: 1500,
      seed: 77,
      deterministicAccumulation: false,
    },
    backtest: {
      swr: 0.04,
      retirementDuration: 30,
      dataset: 'blended',
      blendRatio: 0.7,
    },
    sequenceRisk: {
      nSimulations: 1200,
      seed: 54321,
      crisis: REPRESENTATIVE_CRISES.gfc,
    },
  },
},
```

Import `makeJointGoldenPlan` from `@/lib/household/__tests__/legacyParityFixtures`.

- [ ] **Step 5: Generate the golden values**

Write a temporary test that generates the actual values:

```typescript
// In a temporary test file or by modifying an existing golden test temporarily:
it.only('generate joint golden values', () => {
  const scenario = ACTUARIAL_GOLDEN_SCENARIO_DEFINITIONS.find((s) => s.id === 'joint-couple')!
  const actual = buildGoldenScenarioActual({ inputs: scenario.inputs })
  // Write to console for capture
  console.log(JSON.stringify(actual, null, 2))
})
```

Run this test, capture the output. Similarly generate SR param parity values using `buildGoldenSequenceRiskParamSurface`.

**Important:** The implementer must manually review the generated values for sanity:
- `healthcareCashOutlay` should be non-zero at most ages (both adults have healthcare)
- `annualExpenses` should grow with inflation (0.025)
- `savingsOrWithdrawal` should reflect SRS + CPF top-up deductions
- `propertyEquity` should change at the downsizing age (self age 60)
- Projection should span from age 32 to ~94 (partner life exp 90 shifted to self frame: 90 + age delta 4 = 94)

**Vitest timeout:** The existing golden tests use `20_000` ms. A joint scenario with two adults, healthcare, property, and downsizing is more expensive. If the test times out, increase to `40_000` ms for the joint scenario or globally.

- [ ] **Step 6: Replace placeholder values with generated values**

Replace the `{} as any` placeholders in:
1. `frontend/src/test-helpers/approvedActuarialGoldenOutputs.ts` — under key `'joint-couple'`
2. `frontend/src/test-helpers/approvedSequenceRiskParamParityOutputs.ts` — under key `'joint-couple'`

- [ ] **Step 7: Update `useNormalizedAnalysisParity.test.ts` to handle joint scenario**

`frontend/src/hooks/useNormalizedAnalysisParity.test.ts` line 22 unconditionally reads `scenario.inputs.fixtureKey` to get `retirementAge`. For the joint scenario (no `fixtureKey`), this will fail. Guard it:

```typescript
// Replace line 22:
const retirementAge = LEGACY_PARITY_FIXTURES[scenario.inputs.fixtureKey].profile.retirementAge
// With:
const retirementAge = scenario.inputs.fixtureKey
  ? LEGACY_PARITY_FIXTURES[scenario.inputs.fixtureKey].profile.retirementAge
  : scenario.inputs.householdPlan!.adults[0].retirementAge
```

- [ ] **Step 8: Run the full golden test suite**

Run: `cd frontend && npx vitest run src/lib/__goldens__/actuarialGolden.test.ts`
Expected: All 5 scenarios PASS (4 existing + 1 new joint)

- [ ] **Step 9: Run the full test suite to ensure no regressions**

Run: `cd frontend && npm run test`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add frontend/src/lib/household/__tests__/legacyParityFixtures.ts
git add frontend/src/test-helpers/actuarialGoldens.ts
git add frontend/src/test-helpers/approvedActuarialGoldenOutputs.ts
git add frontend/src/test-helpers/approvedSequenceRiskParamParityOutputs.ts
git add frontend/src/hooks/useNormalizedAnalysisParity.test.ts
git commit -m "test: add joint couple actuarial golden scenario

Exercises 6 of 7 bug paths (RC2-RC3, Seam A-D) through the full pipeline:
projection, Monte Carlo, backtest, and sequence risk.
RC1 is covered by Task 2's dedicated unit test."
```

---

## Parallelism Map

```
Task 1 (mergePerAdultProjections)  ──┐
Task 2 (healthcare + RC1 fallback) ──┼── All independent, run in parallel
Task 3 (couple downsizing)         ──┤
Task 4 (joint golden scenario)     ──┘
```

All 4 tasks touch different files and can run as 4 parallel subagents.

**Model selection:**
- Tasks 1-3: **sonnet** (mechanical: clear spec, 1-2 files each, test-only)
- Task 4: **opus** (integration + judgment: must extend golden harness, generate and validate multi-thousand-line golden values, ensure pipeline correctness)
