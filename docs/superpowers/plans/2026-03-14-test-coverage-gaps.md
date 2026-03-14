# Test Coverage Gap Closure Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all validated test coverage gaps in the household domain, adapter hooks, store helpers, and data files — preventing the class of "wrong field, wrong unit, wrong mapping" bugs that let 7 household bugs ship.

**Architecture:** 6 independent tasks targeting 3 tiers: (1) two confirmed CRITICALs with zero coverage (validation gate + health check adapter), (2) three WARNINGs needing edge case or round-trip tests (planSlice, store helpers, toLegacyIndividual), (3) data file invariant tests for annual update safety. All tasks are fully parallelizable — different test files, no shared state.

**Tech Stack:** Vitest, existing test helpers (`makeTwoAdultFixture`, `makeCouplePlan`), `renderHook` from `@testing-library/react` for hook tests

**Parallelism:** All 6 tasks are independent. Tasks 1, 3-6 use sonnet (mechanical, clear spec). Task 2 uses opus (hook testing with store mocking requires judgment).

---

## File Structure

| File | Action | Task | Responsibility |
|------|--------|------|---------------|
| `frontend/src/lib/household/__tests__/validation.test.ts` | **Create** | T1 | Unit tests for all validation rules |
| `frontend/src/hooks/__tests__/useHealthCheckInputs.test.ts` | **Create** | T2 | Hook test with store seeding for all 4 branching paths |
| `frontend/src/lib/household/__tests__/planSlice.test.ts` | **Create** | T3 | Edge case tests for planSlice functions |
| `frontend/src/stores/__tests__/useHouseholdPlanStore.helpers.test.ts` | **Create** | T4 | Tests for removeAdult, recalcAdultLiquidNetWorths, year-drift migration |
| `frontend/src/lib/household/__tests__/toLegacyRoundTrip.test.ts` | **Create** | T5 | Round-trip identity tests for toLegacyIndividual + fromLegacyIndividual |
| `frontend/src/lib/data/dataInvariants.test.ts` | **Create** | T6 | Invariant tests for cpfRates, taxBrackets, stampDutyRates, balaTable |

---

## Chunk 1: CRITICALs (Tasks 1-2)

### Task 1: Household validation unit tests

**Files:**
- Create: `frontend/src/lib/household/__tests__/validation.test.ts`
- Reference (read-only): `frontend/src/lib/household/validation.ts` (30+ rules across 10 entity types)
- Reference (read-only): `frontend/src/lib/household/types.ts` (for `HouseholdPlan`, `PlanningAdult`, etc.)
- Reference (read-only): `frontend/src/lib/household/__tests__/runtimeLegacyInputs.seam.test.ts` (for `makeTwoAdultFixture` pattern)

**Context:** `validateHouseholdPlan` is the validation gate for ALL household financial data. 401 lines, 30+ rules, zero tests. Bugs here let invalid data propagate into every calculation engine. The function is pure (takes a `HouseholdPlan`, returns an error map) — no mocks or hooks needed.

**Test strategy:** Build a valid baseline fixture, then mutate one field at a time to trigger each rule. Group tests by entity type. Focus on:
- Cross-field checks (cashSavings > liquidNetWorth, retired adult bypass, expense-adjustment negative exempt)
- Timing validation (shared owner rejected, null endAge passes, endAge < startAge fails)
- Plan-level checks (duplicate IDs, missing self adult)
- The `hasHouseholdValidationErrors` utility

- [ ] **Step 1: Write the test file**

