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
  AssetItem,
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

/** Minimal valid property for testing. Override fields to trigger specific rules. */
function makeValidProperty(overrides?: Partial<PropertyPlan>): PropertyPlan {
  return {
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
    downsizing: {
      scenario: 'none',
      sellAge: 65,
      expectedSalePrice: 0,
      newPropertyCost: 0,
      newMortgageRate: 0,
      newMortgageTerm: 0,
      newLtv: 0,
      monthlyRent: 0,
      rentGrowthRate: 0,
    },
    ...overrides,
  }
}

/** Minimal valid income source for testing. Override fields to trigger specific rules. */
function makeValidIncome(overrides?: Partial<IncomeSource>): IncomeSource {
  return {
    id: 'inc-1',
    owner: 'self',
    label: 'Salary',
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
    ...overrides,
  }
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
      const income1 = makeValidIncome({ id: 'dup-id', label: 'Salary 1' })
      const income2 = makeValidIncome({ id: 'dup-id', label: 'Salary 2' })
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income1, income2] }))
      expect(getError(errors, 'income', 'dup-id', 'id')).toBeDefined()
    })

    it('does not flag duplicate IDs across different collections', () => {
      // Same id in income and expense collections is valid (separate buckets)
      const income = makeValidIncome({ id: 'shared-id' })
      const expense: ExpenseItem = {
        id: 'shared-id',
        owner: 'self',
        label: 'Rent',
        kind: 'base-living',
        timing: { kind: 'age-range', owner: 'self', startAge: 30, endAge: null },
        amount: 1_000,
        periodicity: 'monthly',
      }
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income], expenses: [expense] }))
      expect(getError(errors, 'income', 'shared-id', 'id')).toBeUndefined()
      expect(getError(errors, 'expense', 'shared-id', 'id')).toBeUndefined()
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

    it('accepts age 0 as valid current age', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({ currentAge: 0, retirementAge: 1, lifeExpectancy: 2 })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'currentAge')).toBeUndefined()
    })

    it('rejects retirementAge <= currentAge for non-retired adult', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({ currentAge: 40, retirementAge: 40 })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'retirementAge')).toBeDefined()
    })

    it('allows retirementAge <= currentAge for retired adult (has retirementPhase)', () => {
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

    it('also allows before-55 and 55-to-64 retirementPhase values', () => {
      for (const phase of ['before-55', '55-to-64', '65-plus'] as const) {
        const plan = makeValidPlan({
          adults: [makeValidAdult({
            currentAge: 65,
            retirementAge: 55,
            lifeExpectancy: 90,
            cpf: { ...makeValidAdult().cpf, retirementPhase: phase },
          })],
        })
        const errors = validateHouseholdPlan(plan)
        expect(
          getError(errors, 'adult', 'adult-self', 'retirementAge'),
          `Expected no error for retirementPhase=${phase}`,
        ).toBeUndefined()
      }
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

    it('allows cashSavings equal to liquidNetWorth (edge: both same positive)', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({ cashSavings: 100_000, liquidNetWorth: 100_000 })],
      })
      const errors = validateHouseholdPlan(plan)
      // cash savings === liquid NW: does NOT exceed, so no error
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

    it('accepts ciRecoveryYears at boundary values 1 and 10', () => {
      for (const boundary of [1, 10]) {
        const plan = makeValidPlan({
          adults: [makeValidAdult({ ciRecoveryYears: boundary })],
        })
        const errors = validateHouseholdPlan(plan)
        expect(
          getError(errors, 'adult', 'adult-self', 'ciRecoveryYears'),
          `Expected no error for ciRecoveryYears=${boundary}`,
        ).toBeUndefined()
      }
    })
  })

  describe('timing validation', () => {
    it('rejects shared as timing owner (timing owner must be adult)', () => {
      const income = makeValidIncome({
        timing: { kind: 'age-range', owner: 'shared' as any, startAge: 30, endAge: 55 },
      })
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'timing.owner')).toBeDefined()
    })

    it('rejects timing referencing unknown adult in couple plan', () => {
      const income = makeValidIncome({
        owner: 'self',
        timing: { kind: 'age-range', owner: 'partner', startAge: 30, endAge: 55 },
      })
      // Single-adult plan has no partner — timing.owner='partner' is invalid
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'timing.owner')).toBeDefined()
    })

    it('accepts partner timing owner in couple plan', () => {
      const partner = makeValidAdult({ id: 'adult-partner', owner: 'partner', displayName: 'Partner' })
      const income = makeValidIncome({
        owner: 'shared',
        timing: { kind: 'age-range', owner: 'partner', startAge: 30, endAge: 55 },
      })
      const errors = validateHouseholdPlan(makeValidPlan({
        planType: 'couple',
        adults: [makeValidAdult(), partner],
        income: [income],
      }))
      expect(getError(errors, 'income', 'inc-1', 'timing.owner')).toBeUndefined()
    })

    it('rejects endAge < startAge in age-range timing', () => {
      const income = makeValidIncome({
        timing: { kind: 'age-range', owner: 'self', startAge: 55, endAge: 30 },
      })
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'timing.endAge')).toBeDefined()
    })

    it('allows null endAge in age-range timing', () => {
      const income = makeValidIncome({
        timing: { kind: 'age-range', owner: 'self', startAge: 30, endAge: null },
      })
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'timing.endAge')).toBeUndefined()
    })

    it('allows endAge equal to startAge (same age range is valid)', () => {
      const income = makeValidIncome({
        timing: { kind: 'age-range', owner: 'self', startAge: 45, endAge: 45 },
      })
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'timing.endAge')).toBeUndefined()
    })

    it('rejects negative single-age timing age', () => {
      const income = makeValidIncome({
        timing: { kind: 'single-age', owner: 'self', age: -1 },
      })
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'timing.age')).toBeDefined()
    })

    it('rejects negative startAge in age-range timing', () => {
      const income = makeValidIncome({
        timing: { kind: 'age-range', owner: 'self', startAge: -5, endAge: null },
      })
      const errors = validateHouseholdPlan(makeValidPlan({ income: [income] }))
      expect(getError(errors, 'income', 'inc-1', 'timing.startAge')).toBeDefined()
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

    it('rejects durationYears < 1', () => {
      const expense: ExpenseItem = {
        id: 'exp-1',
        owner: 'self',
        label: 'One-off',
        kind: 'additional-living',
        timing: { kind: 'single-age', owner: 'self', age: 40 },
        amount: 5_000,
        periodicity: 'one-off',
        durationYears: 0,
      }
      const errors = validateHouseholdPlan(makeValidPlan({ expenses: [expense] }))
      expect(getError(errors, 'expense', 'exp-1', 'durationYears')).toBeDefined()
    })

    it('accepts undefined durationYears (optional field)', () => {
      const expense: ExpenseItem = {
        id: 'exp-1',
        owner: 'self',
        label: 'Ongoing Cost',
        kind: 'additional-living',
        timing: { kind: 'age-range', owner: 'self', startAge: 30, endAge: null },
        amount: 5_000,
        periodicity: 'annual',
      }
      const errors = validateHouseholdPlan(makeValidPlan({ expenses: [expense] }))
      expect(getError(errors, 'expense', 'exp-1', 'durationYears')).toBeUndefined()
    })
  })

  describe('property validation', () => {
    it('rejects ownershipPercent = 0', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ ownershipPercent: 0 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'ownershipPercent')).toBeDefined()
    })

    it('rejects ownershipPercent > 1', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ ownershipPercent: 1.5 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'ownershipPercent')).toBeDefined()
    })

    it('accepts ownershipPercent = 1.0 (boundary)', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ ownershipPercent: 1.0 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'ownershipPercent')).toBeUndefined()
    })

    it('rejects mortgageTerm outside 1-40', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ mortgageTerm: 50 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'mortgageTerm')).toBeDefined()
    })

    it('rejects mortgageTerm = 0', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ mortgageTerm: 0 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'mortgageTerm')).toBeDefined()
    })

    it('accepts mortgageTerm at boundaries 1 and 40', () => {
      for (const term of [1, 40]) {
        const errors = validateHouseholdPlan(makeValidPlan({
          properties: [makeValidProperty({ mortgageTerm: term })],
        }))
        expect(
          getError(errors, 'property', 'prop-1', 'mortgageTerm'),
          `Expected no error for mortgageTerm=${term}`,
        ).toBeUndefined()
      }
    })

    it('rejects negative purchasePrice', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ purchasePrice: -1 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'purchasePrice')).toBeDefined()
    })

    it('rejects negative existingPropertyValue', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ existingPropertyValue: -1 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'existingPropertyValue')).toBeDefined()
    })

    it('rejects negative existingMortgageBalance', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ existingMortgageBalance: -1 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'existingMortgageBalance')).toBeDefined()
    })

    it('rejects negative existingMonthlyPayment', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ existingMonthlyPayment: -1 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'existingMonthlyPayment')).toBeDefined()
    })

    it('rejects mortgageRate > 1', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ mortgageRate: 1.5 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'mortgageRate')).toBeDefined()
    })

    it('rejects negative mortgageRate', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ mortgageRate: -0.01 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'mortgageRate')).toBeDefined()
    })

    it('rejects ltv > 1', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ ltv: 1.1 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'ltv')).toBeDefined()
    })

    it('rejects negative ltv', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ ltv: -0.1 })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'ltv')).toBeDefined()
    })
  })

  describe('assumptions validation', () => {
    it('rejects SWR = 0', () => {
      const plan = makeValidPlan()
      plan.assumptions.fire.swr = 0
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'fire.swr')).toBeDefined()
    })

    it('rejects SWR > 1', () => {
      const plan = makeValidPlan()
      plan.assumptions.fire.swr = 1.1
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'fire.swr')).toBeDefined()
    })

    it('accepts SWR = 1.0 (boundary)', () => {
      const plan = makeValidPlan()
      plan.assumptions.fire.swr = 1.0
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'fire.swr')).toBeUndefined()
    })

    it('rejects non-finite expectedReturn', () => {
      const plan = makeValidPlan()
      plan.assumptions.returns.expectedReturn = Infinity
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'returns.expectedReturn')).toBeDefined()
    })

    it('rejects NaN inflation', () => {
      const plan = makeValidPlan()
      plan.assumptions.returns.inflation = NaN
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'returns.inflation')).toBeDefined()
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

    it('rejects negative cash reserve fixedAmount', () => {
      const plan = makeValidPlan()
      plan.assumptions.cashReserve.fixedAmount = -100
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'cashReserve.fixedAmount')).toBeDefined()
    })

    it('rejects negative cash reserve returnRate', () => {
      const plan = makeValidPlan()
      plan.assumptions.cashReserve.returnRate = -0.01
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'assumptions', 'test-plan', 'cashReserve.returnRate')).toBeDefined()
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

    it('accepts SRS balance and contribution of zero', () => {
      const plan = makeValidPlan({
        adults: [makeValidAdult({
          srs: { ...makeValidAdult().srs, balance: 0, annualContribution: 0 },
        })],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'adult', 'adult-self', 'srs.balance')).toBeUndefined()
      expect(getError(errors, 'adult', 'adult-self', 'srs.annualContribution')).toBeUndefined()
    })
  })

  describe('goal validation', () => {
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

    it('accepts valid goal with durationYears = 1', () => {
      const goal: GoalItem = {
        id: 'goal-1',
        owner: 'self',
        label: 'Education',
        kind: 'financial-goal',
        timing: { kind: 'single-age', owner: 'self', age: 40 },
        amount: 10_000,
        durationYears: 1,
        priority: 'important',
        inflationAdjusted: false,
        category: 'education',
      }
      const errors = validateHouseholdPlan(makeValidPlan({ goals: [goal] }))
      expect(getError(errors, 'goal', 'goal-1', 'amount')).toBeUndefined()
      expect(getError(errors, 'goal', 'goal-1', 'durationYears')).toBeUndefined()
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

    it('rejects negative currentAge', () => {
      const plan = makeValidPlan({
        dependents: [{
          id: 'dep-1',
          owner: 'self',
          label: 'Child',
          relationship: 'child',
          currentAge: -1,
          annualCost: 1_000,
          timing: null,
        }],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'dependent', 'dep-1', 'currentAge')).toBeDefined()
    })

    it('accepts null currentAge', () => {
      const plan = makeValidPlan({
        dependents: [{
          id: 'dep-1',
          owner: 'self',
          label: 'Parent',
          relationship: 'parent',
          currentAge: null,
          annualCost: 1_000,
          timing: null,
        }],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'dependent', 'dep-1', 'currentAge')).toBeUndefined()
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

    it('validates timing when present on dependent', () => {
      const plan = makeValidPlan({
        dependents: [{
          id: 'dep-1',
          owner: 'self',
          label: 'Child',
          relationship: 'child',
          currentAge: 5,
          annualCost: 1_000,
          timing: { kind: 'age-range', owner: 'self', startAge: 35, endAge: 20 },
        }],
      })
      const errors = validateHouseholdPlan(plan)
      expect(getError(errors, 'dependent', 'dep-1', 'timing.endAge')).toBeDefined()
    })
  })

  describe('asset validation', () => {
    it('rejects negative amount', () => {
      const asset: AssetItem = {
        id: 'asset-1',
        owner: 'self',
        label: 'Savings',
        kind: 'liquid-net-worth',
        amount: -50_000,
      }
      const errors = validateHouseholdPlan(makeValidPlan({ assets: [asset] }))
      expect(getError(errors, 'asset', 'asset-1', 'amount')).toBeDefined()
    })

    it('rejects negative unlockAge', () => {
      const asset: AssetItem = {
        id: 'asset-1',
        owner: 'self',
        label: 'Locked Fund',
        kind: 'locked-asset',
        amount: 50_000,
        unlockAge: -1,
      }
      const errors = validateHouseholdPlan(makeValidPlan({ assets: [asset] }))
      expect(getError(errors, 'asset', 'asset-1', 'unlockAge')).toBeDefined()
    })

    it('accepts unlockAge = 0 (zero is valid)', () => {
      const asset: AssetItem = {
        id: 'asset-1',
        owner: 'self',
        label: 'Locked Fund',
        kind: 'locked-asset',
        amount: 50_000,
        unlockAge: 0,
      }
      const errors = validateHouseholdPlan(makeValidPlan({ assets: [asset] }))
      expect(getError(errors, 'asset', 'asset-1', 'unlockAge')).toBeUndefined()
    })

    it('accepts undefined unlockAge (optional field)', () => {
      const asset: AssetItem = {
        id: 'asset-1',
        owner: 'self',
        label: 'Savings',
        kind: 'liquid-net-worth',
        amount: 50_000,
      }
      const errors = validateHouseholdPlan(makeValidPlan({ assets: [asset] }))
      expect(getError(errors, 'asset', 'asset-1', 'unlockAge')).toBeUndefined()
    })
  })

  describe('common owned entry validation', () => {
    it('rejects empty label on income', () => {
      const income = makeValidIncome({ label: '  ' })
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

    it('accepts shared owner on expense', () => {
      const expense: ExpenseItem = {
        id: 'exp-1',
        owner: 'shared',
        label: 'Utilities',
        kind: 'base-living',
        timing: { kind: 'age-range', owner: 'self', startAge: 30, endAge: null },
        amount: 500,
        periodicity: 'monthly',
      }
      const errors = validateHouseholdPlan(makeValidPlan({ expenses: [expense] }))
      expect(getError(errors, 'expense', 'exp-1', 'owner')).toBeUndefined()
    })

    it('rejects negative annualAmount on income', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        income: [makeValidIncome({ annualAmount: -1 })],
      }))
      expect(getError(errors, 'income', 'inc-1', 'annualAmount')).toBeDefined()
    })

    it('rejects empty label on property', () => {
      const errors = validateHouseholdPlan(makeValidPlan({
        properties: [makeValidProperty({ label: '' })],
      }))
      expect(getError(errors, 'property', 'prop-1', 'label')).toBeDefined()
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

    it('returns true with multiple entities when only one has errors', () => {
      const errors = {
        'adult:adult-self': {},
        'adult:adult-partner': { currentAge: 'Must be positive' },
      }
      expect(hasHouseholdValidationErrors(errors)).toBe(true)
    })
  })
})