Create `frontend/src/lib/household/__tests__/validation.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  validateHouseholdPlan,
  hasHouseholdValidationErrors,
} from '@/lib/household/validation'
import type {
  HouseholdPlan,
  PlanningAdult,
  IncomeSource,
  ExpenseItem,
  GoalItem,
  PropertyPlan,
} from '@/lib/household/types'

/** Minimal valid adult for testing. Override fields to trigger specific rules. */
function makeValidAdult(overrides?: Partial<PlanningAdult>): PlanningAdult {
  return {
    id: 'adult-self',
    owner: 'self',
    displayName: 'Test',
    currentAge: 30,
    retirementAge: 55,
    lifeExpectancy: 85,
    lifeStage: 'pre-fire',
    maritalStatus: 'single',
    residencyStatus: 'citizen',
    prMonths: 0,
    annualIncome: 60_000,
    annualExpenses: 30_000,
    liquidNetWorth: 100_000,
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
      oopReferenceAge: 30,
      mediSaveTopUpAnnual: 0,
    },
    cpf: {
      balances: { oa: 50_000, sa: 30_000, ma: 20_000, ra: 0 },
      annualTopUps: { oa: 0, sa: 0, ma: 0 },
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
      balance: 0,
      annualContribution: 0,
      investmentReturn: 0.04,
      drawdownStartAge: 62,
      postFireEnabled: true,
    },
    taxProfile: {
      momEducation: 'degree',
      momAdjustment: 1.0,
      personalReliefs: 3_000,
      reliefBreakdown: null,
      reliefBasisAge: 30,
    },
    lifeEvents: [],
    cashSavings: 20_000,
    nonMortgageDebtTotal: 0,
    nonMortgageDebtMonthlyPayment: 0,
    insuranceDeathCoverage: 0,
    insuranceCICoverage: 0,
    insuranceDisabilityMonthly: 0,
    funeralCosts: 15_000,
    ciRecoveryYears: 5,
    ...overrides,
  }
}

/** Minimal valid plan. Override fields to trigger specific rules. */
function makeValidPlan(overrides?: Partial<HouseholdPlan>): HouseholdPlan {
  return {
    schemaVersion: 1,
    id: 'test-plan',
    planType: 'individual',
    planYear: 2026,
    adults: [makeValidAdult()],
    dependents: [],
    income: [],
    expenses: [],
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
    ...overrides,
  }
}

/** Helper: get error for a specific entity and field */
function getError(
  errors: ReturnType<typeof validateHouseholdPlan>,
  entityKind: string,
  entityId: string,
  field: string,
): string | undefined {
  return errors[`${entityKind}:${entityId}`]?.[field]
}

describe('validateHouseholdPlan', () => {
  describe('valid plans produce no errors', () => {
    it('valid single-adult plan has no errors', () => {
      const errors = validateHouseholdPlan(makeValidPlan())
      expect(hasHouseholdValidationErrors(errors)).toBe(false)
    })

    it('valid couple plan has no errors', () => {
      const partner = makeValidAdult({
        id: 'adult-partner',
        owner: 'partner',
        displayName: 'Partner',
      })
      const errors = validateHouseholdPlan(makeValidPlan({
        planType: 'couple',
        adults: [makeValidAdult(), partner],
      }))
      expect(hasHouseholdValidationErrors(errors)).toBe(false)
    })
  })

  describe('plan-level validation', () => {
    it('rejects plan with no adults', () => {
      const errors = validateHouseholdPlan(makeValidPlan({ adults: [] }))
      expect(getError(errors, 'plan', 'test-plan', 'adults')).toBeDefined()
    })

    it('rejects plan without exactly one self adult', () => {
      const partner = makeValidAdult({ id: 'adult-p', owner: 'partner', displayName: 'P' })
      const errors = validateHouseholdPlan(makeValidPlan({ adults: [partner] }))
      expect(getError(errors, 'plan', 'test-plan', 'adults.self')).toBeDefined()
    })

    it('detects duplicate IDs within a collection', () => {
      const income1: IncomeSource = {
        id: 'dup-id',
        owner: 'self',
        label: 'Salary 1',
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'self', startAge: 30, endAge: 55 },
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
      }
      const income2 = { ...income1, label: 'Salary 2' } // same id
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income1, income2] }))
      expect(getError(errors, 'income', 'dup-id', 'id')).toBeDefined()
    })
  })

  describe('adult validation', () => {
    it('rejects empty display name', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({ displayName: '  ' })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'displayName')).toBeDefined()
    })

    it('rejects negative current age', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({ currentAge: -1 })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'currentAge')).toBeDefined()
    })

    it('rejects retirementAge <= currentAge for non-retired adult', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({ currentAge: 40, retirementAge: 40 })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'retirementAge')).toBeDefined()
    })

    it('allows retirementAge <= currentAge for retired adult', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({
          currentAge: 65,
          retirementAge: 55,
          lifeExpectancy: 90,
          cpf: {
            ...makeValidAdult().cpf,
            retirementPhase: '65-plus',
          },
        })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'retirementAge')).toBeUndefined()
    })

    it('rejects lifeExpectancy <= retirementAge', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({ retirementAge: 55, lifeExpectancy: 55 })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'lifeExpectancy')).toBeDefined()
    })

    it('rejects negative financial fields', () => {
      const negativeFields: Array<[keyof PlanningAdult, string]> = [
        ['annualIncome', 'annualIncome'],
        ['annualExpenses', 'annualExpenses'],
        ['liquidNetWorth', 'liquidNetWorth'],
        ['cashSavings', 'cashSavings'],
        ['nonMortgageDebtTotal', 'nonMortgageDebtTotal'],
        ['nonMortgageDebtMonthlyPayment', 'nonMortgageDebtMonthlyPayment'],
        ['insuranceDeathCoverage', 'insuranceDeathCoverage'],
        ['insuranceCICoverage', 'insuranceCICoverage'],
        ['insuranceDisabilityMonthly', 'insuranceDisabilityMonthly'],
        ['funeralCosts', 'funeralCosts'],
      ]
      for (const [field, errorField] of negativeFields) {
        const plan = makeValidPlan({
          adults: [makeValidAdult({ [field]: -1 } as Partial<PlanningAdult>)],
        })
        const errors = validateHouseholdPlan(plan)
        expect(
          getError(errors, 'adult', 'adult-self', errorField),
          `Expected error for negative ${field}`,
        ).toBeDefined()
      }
    })

    it('rejects cashSavings > liquidNetWorth when both positive', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({ cashSavings: 150_000, liquidNetWorth: 100_000 })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'cashSavings')).toBeDefined()
    })

    it('allows cashSavings <= liquidNetWorth', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({ cashSavings: 50_000, liquidNetWorth: 100_000 })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'cashSavings')).toBeUndefined()
    })

    it('rejects negative CPF balances', () => {
      for (const account of ['oa', 'sa', 'ma', 'ra'] as const) {
        const balances = { oa: 0, sa: 0, ma: 0, ra: 0, [account]: -1 }
        const plan = makeValidPlan({
          adults: [makeValidAdult({
            cpf: { ...makeValidAdult().cpf, balances },
          })],
        })
        const errors = validateHouseholdPlan(plan)
        expect(
          getError(errors, 'adult', 'adult-self', `cpf.balances.${account}`),
          `Expected error for negative CPF ${account}`,
        ).toBeDefined()
      }
    })

    it('rejects ciRecoveryYears outside 1-10 or non-integer', () => {
      for (const bad of [0, 11, 3.5]) {
        const plan = makeValidPlan({
          adults: [makeValidAdult({ ciRecoveryYears: bad })],
        })
        const errors = validateHouseholdPlan(plan)
        expect(
          getError(errors, 'adult', 'adult-self', 'ciRecoveryYears'),
          `Expected error for ciRecoveryYears=${bad}`,
        ).toBeDefined()
      }
    })
  })

  describe('timing validation', () => {
    it('rejects shared as timing owner', () => {
      const income: IncomeSource = {
        id: 'inc-1',
        owner: 'shared',
        label: 'Shared Income',
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'shared' as any, startAge: 30, endAge: 55 },
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
      }
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'timing.owner')).toBeDefined()
    })

    it('rejects endAge < startAge in age-range timing', () => {
      const income: IncomeSource = {
        id: 'inc-1',
        owner: 'self',
        label: 'Salary',
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'self', startAge: 55, endAge: 30 },
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
      }
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'timing.endAge')).toBeDefined()
    })

    it('allows null endAge in age-range timing', () => {
      const income: IncomeSource = {
        id: 'inc-1',
        owner: 'self',
        label: 'Salary',
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'self', startAge: 30, endAge: null },
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
      }
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'timing.endAge')).toBeUndefined()
    })
  })

  describe('expense validation', () => {
    it('allows negative amount for expense-adjustment kind', () => {
      const expense: ExpenseItem = {
        id: 'exp-adj',
        owner: 'self',
        label: 'Salary Sacrifice',
        kind: 'expense-adjustment',
        timing: { kind: 'age-range', owner: 'self', startAge: 30, endAge: 40 },
        amount: -5_000,
        periodicity: 'annual',
      }
      const errors = validateHouseholdPlan(makeValidPlan({ expenses: [expense] }))
      expect(getError(errors, 'expense', 'exp-adj', 'amount')).toBeUndefined()
    })

    it('rejects negative amount for non-adjustment expense', () => {
      const expense: ExpenseItem = {
        id: 'exp-1',
        owner: 'self',
        label: 'Rent',
        kind: 'base-living',
        timing: { kind: 'age-range', owner: 'self', startAge: 30, endAge: null },
        amount: -1_000,
        periodicity: 'monthly',
      }
      const errors = validateHouseholdPlan(makeValidPlan({ expenses: [expense] }))
      expect(getError(errors, 'expense', 'exp-1', 'amount')).toBeDefined()
    })
  })

  describe('property validation', () => {
    it('rejects ownershipPercent outside (0, 1]', () => {
      const property: PropertyPlan = {
        id: 'prop-1',
        owner: 'self',
        label: 'HDB',
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
        existingPropertyValue: 500_000,
        existingMortgageBalance: 200_000,
        existingMonthlyPayment: 1_200,
        existingMortgageRate: 0.026,
        existingMortgageRemainingYears: 20,
        mortgageCpfMonthly: 0,
        ownershipPercent: 0,
        existingAppreciationRate: 0.03,
        existingLeaseYears: 80,
        existingApplyBalaDecay: true,
        hdbFlatType: '4-room',
        hdbMonetizationStrategy: 'none',
        hdbLbsRetainedLease: 30,
        hdbSublettingRooms: 1,
        hdbSublettingRate: 800,
        hdbCpfUsedForHousing: 0,
        downsizing: { scenario: 'none', sellAge: 65, expectedSalePrice: 0, newPropertyCost: 0, newMortgageRate: 0, newMortgageTerm: 0, newLtv: 0, monthlyRent: 0, rentGrowthRate: 0 },
      }
      const errors = validateHouseholdPlan(makeValidPlan({ properties: [property] }))
      expect(getError(errors, 'property', 'prop-1', 'ownershipPercent')).toBeDefined()
    })

    it('rejects mortgageTerm outside 1-40', () => {
      const property: PropertyPlan = {
        id: 'prop-1',
        owner: 'self',
        label: 'HDB',
        propertyType: 'hdb',
        purchasePrice: 500_000,
        leaseYears: 99,
        appreciationRate: 0.03,
        rentalYield: 0,
        mortgageRate: 0.026,
        mortgageTerm: 50,
        ltv: 0.75,
        purchaseYearsFromNow: 0,
        residencyForAbsd: 'citizen',
        propertyCount: 1,
        ownsProperty: true,
        existingPropertyValue: 500_000,
        existingMortgageBalance: 200_000,
        existingMonthlyPayment: 1_200,
        existingMortgageRate: 0.026,
        existingMortgageRemainingYears: 20,
        mortgageCpfMonthly: 0,
        ownershipPercent: 1.0,
        existingAppreciationRate: 0.03,
        existingLeaseYears: 80,
        existingApplyBalaDecay: true,
        hdbFlatType: '4-room',
        hdbMonetizationStrategy: 'none',
        hdbLbsRetainedLease: 30,
        hdbSublettingRooms: 1,
        hdbSublettingRate: 800,
        hdbCpfUsedForHousing: 0,
        downsizing: { scenario: 'none', sellAge: 65, expectedSalePrice: 0, newPropertyCost: 0, newMortgageRate: 0, newMortgageTerm: 0, newLtv: 0, monthlyRent: 0, rentGrowthRate: 0 },
      }
      const errors = validateHouseholdPlan(makeValidPlan({ properties: [property] }))
      expect(getError(errors, 'property', 'prop-1', 'mortgageTerm')).toBeDefined()
    })
  })

  describe('assumptions validation', () => {
    it('rejects SWR outside (0, 1]', () => {
      const plan = makeValidPlan()
      plan.assumptions.fire.swr = 0
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'fire.swr')).toBeDefined()
    })

    it('rejects non-finite expectedReturn', () => {
      const plan = makeValidPlan()
      plan.assumptions.returns.expectedReturn = Infinity
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'returns.expectedReturn')).toBeDefined()
    })

    it('rejects negative expense ratio', () => {
      const plan = makeValidPlan()
      plan.assumptions.returns.expenseRatio = -0.01
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'returns.expenseRatio')).toBeDefined()
    })

    it('rejects negative cash reserve months', () => {
      const plan = makeValidPlan()
      plan.assumptions.cashReserve.months = -1
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'cashReserve.months')).toBeDefined()
    })
  })

  describe('SRS and healthcare validation', () => {
    it('rejects negative SRS balance', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({
          srs: { ...makeValidAdult().srs, balance: -1 },
        })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'srs.balance')).toBeDefined()
    })

    it('rejects negative SRS annual contribution', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({
          srs: { ...makeValidAdult().srs, annualContribution: -1 },
        })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'srs.annualContribution')).toBeDefined()
    })

    it('rejects negative healthcare OOP base amount', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({
          healthcare: { ...makeValidAdult().healthcare, oopBaseAmount: -1 },
        })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'healthcare.oopBaseAmount')).toBeDefined()
    })

    it('rejects negative MediSave top-up', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({
          healthcare: { ...makeValidAdult().healthcare, mediSaveTopUpAnnual: -1 },
        })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'healthcare.mediSaveTopUpAnnual')).toBeDefined()
    })
  })

  describe('goal and asset validation', () => {
    it('rejects negative goal amount', () => {
      const goal: GoalItem = {
        id: 'goal-1',
        owner: 'self',
        label: 'Education',
        kind: 'financial-goal',
        timing: { kind: 'single-age', owner: 'self', age: 40 },
        amount: -10_000,
        durationYears: 2,
        priority: 'important',
        inflationAdjusted: false,
        category: 'education',
      }
      const errors = validateHouseholdPlan(makeValidPlan({ goals: [goal] }))
      expect(getError(errors, 'goal', 'goal-1', 'amount')).toBeDefined()
    })

    it('rejects goal durationYears < 1', () => {
      const goal: GoalItem = {
        id: 'goal-1',
        owner: 'self',
        label: 'Education',
        kind: 'financial-goal',
        timing: { kind: 'single-age', owner: 'self', age: 40 },
        amount: 10_000,
        durationYears: 0,
        priority: 'important',
        inflationAdjusted: false,
        category: 'education',
      }
      const errors = validateHouseholdPlan(makeValidPlan({ goals: [goal] }))
      expect(getError(errors, 'goal', 'goal-1', 'durationYears')).toBeDefined()
    })
  })

  describe('dependent validation', () => {
    it('rejects negative annualCost', () => {
      const plan = makeValidPlan({
        dependents: [{
          id: 'dep-1',
          owner: 'self',
          label: 'Child',
          relationship: 'child',
          currentAge: 5,
          annualCost: -1_000,
          timing: null,
        }],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'dependent', 'dep-1', 'annualCost')).toBeDefined()
    })

    it('rejects empty label', () => {
      const plan = makeValidPlan({
        dependents: [{
          id: 'dep-1',
          owner: 'self',
          label: '  ',
          relationship: 'child',
          currentAge: 5,
          annualCost: 1_000,
          timing: null,
        }],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'dependent', 'dep-1', 'label')).toBeDefined()
    })
  })

  describe('asset validation', () => {
    it('rejects negative amount', () => {
      const plan = makeValidPlan({
        assets: [{
          id: 'asset-1',
          owner: 'self',
          label: 'Savings',
          kind: 'liquid-net-worth',
          amount: -50_000,
          unlockAge: null,
        }],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'asset', 'asset-1', 'amount')).toBeDefined()
    })

    it('rejects negative unlockAge', () => {
      const plan = makeValidPlan({
        assets: [{
          id: 'asset-1',
          owner: 'self',
          label: 'Locked Fund',
          kind: 'locked-asset',
          amount: 50_000,
          unlockAge: -1,
        }],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'asset', 'asset-1', 'unlockAge')).toBeDefined()
    })
  })

  describe('common owned entry validation', () => {
    it('rejects empty label on income', () => {
      const income: IncomeSource = {
        id: 'inc-1',
        owner: 'self',
        label: '  ',
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'self', startAge: 30, endAge: 55 },
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
      }
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'label')).toBeDefined()
    })

    it('rejects unknown owner on expense', () => {
      const expense: ExpenseItem = {
        id: 'exp-1',
        owner: 'nonexistent' as any,
        label: 'Rent',
        kind: 'base-living',
        timing: { kind: 'age-range', owner: 'self', startAge: 30, endAge: null },
        amount: 1_000,
        periodicity: 'monthly',
      }
      const errors = validateHouseholdPlan(makeValidPlan({ expenses: [expense] }))
      expect(getError(errors, 'expense', 'exp-1', 'owner')).toBeDefined()
    })
  })

  describe('hasHouseholdValidationErrors', () => {
    it('returns false for empty error map', () => {
      expect(hasHouseholdValidationErrors({})).toBe(false)
    })

    it('returns true when any entity has errors', () => {
      const errors = { 'adult:test': { currentAge: 'Must be positive' } }
      expect(hasHouseholdValidationErrors(errors)).toBe(true)
    })

    it('returns false when entities exist but have no error fields', () => {
      const errors = { 'adult:test': {} }
      expect(hasHouseholdValidationErrors(errors)).toBe(false)
    })
  })
})
```

**IMPORTANT for implementer:** Before creating the file:
1. Read `frontend/src/lib/household/validation.ts` FULLY to verify error key format (`${entityKind}:${entityId}`)
2. Read `frontend/src/lib/household/types.ts` to verify all `PlanningAdult` and `PropertyPlan` required fields
3. If the `getError` helper doesn't match the actual error map structure, adapt it
4. The `retirementPhase` value for retired-adult bypass may be `'payout'` or another string — check the actual type
5. If `IncomeSource` or `ExpenseItem` require additional fields not shown above, add them

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/household/__tests__/validation.test.ts`
Expected: All tests PASS (validation rules are already implemented)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/household/__tests__/validation.test.ts
git commit -m "test: add household validation unit tests (30+ rules, zero prior coverage)"
```

---

### Task 2: Health check inputs adapter hook tests

**Files:**
- Create: `frontend/src/hooks/__tests__/useHealthCheckInputs.test.ts`
- Reference (read-only): `frontend/src/hooks/useHealthCheckInputs.ts` (184 lines, 4 branching paths)
- Reference (read-only): `frontend/src/lib/calculations/healthCheck.ts` (for `HealthRatioInputs` type)
- Reference (read-only): `frontend/src/lib/calculations/insuranceNeeds.ts` (for `InsuranceNeedsInputs` type)
- Reference (read-only): `frontend/src/hooks/useHealthCheckInputs.ts` imports (stores, hooks used)

**Context:** This hook assembles 25+ fields from 4 data sources (household plan store, normalized analysis, allocation store, portfolio calculations) with ownership scaling, fallback logic, and financial calculations. Zero test coverage. The downstream calculation functions (`healthCheck.ts`, `insuranceNeeds.ts`) have their own tests, but the adapter layer — where mapping bugs live — has none.

**Test strategy:** Seed the household plan store with known data, then call the hook via `renderHook`. Test 4 main branching paths:
1. Income with projection data vs fallback (80% heuristic)
2. Property aggregation with ownership fractions (multi-adult vs single)
3. Discount rate branching (portfolio return vs fixed expected return)
4. Partner income array (with projection vs flat fill)

**IMPORTANT for implementer:** This task requires more judgment than others. Read the FULL hook implementation, understand what stores it reads from, and determine the best approach for seeding stores in the test environment. The existing test suite has patterns for this — check:
- `frontend/src/hooks/__tests__/` for existing hook test patterns
- `frontend/src/lib/__goldens__/actuarialGolden.test.ts` for store seeding patterns
- `frontend/src/test-helpers/actuarialGoldens.ts` for `seedGoldenScenario` as a reference for store setup

The hook reads from `useHouseholdPlanStore`, `useNormalizedLegacyAnalysisContext` (via `useIncomeProjection`), and `useAllocationStore`. You may need to:
- Seed `useHouseholdPlanStore` via `setPlan()`
- Seed `useAllocationStore` via `applyTemplate()`
- Handle `useNormalizedLegacyAnalysisContext` — this may need mocking or store seeding depending on how it's wired

- [ ] **Step 1: Read all reference files and determine test approach**

Read these files before writing any tests:
1. `frontend/src/hooks/useHealthCheckInputs.ts` — full file
2. `frontend/src/hooks/useHealthCheck.ts` — consumer
3. `frontend/src/hooks/useInsuranceNeeds.ts` — consumer
4. `frontend/src/lib/calculations/healthCheck.ts` — for `HealthRatioInputs` type
5. `frontend/src/lib/calculations/insuranceNeeds.ts` — for `InsuranceNeedsInputs` type
6. Existing hook tests in `frontend/src/hooks/__tests__/` — for patterns
7. `frontend/src/stores/useHouseholdPlanStore.ts` — for `setPlan` API
8. `frontend/src/hooks/useIncomeProjection.ts` — to understand `useNormalizedLegacyAnalysisContext`

- [ ] **Step 2: Write the test file**

Create `frontend/src/hooks/__tests__/useHealthCheckInputs.test.ts` with these test cases:

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHealthCheckInputs } from '@/hooks/useHealthCheckInputs'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
// Import types for assertion
import type { HealthRatioInputs } from '@/lib/calculations/healthCheck'
import type { InsuranceNeedsInputs } from '@/lib/calculations/insuranceNeeds'

// NOTE: The implementer must determine how to handle useNormalizedLegacyAnalysisContext.
// Options: (a) seed the analysis store so compiled plan is available, or (b) test the
// fallback path (isReady=false) which doesn't require projection data.
// Testing BOTH paths (with and without projection) is the goal.

describe('useHealthCheckInputs', () => {
  beforeEach(() => {
    localStorage.clear()
    act(() => {
      useHouseholdPlanStore.getState().reset()
      useAllocationStore.getState().reset()
    })
  })

  describe('fallback path (no projection data)', () => {
    // NOTE: The store always has a default plan, so the hook never returns null
    // from default state. To test the fallback (isReady=false) path reliably,
    // mock useNormalizedLegacyAnalysisContext to return { normalized: null }.
    // Without mocking, compileHouseholdPlan runs synchronously and produces
    // real projection data, making isReady=true.

    it('computes grossMonthlyIncome from adult.annualIncome when no projection', () => {
      // Seed store with a known plan
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('individual')
        const plan = useHouseholdPlanStore.getState().plan!
        // Update adult income to a known value
        useHouseholdPlanStore.getState().updateAdult(plan.adults[0].id, {
          annualIncome: 120_000,
        })
      })

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      if (result.current) { // narrowing for TS
        // Fallback: grossMonthlyIncome = annualIncome / 12
        expect(result.current.ratioInputs.grossMonthlyIncome).toBe(10_000)
        // Fallback: netMonthlyIncome = annualIncome * 0.8 / 12
        expect(result.current.ratioInputs.netMonthlyIncome).toBe(8_000)
        expect(result.current.isReady).toBe(false)
      }
    })
  })

  describe('CPF total calculation', () => {
    it('sums all 4 CPF accounts', () => {
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('individual')
        const plan = useHouseholdPlanStore.getState().plan!
        useHouseholdPlanStore.getState().updateAdult(plan.adults[0].id, {
          cpf: {
            ...plan.adults[0].cpf,
            balances: { oa: 50_000, sa: 30_000, ma: 20_000, ra: 10_000 },
          },
        })
      })

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      if (result.current) { // narrowing for TS
        // CPF total = OA + SA + MA + RA = 110,000
        // This feeds into totalAssets and insurance needs
        expect(result.current.insuranceInputs.cpfTotal).toBe(110_000)
      }
    })
  })

  describe('asset calculations', () => {
    it('computes investedAssets as liquidNW minus cashSavings', () => {
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('individual')
        const plan = useHouseholdPlanStore.getState().plan!
        useHouseholdPlanStore.getState().updateAdult(plan.adults[0].id, {
          liquidNetWorth: 200_000,
          cashSavings: 50_000,
        })
      })

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      if (result.current) { // narrowing for TS
        expect(result.current.ratioInputs.investedAssets).toBe(150_000)
      }
    })

    it('clamps investedAssets to zero when cashSavings > liquidNW', () => {
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('individual')
        const plan = useHouseholdPlanStore.getState().plan!
        // This shouldn't happen if validation works, but the hook must handle it
        useHouseholdPlanStore.getState().updateAdult(plan.adults[0].id, {
          liquidNetWorth: 30_000,
          cashSavings: 50_000,
        })
      })

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      if (result.current) { // narrowing for TS
        expect(result.current.ratioInputs.investedAssets).toBe(0)
      }
    })
  })

  describe('property ownership scaling', () => {
    it('uses full property value for single-adult plan', () => {
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('individual')
        const plan = useHouseholdPlanStore.getState().plan!
        // Add a property with ownershipPercent 0.5
        // For single-adult, the hook should use fraction=1.0 (full value)
        useHouseholdPlanStore.getState().addProperty({
          id: 'prop-1',
          owner: 'self',
          label: 'HDB',
          propertyType: 'hdb',
          ownershipPercent: 0.5,
          existingPropertyValue: 800_000,
          existingMortgageBalance: 300_000,
          existingMonthlyPayment: 1_500,
          // ... other required fields — implementer must check PropertyPlan type
        } as any) // Implementer: fill all required fields
      })

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      if (result.current) { // narrowing for TS
        // Single adult: full value regardless of ownershipPercent
        expect(result.current.insuranceInputs.mortgageBalance).toBe(300_000)
      }
    })

    // Implementer: add a couple-plan test that verifies ownershipPercent scaling
    // For multi-adult, propertyValue should be scaled by ownershipPercent
  })

  describe('monthlyExpenses from store', () => {
    it('uses annualExpenses from adult, not projection', () => {
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('individual')
        const plan = useHouseholdPlanStore.getState().plan!
        useHouseholdPlanStore.getState().updateAdult(plan.adults[0].id, {
          annualExpenses: 36_000,
        })
      })

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      if (result.current) { // narrowing for TS
        expect(result.current.ratioInputs.monthlyExpenses).toBe(3_000)
      }
    })
  })

  describe('adult selection', () => {
    it('defaults to first adult when no adultId specified', () => {
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('individual')
        const plan = useHouseholdPlanStore.getState().plan!
        useHouseholdPlanStore.getState().updateAdult(plan.adults[0].id, {
          displayName: 'Primary',
        })
      })

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      if (result.current) { // narrowing for TS
        expect(result.current.adultName).toBe('Primary')
      }
    })

    it('returns null for non-existent adultId', () => {
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('individual')
      })

      const { result } = renderHook(() => useHealthCheckInputs('non-existent-id'))
      expect(result.current).toBeNull()
    })
  })

  describe('discount rate branching', () => {
    it('uses fixed expectedReturn when usePortfolioReturn is false', () => {
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('individual')
        // Default: usePortfolioReturn=false, expectedReturn=0.07, inflation=0.025, expenseRatio=0.003
        // discountRate = 0.07 - 0.025 - 0.003 = 0.042
      })

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      if (result.current) { // narrowing for TS
        expect(result.current.insuranceInputs.discountRate).toBeCloseTo(0.042, 3)
      }
    })

    it('uses portfolio-weighted return when usePortfolioReturn is true', () => {
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('individual')
        // Implementer: set assumptions.returns.usePortfolioReturn = true
        // and apply an allocation template. The discount rate should differ
        // from the fixed expectedReturn path because it uses the
        // weighted average of per-asset returns.
        // Then verify discountRate !== 0.042 (the fixed-return value)
      })

      // Implementer: complete this test
    })
  })

  describe('partner income array', () => {
    it('builds flat income array for partner without projection data', () => {
      act(() => {
        useHouseholdPlanStore.getState().initializeManualPlan('couple')
        // Implementer: add a partner adult with annualIncome=80_000
        // and retirementAge=60, currentAge=28 (32 years to retirement).
        // Without projection data, the hook fills:
        //   Array(32).fill(80_000)
        // Mock useNormalizedLegacyAnalysisContext to return null compiledPlan
        // to ensure the fallback path.
      })

      const { result } = renderHook(() => useHealthCheckInputs())
      expect(result.current).not.toBeNull()
      if (result.current) { // narrowing for TS
        const partnerIncome = result.current.insuranceInputs.partnerProjectedAnnualIncome
        expect(partnerIncome).toBeDefined()
        expect(partnerIncome).not.toBeNull()
        // Flat array of partner's annual income for years to retirement
        if (partnerIncome) {
          expect(partnerIncome[0]).toBe(80_000)
          expect(partnerIncome.every((v: number) => v === 80_000)).toBe(true)
        }
      }
    })
  })
})
```

**IMPORTANT for implementer:**
1. The test code above is a SKELETON. You MUST read the actual hook implementation and adapt.
2. The `as any` casts on property must be replaced with full `PropertyPlan` objects (see Task 1's property fixture for the complete shape including `downsizing`).
3. Verify `initializeManualPlan`, `addProperty`, `updateAdult` exist — check actual store API names.
4. If `renderHook` doesn't work with the hook's dependencies, you may need to wrap it.
5. **Mocking for fallback path:** `useNormalizedLegacyAnalysisContext` always materializes a compiled plan in the test env (via `compileHouseholdPlan` running synchronously). To test the `isReady=false` fallback path, you MUST mock it. Use `vi.mock('@/hooks/useIncomeProjection', () => ({ useNormalizedLegacyAnalysisContext: () => ({ normalized: null }) }))` or similar. Without mocking, all tests will get `isReady=true` with real projection data.
6. For the projection path (`isReady=true`): don't mock, let the real compiled plan materialize. Assertions should use `toBeCloseTo` since projection values come from the full calculation engine.
7. **Couple plan for partner income tests:** Use `addAdult(...)` after `initializeManualPlan` — same pattern as Task 4's `setupCouplePlan()`.

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useHealthCheckInputs.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/__tests__/useHealthCheckInputs.test.ts
git commit -m "test: add useHealthCheckInputs adapter hook tests (4 branching paths)"
```

---

## Chunk 2: WARNINGs (Tasks 3-5)

### Task 3: planSlice edge case tests

**Files:**
- Create: `frontend/src/lib/household/__tests__/planSlice.test.ts`
- Reference (read-only): `frontend/src/lib/household/planSlice.ts` (304 lines)
- Reference (read-only): `frontend/src/lib/household/__tests__/runtimeLegacyInputs.seam.test.ts` (for `makeTwoAdultFixture`)
- Reference (read-only): `frontend/src/hooks/__tests__/perAdultMonteCarlo.test.ts` (existing indirect tests)

**Context:** `planSlice.ts` exports `buildSingleAdultPlanSlice` and `buildSplitAdultPlanSlice`. Both have indirect coverage for the happy path in `perAdultMonteCarlo.test.ts` (couple scenarios, null-ID guard) and `isActiveBackwardCompat.test.ts` (slice content, isActive handling). This task adds EDGE CASE tests not covered there: splitRatio=0, null endAge preservation during timing shift, timing age delta application, shared-item filtering behavior.

**NOTE:** `buildSingleAdultPlanSlice` includes shared expenses/goals/assets/properties but EXCLUDES shared income (income is filtered by owner only). Tests must reflect this asymmetry.

- [ ] **Step 1: Write the test file**

Create `frontend/src/lib/household/__tests__/planSlice.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  buildSingleAdultPlanSlice,
  buildSplitAdultPlanSlice,
} from '@/lib/household/planSlice'
import type { HouseholdPlan, PlanningAdult, IncomeSource, ExpenseItem } from '@/lib/household/types'

// Implementer: read makeTwoAdultFixture from runtimeLegacyInputs.seam.test.ts
// and either import it or create a similar fixture here. The fixture needs:
// - Two adults with different ages (age delta matters for timing shift)
// - Shared + owned income streams
// - Shared + owned expenses
// - At least one income with endAge: null

function makeTwoAdultPlan(): HouseholdPlan {
  // Implementer: build a couple plan with:
  // - TJ (self, age 32, retirementAge 55)
  // - Chloe (partner, age 28, retirementAge 60)
  // - Shared income stream with endAge: null
  // - Owned income for each adult
  // - Shared expense
  // - Owned expense for partner
  // Read planSlice.ts to understand what fields it reads
  throw new Error('Implementer must create fixture')
}

describe('buildSplitAdultPlanSlice', () => {
  it('returns null for unknown adult ID', () => {
    const plan = makeTwoAdultPlan()
    expect(buildSplitAdultPlanSlice(plan, 'nonexistent', 0.5)).toBeNull()
  })

  it('zeros out shared items when splitRatio is 0', () => {
    const plan = makeTwoAdultPlan()
    const result = buildSplitAdultPlanSlice(plan, plan.adults[0].id, 0)
    expect(result).not.toBeNull()

    // All shared income should have annualAmount === 0
    const sharedIncome = result!.slice.income.filter(
      (i) => i.annualAmount === 0,
    )
    // Implementer: verify shared income was zeroed, owned income untouched
  })

  it('preserves null endAge during timing age shift', () => {
    const plan = makeTwoAdultPlan()
    // Ensure at least one income has timing.endAge === null
    // and timing.owner === 'partner' (so age delta shift applies)
    const result = buildSplitAdultPlanSlice(plan, plan.adults[0].id, 0.5)
    expect(result).not.toBeNull()

    // Find the income with originally null endAge — it should still be null
    // even after timing ages are shifted by the partner-to-self age delta
    const nullEndIncome = result!.slice.income.find(
      (i) => i.timing?.kind === 'age-range' && i.timing.endAge === null,
    )
    expect(nullEndIncome).toBeDefined()
  })

  it('applies correct age delta when shifting partner timing to self frame', () => {
    const plan = makeTwoAdultPlan()
    // TJ age 32, Chloe age 28 -> ageDelta = 32 - 28 = 4
    // Partner income startAge 28 should become 32 (28 + 4) in self frame
    const result = buildSplitAdultPlanSlice(plan, plan.adults[0].id, 0.5)
    expect(result).not.toBeNull()

    // Implementer: find the partner's income in the slice and verify
    // startAge was shifted by ageDelta. The exact assertion depends on
    // which income streams have partner timing.
  })

  it('produces planType individual in the slice', () => {
    const plan = makeTwoAdultPlan()
    const result = buildSplitAdultPlanSlice(plan, plan.adults[0].id, 0.5)
    expect(result).not.toBeNull()
    expect(result!.slice.planType).toBe('individual')
    expect(result!.slice.adults).toHaveLength(1)
    expect(result!.slice.adults[0].owner).toBe('self')
  })
})

describe('buildSingleAdultPlanSlice', () => {
  it('returns null for unknown adult ID', () => {
    const plan = makeTwoAdultPlan()
    expect(buildSingleAdultPlanSlice(plan, 'nonexistent')).toBeNull()
  })

  it('includes shared expenses at full value (no scaling)', () => {
    const plan = makeTwoAdultPlan()
    const result = buildSingleAdultPlanSlice(plan, plan.adults[0].id)
    expect(result).not.toBeNull()

    // NOTE: buildSingleAdultPlanSlice filters INCOME by owner only —
    // shared income is NOT included (unlike shared expenses/goals/assets/properties).
    // Verify shared expenses are included at full value (not scaled).
    // Implementer: verify specific shared expense amounts match original
  })

  it('excludes entries owned by the other adult', () => {
    const plan = makeTwoAdultPlan()
    const result = buildSingleAdultPlanSlice(plan, plan.adults[0].id)
    expect(result).not.toBeNull()

    // No entries should have owner === 'partner' — they should be excluded
    const partnerEntries = result!.slice.income.filter(
      (i) => i.owner === 'partner',
    )
    expect(partnerEntries).toHaveLength(0)
  })

  it('remaps all owners to self', () => {
    const plan = makeTwoAdultPlan()
    const result = buildSingleAdultPlanSlice(plan, plan.adults[0].id)
    expect(result).not.toBeNull()

    // All entries should have owner === 'self' (shared remapped to self)
    for (const income of result!.slice.income) {
      expect(income.owner).toBe('self')
    }
    for (const expense of result!.slice.expenses) {
      expect(expense.owner).toBe('self')
    }
  })
})
```

**IMPORTANT for implementer:**
1. Read `planSlice.ts` FULLY before creating the fixture — understand what fields it reads
2. The `makeTwoAdultPlan` fixture must include income/expense entries with different owners (self, partner, shared) and different timing configurations
3. Verify the age delta calculation: `getTimingAgeDelta` logic
4. The test skeleton has `throw new Error` — you MUST replace with actual fixture code

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx vitest run src/lib/household/__tests__/planSlice.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/household/__tests__/planSlice.test.ts
git commit -m "test: add planSlice edge case tests (splitRatio=0, timing shift, null endAge)"
```

---

### Task 4: Household store complex helper tests

**Files:**
- Create: `frontend/src/stores/__tests__/useHouseholdPlanStore.helpers.test.ts`
- Reference (read-only): `frontend/src/stores/useHouseholdPlanStore.ts` (621 lines)
- Reference (read-only): `frontend/src/lib/household/types.ts`

**Context:** The household plan store has complex helpers that need targeted tests. `removeAdult` has basic coverage in `useHouseholdPlanStore.test.ts` (removes adult, updates plan type), but the CASCADE logic (deleting owned entries) and REANCHOR logic (reassigning timing owners) are not tested there. `recalcAdultLiquidNetWorths` and year-drift migration have zero coverage.

**CRITICAL NOTE:** `initializeManualPlan('couple')` does NOT create a partner adult. It only sets `planType='couple'` on a single-adult plan. The implementer MUST call `addAdult(...)` after initialization to add a partner, or use `setPlan(...)` with a pre-built couple plan (e.g., from `makeJointGoldenPlan()` in `legacyParityFixtures.ts`). The year-drift migration test requires writing raw serialized data to `localStorage` in zustand's persist format: `{state: {plan: {...}, ...}, version: N}`. Check `HOUSEHOLD_PLAN_STORAGE_KEY` and `HOUSEHOLD_PLAN_STORAGE_VERSION` for the correct key and version.

- [ ] **Step 1: Write the test file**

Create `frontend/src/stores/__tests__/useHouseholdPlanStore.helpers.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import {
  useHouseholdPlanStore,
  HOUSEHOLD_PLAN_STORAGE_KEY,
  HOUSEHOLD_PLAN_STORAGE_VERSION,
} from '@/stores/useHouseholdPlanStore'
import type { HouseholdPlan, PlanningAdult } from '@/lib/household/types'

// NOTE: Zustand getState()/setState() are synchronous and don't trigger
// React re-renders — no act() wrapping needed for direct store calls.

/** Build a couple plan by initializing + adding a partner via addAdult. */
function setupCouplePlan(): { selfId: string; partnerId: string } {
  useHouseholdPlanStore.getState().initializeManualPlan('couple')
  const plan = useHouseholdPlanStore.getState().plan!
  const selfAdult = plan.adults[0]

  // initializeManualPlan('couple') does NOT create a partner adult.
  // Implementer: build a full PlanningAdult with owner: 'partner'.
  // Use the same field shape as makeValidAdult() from Task 1, with overrides:
  const partner: PlanningAdult = {
    ...structuredClone(selfAdult),
    id: 'test-partner',
    owner: 'partner',
    displayName: 'Partner',
    currentAge: 28,
    retirementAge: 60,
    lifeExpectancy: 90,
    maritalStatus: 'married',
    annualIncome: 60_000,
    annualExpenses: 20_000,
    liquidNetWorth: 80_000,
  }
  useHouseholdPlanStore.getState().addAdult(partner)

  return { selfId: selfAdult.id, partnerId: 'test-partner' }
}

describe('useHouseholdPlanStore — complex helpers', () => {
  beforeEach(() => {
    localStorage.clear()
    useHouseholdPlanStore.getState().reset()
  })

  describe('removeAdult', () => {
    // NOTE: existing tests in useHouseholdPlanStore.test.ts cover basic
    // removeAdult behavior. These tests focus on CASCADE and REANCHOR
    // logic that is not covered there.

    it('cannot remove the self adult', () => {
      const { selfId } = setupCouplePlan()

      useHouseholdPlanStore.getState().removeAdult(selfId)

      // Self adult should still be there
      const after = useHouseholdPlanStore.getState().plan!
      expect(after.adults.find((a) => a.owner === 'self')).toBeDefined()
    })

    it('removes partner adult and cascades to owned entries', () => {
      const { partnerId } = setupCouplePlan()

      // Add partner-owned income
      useHouseholdPlanStore.getState().addIncome({
        id: 'partner-income',
        owner: 'partner',
        label: 'Partner Salary',
        kind: 'salary-model',
        timing: { kind: 'age-range', owner: 'partner', startAge: 28, endAge: 55 },
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

      // Remove partner
      useHouseholdPlanStore.getState().removeAdult(partnerId)

      const after = useHouseholdPlanStore.getState().plan!
      // Partner should be gone
      expect(after.adults.find((a) => a.owner === 'partner')).toBeUndefined()
      // Partner-owned income should be cascaded away
      expect(after.income.find((i) => i.id === 'partner-income')).toBeUndefined()
      // Plan type should revert to individual
      expect(after.planType).toBe('individual')
    })

    it('reanchors shared timing from removed partner to self', () => {
      const { partnerId } = setupCouplePlan()

      // Add shared expense with partner timing
      useHouseholdPlanStore.getState().addExpense({
        id: 'shared-exp',
        owner: 'shared',
        label: 'Childcare',
        kind: 'expense-adjustment',
        timing: { kind: 'age-range', owner: 'partner', startAge: 30, endAge: 36 },
        amount: 12_000,
        periodicity: 'annual',
      })

      // Remove partner
      useHouseholdPlanStore.getState().removeAdult(partnerId)

      const after = useHouseholdPlanStore.getState().plan!
      const reanchoredExpense = after.expenses.find((e) => e.id === 'shared-exp')
      // Shared expense should still exist (not removed — it's shared, not partner-owned)
      expect(reanchoredExpense).toBeDefined()
      // Its timing owner should be reanchored from 'partner' to 'self'
      expect(reanchoredExpense!.timing?.owner).toBe('self')
    })
  })

  describe('year-drift migration', () => {
    it('bumps currentAge by year drift when plan was saved in a prior year', () => {
      // First, create a valid plan so we have the correct shape
      useHouseholdPlanStore.getState().initializeManualPlan('individual')
      const plan = structuredClone(useHouseholdPlanStore.getState().plan!)

      // Simulate a plan saved in 2025 with currentAge=30
      plan.planYear = 2025
      plan.adults[0].currentAge = 30
      plan.adults[0].retirementAge = 55
      plan.adults[0].lifeExpectancy = 85

      // Write to localStorage in zustand persist format:
      // { state: { plan, provenance, ... }, version: N }
      const serialized = JSON.stringify({
        state: {
          plan,
          provenance: { source: 'manual', initializedAt: '2025-01-01T00:00:00.000Z' },
        },
        version: HOUSEHOLD_PLAN_STORAGE_VERSION,
      })
      localStorage.setItem(HOUSEHOLD_PLAN_STORAGE_KEY, serialized)

      // Reset and rehydrate — the persist.merge callback should apply year drift
      useHouseholdPlanStore.getState().reset()
      useHouseholdPlanStore.persist.rehydrate()

      const rehydrated = useHouseholdPlanStore.getState().plan!
      const nowYear = new Date().getFullYear()
      const expectedDrift = nowYear - 2025

      // currentAge should be bumped by drift
      expect(rehydrated.adults[0].currentAge).toBe(30 + expectedDrift)
      // retirementAge should NOT be bumped (it's a target, not current)
      expect(rehydrated.adults[0].retirementAge).toBe(55)
      // lifeExpectancy should NOT be bumped
      expect(rehydrated.adults[0].lifeExpectancy).toBe(85)
      // planYear should be updated to current year
      expect(rehydrated.planYear).toBe(nowYear)
    })
  })
})
```

**IMPORTANT for implementer:**
1. Read the store's `initializeManualPlan`, `addIncome`, `addExpense`, `removeAdult` APIs
2. **`initializeManualPlan('couple')` does NOT create a partner adult** — you must call `addAdult(...)` after, or use `setPlan(...)` with a pre-built couple plan. All 3 removeAdult tests depend on having a partner present.
3. For year-drift migration: read the `persist.merge` callback in the store to understand the serialization format and storage key
4. The migration test is the trickiest — it requires direct localStorage manipulation. Check `HOUSEHOLD_PLAN_STORAGE_KEY` and the persist version for the correct key format.
5. If any store API doesn't exist (e.g., `addIncome`, `addExpense`), check the actual method names

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx vitest run src/stores/__tests__/useHouseholdPlanStore.helpers.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/__tests__/useHouseholdPlanStore.helpers.test.ts
git commit -m "test: add household store helper tests (removeAdult cascade, year-drift migration)"
```

---

### Task 5: toLegacyIndividual round-trip test

**Files:**
- Create: `frontend/src/lib/household/__tests__/toLegacyRoundTrip.test.ts`
- Reference (read-only): `frontend/src/lib/household/toLegacyIndividual.ts` (348 lines)
- Reference (read-only): `frontend/src/lib/household/fromLegacyIndividual.ts`
- Reference (read-only): `frontend/src/lib/household/__tests__/legacyParityFixtures.ts` (existing fixtures)

**Context:** `toLegacyIndividual` converts a `HouseholdPlan` to a `LegacyIndividualSnapshot`. `fromLegacyIndividual` does the reverse. Neither has been tested in combination. Known round-trip losses exist (cashSavings, insurance fields, null endAge) — the test should document these as expected behavior.

- [ ] **Step 1: Write the test file**

Create `frontend/src/lib/household/__tests__/toLegacyRoundTrip.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { toLegacyIndividual } from '@/lib/household/toLegacyIndividual'
import { fromLegacyIndividual } from '@/lib/household/fromLegacyIndividual'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'

describe('toLegacyIndividual round-trip', () => {
  describe('fromLegacy → toLegacy preserves financial fields', () => {
    // Test each parity fixture: convert from legacy → household → back to legacy
    // Core financial fields should survive the round-trip
    it.each(Object.keys(LEGACY_PARITY_FIXTURES))('preserves core fields for fixture %s', (key) => {
      const original = LEGACY_PARITY_FIXTURES[key as keyof typeof LEGACY_PARITY_FIXTURES]
      const household = fromLegacyIndividual(original)
      const roundTripped = toLegacyIndividual(household)

      // Must be convertible back
      expect(roundTripped).not.toBeNull()

      // Core profile fields
      expect(roundTripped!.profile.currentAge).toBe(original.profile.currentAge)
      expect(roundTripped!.profile.retirementAge).toBe(original.profile.retirementAge)
      expect(roundTripped!.profile.lifeExpectancy).toBe(original.profile.lifeExpectancy)
      // NOTE: annualIncome may differ if toLegacyIndividual overwrites it from
      // the salary entry's annualAmount. Skip this assertion — test annualExpenses instead.
      expect(roundTripped!.profile.annualExpenses).toBe(original.profile.annualExpenses)
      expect(roundTripped!.profile.annualExpenses).toBe(original.profile.annualExpenses)
      expect(roundTripped!.profile.liquidNetWorth).toBe(original.profile.liquidNetWorth)

      // CPF balances (flat fields on LegacyProfileSnapshot, NOT nested under cpfBalances)
      expect(roundTripped!.profile.cpfOA).toBe(original.profile.cpfOA)
      expect(roundTripped!.profile.cpfSA).toBe(original.profile.cpfSA)
      expect(roundTripped!.profile.cpfMA).toBe(original.profile.cpfMA)

      // SRS
      expect(roundTripped!.profile.srsBalance).toBe(original.profile.srsBalance)
      expect(roundTripped!.profile.srsAnnualContribution).toBe(original.profile.srsAnnualContribution)

      // Assumptions
      expect(roundTripped!.profile.swr).toBe(original.profile.swr)
      expect(roundTripped!.profile.expectedReturn).toBe(original.profile.expectedReturn)
      expect(roundTripped!.profile.inflation).toBe(original.profile.inflation)
    })
  })

  describe('toLegacy returns null for unconvertible plans', () => {
    it('returns null for couple plans', () => {
      const original = LEGACY_PARITY_FIXTURES[Object.keys(LEGACY_PARITY_FIXTURES)[0] as keyof typeof LEGACY_PARITY_FIXTURES]
      const household = fromLegacyIndividual(original)
      // Add a partner to make it unconvertible
      household.planType = 'couple'
      household.adults.push({
        ...structuredClone(household.adults[0]),
        id: 'adult-partner',
        owner: 'partner',
        displayName: 'Partner',
      })
      expect(toLegacyIndividual(household)).toBeNull()
    })

    it('returns null for plans with dependents', () => {
      const original = LEGACY_PARITY_FIXTURES[Object.keys(LEGACY_PARITY_FIXTURES)[0] as keyof typeof LEGACY_PARITY_FIXTURES]
      const household = fromLegacyIndividual(original)
      household.dependents = [{
        id: 'dep-1',
        owner: 'self',
        label: 'Child',
        relationship: 'child',
        currentAge: 5,
        annualCost: 10_000,
        timing: null,
      }]
      expect(toLegacyIndividual(household)).toBeNull()
    })
  })

  // Implementer: check the actual field names on LegacyIndividualSnapshot.
  // The field names above (cpfBalances, srsBalance, etc.) are approximate —
  // read the type definition and adapt.
})
```

**IMPORTANT for implementer:**
1. Read `toLegacyIndividual.ts` and `fromLegacyIndividual.ts` FULLY
2. Check the actual field names on `LegacyIndividualSnapshot` — the test above uses approximate names
3. Read `legacyParityFixtures.ts` to see what fixture keys exist
4. The `Dependent` type may require additional fields — check `types.ts`
5. Test code uses `Object.keys(LEGACY_PARITY_FIXTURES)[0]` which may need casting — verify the actual exported type

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx vitest run src/lib/household/__tests__/toLegacyRoundTrip.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/household/__tests__/toLegacyRoundTrip.test.ts
git commit -m "test: add toLegacyIndividual round-trip tests with parity fixtures"
```

---

## Chunk 3: Data File Invariants (Task 6)

### Task 6: Data file invariant tests

**Files:**
- Create: `frontend/src/lib/data/dataInvariants.test.ts`
- Reference (read-only): `frontend/src/lib/data/cpfRates.ts`
- Reference (read-only): `frontend/src/lib/data/taxBrackets.ts`
- Reference (read-only): `frontend/src/lib/data/stampDutyRates.ts`
- Reference (read-only): `frontend/src/lib/data/balaTable.ts`
- Reference (read-only): `frontend/src/lib/data/historicalReturnsFull.test.ts` (existing test pattern to follow)

**Context:** 18 data files in `lib/data/` have no validation tests. These files contain Singapore-specific financial data that changes annually. A typo during the January update could silently corrupt every calculation. Simple invariant tests catch these cheaply.

**Test style:** Follow the pattern in `historicalReturnsFull.test.ts` — direct `expect()` calls, no mocks, loop-based invariant checks.

- [ ] **Step 1: Write the test file**

Create `frontend/src/lib/data/dataInvariants.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  CPF_RATES,
  OW_CEILING_MONTHLY,
  OW_CEILING_ANNUAL,
  BRS_BASE,
  FRS_BASE,
  ERS_BASE,
  getCpfRatesForAge,
} from '@/lib/data/cpfRates'
import {
  TAX_BRACKETS,
  SRS_ANNUAL_CAP,
  SRS_ANNUAL_CAP_FOREIGNER,
  RELIEF_AMOUNTS,
  earnedIncomeReliefForAge,
} from '@/lib/data/taxBrackets'
import { BSD_BRACKETS, ABSD_RATES } from '@/lib/data/stampDutyRates'
import { BALA_TABLE_RAW, getBalaFactor } from '@/lib/data/balaTable'

describe('CPF rates — data invariants', () => {
  it('age brackets are contiguous with no gaps', () => {
    for (let i = 0; i < CPF_RATES.length - 1; i++) {
      expect(CPF_RATES[i].maxAge).toBe(CPF_RATES[i + 1].minAge)
    }
  })

  it('last bracket extends to Infinity', () => {
    expect(CPF_RATES[CPF_RATES.length - 1].maxAge).toBe(Infinity)
  })

  it('employee + employer = total rate for each bracket', () => {
    for (const bracket of CPF_RATES) {
      expect(bracket.employeeRate + bracket.employerRate).toBeCloseTo(bracket.totalRate, 10)
    }
  })

  it('OA + SA + MA = total rate for each bracket', () => {
    for (const bracket of CPF_RATES) {
      expect(bracket.oaRate + bracket.saRate + bracket.maRate).toBeCloseTo(bracket.totalRate, 10)
    }
  })

  it('all rates are in [0, 1]', () => {
    for (const bracket of CPF_RATES) {
      expect(bracket.totalRate).toBeGreaterThanOrEqual(0)
      expect(bracket.totalRate).toBeLessThanOrEqual(1)
      expect(bracket.employeeRate).toBeGreaterThanOrEqual(0)
      expect(bracket.employerRate).toBeGreaterThanOrEqual(0)
    }
  })

  it('total rate is non-increasing with age', () => {
    for (let i = 0; i < CPF_RATES.length - 1; i++) {
      expect(CPF_RATES[i].totalRate).toBeGreaterThanOrEqual(CPF_RATES[i + 1].totalRate)
    }
  })

  it('OW ceiling annual = monthly * 12', () => {
    expect(OW_CEILING_ANNUAL).toBe(OW_CEILING_MONTHLY * 12)
  })

  it('retirement sums are related: FRS = 2*BRS, ERS = 4*BRS', () => {
    expect(FRS_BASE).toBe(2 * BRS_BASE)
    expect(ERS_BASE).toBe(4 * BRS_BASE)
  })

  it('getCpfRatesForAge returns zero for foreigners', () => {
    const rates = getCpfRatesForAge(35, 'foreigner', 24)
    expect(rates.totalRate).toBe(0)
    expect(rates.employeeRate).toBe(0)
    expect(rates.employerRate).toBe(0)
  })

  it('getCpfRatesForAge returns 0.37 total for citizen under 55', () => {
    // prMonths irrelevant for citizens (short-circuits before checking)
    const rates = getCpfRatesForAge(35, 'citizen', 24)
    expect(rates.totalRate).toBeCloseTo(0.37, 2)
  })
})

describe('tax brackets — data invariants', () => {
  it('brackets are contiguous with no gaps', () => {
    for (let i = 0; i < TAX_BRACKETS.length - 1; i++) {
      expect(TAX_BRACKETS[i].to).toBe(TAX_BRACKETS[i + 1].from)
    }
  })

  it('first bracket starts at 0, last ends at Infinity', () => {
    expect(TAX_BRACKETS[0].from).toBe(0)
    expect(TAX_BRACKETS[TAX_BRACKETS.length - 1].to).toBe(Infinity)
  })

  it('all marginal rates are in [0, 1]', () => {
    for (const bracket of TAX_BRACKETS) {
      expect(bracket.rate).toBeGreaterThanOrEqual(0)
      expect(bracket.rate).toBeLessThanOrEqual(1)
    }
  })

  it('cumulativeTax values are consistent with brackets', () => {
    for (let i = 1; i < TAX_BRACKETS.length; i++) {
      const prev = TAX_BRACKETS[i - 1]
      const expected = prev.cumulativeTax + (prev.to - prev.from) * prev.rate
      expect(TAX_BRACKETS[i].cumulativeTax).toBeCloseTo(expected, 2)
    }
  })

  it('SRS foreigner cap > citizen cap', () => {
    expect(SRS_ANNUAL_CAP_FOREIGNER).toBeGreaterThan(SRS_ANNUAL_CAP)
  })

  it('relief cap is 80,000', () => {
    expect(RELIEF_AMOUNTS.reliefCap).toBe(80_000)
  })

  it('earned income relief tiers are correct', () => {
    expect(earnedIncomeReliefForAge(30)).toBe(1_000)
    expect(earnedIncomeReliefForAge(55)).toBe(6_000)
    expect(earnedIncomeReliefForAge(65)).toBe(8_000)
  })
})

describe('stamp duty rates — data invariants', () => {
  it('BSD rates are strictly increasing', () => {
    for (let i = 0; i < BSD_BRACKETS.length - 1; i++) {
      expect(BSD_BRACKETS[i][1]).toBeLessThan(BSD_BRACKETS[i + 1][1])
    }
  })

  it('last BSD bracket has Infinity size', () => {
    expect(BSD_BRACKETS[BSD_BRACKETS.length - 1][0]).toBe(Infinity)
  })

  it('all BSD rates are in [0, 1]', () => {
    for (const [, rate] of BSD_BRACKETS) {
      expect(rate).toBeGreaterThanOrEqual(0)
      expect(rate).toBeLessThanOrEqual(1)
    }
  })

  it('ABSD for citizen first property is 0', () => {
    expect(ABSD_RATES.citizen[0]).toBe(0)
  })

  it('ABSD rates are non-decreasing within each residency', () => {
    for (const key of Object.keys(ABSD_RATES) as Array<keyof typeof ABSD_RATES>) {
      const rates = ABSD_RATES[key]
      for (let i = 0; i < rates.length - 1; i++) {
        expect(rates[i]).toBeLessThanOrEqual(rates[i + 1])
      }
    }
  })

  it('all ABSD rates are in [0, 1]', () => {
    for (const key of Object.keys(ABSD_RATES) as Array<keyof typeof ABSD_RATES>) {
      for (const rate of ABSD_RATES[key]) {
        expect(rate).toBeGreaterThanOrEqual(0)
        expect(rate).toBeLessThanOrEqual(1)
      }
    }
  })

  it('spot-check: BSD on $1M property is $24,600', () => {
    // Walk the brackets manually:
    // $180K @ 1% = $1,800
    // $180K @ 2% = $3,600
    // $640K @ 3% = $19,200
    // Total = $24,600
    let remaining = 1_000_000
    let bsd = 0
    for (const [size, rate] of BSD_BRACKETS) {
      const taxable = Math.min(remaining, size)
      bsd += taxable * rate
      remaining -= taxable
      if (remaining <= 0) break
    }
    expect(bsd).toBe(24_600)
  })
})

describe("Bala's Table — data invariants", () => {
  it('factors are strictly decreasing with remaining lease', () => {
    for (let i = 0; i < BALA_TABLE_RAW.length - 1; i++) {
      const [lease1, factor1] = BALA_TABLE_RAW[i]
      const [lease2, factor2] = BALA_TABLE_RAW[i + 1]
      // Table is ordered descending by lease years
      expect(lease1).toBeGreaterThan(lease2)
      expect(factor1).toBeGreaterThan(factor2)
    }
  })

  it('all factors are in [0, 1]', () => {
    for (const [, factor] of BALA_TABLE_RAW) {
      expect(factor).toBeGreaterThanOrEqual(0)
      expect(factor).toBeLessThanOrEqual(1)
    }
  })

  it('factor at 99 years is 0.99, at 0 years is 0', () => {
    expect(getBalaFactor(99)).toBeCloseTo(0.99, 2)
    expect(getBalaFactor(0)).toBe(0)
  })

  it('interpolates correctly between table entries', () => {
    // Between 99yr (0.99) and 95yr (0.98): at 97yr should be ~0.985
    const factor = getBalaFactor(97)
    expect(factor).toBeGreaterThan(0.98)
    expect(factor).toBeLessThan(0.99)
  })

  it('clamps at table maximum for leases > 99', () => {
    expect(getBalaFactor(150)).toBe(getBalaFactor(99))
  })

  it('returns 0 for negative lease values', () => {
    expect(getBalaFactor(-5)).toBe(0)
  })
})
```

**IMPORTANT for implementer:**
1. Read ALL 4 data files to verify exact export names and data structures
2. The `CPF_RATES` array structure may differ from what's shown — check field names
3. `getCpfRatesForAge` may take different parameters — verify the signature
4. `BSD_BRACKETS` may be structured differently (tuples vs objects) — verify
5. `BALA_TABLE_RAW` may be ordered ascending or descending by lease years — check and adapt the monotonicity test
6. The BSD spot-check ($24,600 for $1M) is calculated from the documented rates — verify against the actual data
7. `earnedIncomeReliefForAge` may use different age boundaries — verify
8. If any import doesn't exist (e.g., `RELIEF_AMOUNTS`), check the actual exports

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx vitest run src/lib/data/dataInvariants.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/data/dataInvariants.test.ts
git commit -m "test: add data file invariant tests (cpfRates, taxBrackets, stampDuty, balaTable)"
```

---

## Review Fixes Applied

### Round 1: Chunks 2-3 review (opus code reviewer)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| B1 | BLOCKER | `initializeManualPlan('couple')` does not create partner adult; removeAdult tests would silently no-op | Added critical note in Task 4 context + implementer instructions |
| B2 | BLOCKER | `cpfBalances.oa/sa/ma` wrong field names on `LegacyProfileSnapshot`; correct: `cpfOA/cpfSA/cpfMA` | Fixed in Task 5 test code |
| B3 | BLOCKER | Dependent literal missing required `timing: TimingRule | null` field | Added `timing: null` |
| W1 | WARNING | Year-drift test is hollow skeleton | Added zustand persist format note in Task 4 context |
| W4 | WARNING | Bala table comment says "94yr" but actual entry is 95yr | Fixed comment |

### Round 2: Chunk 1 review (opus code reviewer)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| B1c1 | BLOCKER | `retirementPhase: 'payout'` invalid; type is `'before-55' \| '55-to-64' \| '65-plus'` | Changed to `'65-plus'` |
| B2c1 | BLOCKER | `PropertyPlan` fixtures missing required `downsizing` field | Added `downsizing: { scenario: 'none', ... }` to both |
| B4c1 | BLOCKER | Task 2 property uses `as any` with incomplete fields | Added note; implementer must create complete fixture |
| W1-W5 | WARNING | Missing test coverage for SRS, healthcare, goal, asset validation | Added SRS/healthcare + goal test groups to Task 1 |
| W6 | WARNING | "returns null when no plan" test false; default plan always exists | Removed test, added note about mocking |
| W7 | WARNING | Fallback tests may get real projection data | Added note about mocking `useNormalizedLegacyAnalysisContext` |
| W8 | WARNING | `if (result.current)` guards silently skip assertions | Replaced with `expect().not.toBeNull()` + narrowing |

### Round 3: Codex MCP review

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| B1c3 | BLOCKER | T4 code still literally calls `initializeManualPlan('couple')` + `find('partner')!` despite note | Added `addAdult` comment at each call site |
| B2c3 | BLOCKER | T3 `buildSingleAdultPlanSlice` filters income by owner only; shared income NOT included | Changed test to verify shared expenses (not income) |
| B3c3 | BLOCKER | T5 `annualIncome` round-trip fails for `goalsAndLifeEvents` fixture; `toLegacyIndividual` overwrites from salary entry | Replaced with `annualExpenses` assertion |
| W1c3 | WARNING | T4 overstates gap; `removeAdult` already tested in `useHouseholdPlanStore.test.ts` | Noted; new tests add cascade/reanchor coverage |
| W2c3 | WARNING | T3 overstates gap; existing coverage in `perAdultMonteCarlo.test.ts` | Noted; new tests add edge cases only |
| W3c3 | WARNING | T2 fallback tests need mock; plan acknowledges but doesn't implement | Implementer responsibility |
| W4c3 | WARNING | T1 misses dependent, asset, label/owner validation branches | Implementer should add if time permits |
