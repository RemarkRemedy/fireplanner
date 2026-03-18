import { describe, expect, it } from 'vitest'
import type { PlanningAdult } from '@/lib/household/types'
import type { CompiledHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import type { ResolvedTimingWindow } from '@/lib/household/timing'
import { detectCoupleMode, computePerAdultNetWorth, computePerAdultSavings } from './coupleData'

/** Build a minimal ResolvedTimingWindow — only startYearOffset/endYearOffset are read by isActiveAtCurrentYear. */
function tw(startYearOffset: number, endYearOffset: number): ResolvedTimingWindow {
  return { owner: 'self', adultId: 'a1', startAge: 30, endAge: 85, startYearOffset, endYearOffset }
}

// Minimal factory helpers — only the fields these functions actually read
function makeAdult(overrides: Partial<PlanningAdult> & { id: string; owner: PlanningAdult['owner'] }): PlanningAdult {
  return {
    displayName: 'Test Adult',
    currentAge: 30,
    retirementAge: 55,
    lifeExpectancy: 85,
    lifeStage: 'pre-fire',
    maritalStatus: 'single',
    residencyStatus: 'citizen',
    prMonths: 0,
    annualIncome: 0,
    annualExpenses: 0,
    liquidNetWorth: 0,
    parentSupportEnabled: false,
    lifeEventsEnabled: false,
    healthcare: {} as PlanningAdult['healthcare'],
    cpf: { balances: { oa: 0, sa: 0, ma: 0, ra: 0 } } as PlanningAdult['cpf'],
    srs: {} as PlanningAdult['srs'],
    taxProfile: {} as PlanningAdult['taxProfile'],
    lifeEvents: [],
    cashSavings: 0,
    nonMortgageDebtTotal: 0,
    nonMortgageDebtMonthlyPayment: 0,
    insuranceDeathCoverage: 0,
    insuranceCICoverage: 0,
    insuranceDisabilityMonthly: 0,
    funeralCosts: 0,
    ciRecoveryYears: 0,
    ...overrides,
  }
}

function makeCompiledPlan(overrides: Partial<CompiledHouseholdPlan>): CompiledHouseholdPlan {
  return {
    // NormalizedHouseholdPlan fields
    schemaVersion: 1,
    householdId: 'test',
    planType: 'individual',
    assumptions: {} as CompiledHouseholdPlan['assumptions'],
    parityMeta: {} as CompiledHouseholdPlan['parityMeta'],
    adultOrder: [],
    adultsById: {},
    dependentOrder: [],
    dependentsById: {},
    incomeOrder: [],
    incomeById: {},
    expenseOrder: [],
    expensesById: {},
    assetOrder: [],
    assetsById: {},
    goalOrder: [],
    goalsById: {},
    propertyOrder: [],
    propertiesById: {},
    // CompiledHouseholdPlan fields
    yearCount: 0,
    firstRetirementYearOffset: 0,
    householdRetirementYearOffset: 0,
    adultTimingById: {},
    resolvedTiming: { incomeById: {}, expenseById: {}, dependentById: {}, goalById: {}, assetUnlockYearOffsetById: {} } as CompiledHouseholdPlan['resolvedTiming'],
    milestones: [],
    annualSavingsByYear: [],
    postRetirementIncomeByYear: [],
    guaranteedIncomeByYear: [],
    retirementExpenseBaseByYear: [],
    householdWithdrawalNeedByYear: [],
    portfolioAdjustments: [],
    incomeByAdultId: {},
    cpfByAdultId: {},
    healthcareByAdultId: {},
    rows: [],
    warnings: [],
    ...overrides,
  } as CompiledHouseholdPlan
}

// ---------------------------------------------------------------------------
// detectCoupleMode
// ---------------------------------------------------------------------------
describe('detectCoupleMode', () => {
  it('returns false for a single adult', () => {
    const self = makeAdult({ id: 'a1', owner: 'self', currentAge: 30 })
    const result = detectCoupleMode([self])
    expect(result.isCoupleMode).toBe(false)
    expect(result.selfAdult).toBe(self)
    expect(result.partnerAdult).toBeUndefined()
  })

  it('returns true for two adults with real partner', () => {
    const self = makeAdult({ id: 'a1', owner: 'self', currentAge: 30 })
    const partner = makeAdult({ id: 'a2', owner: 'partner', currentAge: 28 })
    const result = detectCoupleMode([self, partner])
    expect(result.isCoupleMode).toBe(true)
    expect(result.selfAdult).toBe(self)
    expect(result.partnerAdult).toBe(partner)
  })

  it('returns false for stub partner (age 0)', () => {
    const self = makeAdult({ id: 'a1', owner: 'self', currentAge: 30 })
    const stub = makeAdult({ id: 'a2', owner: 'partner', currentAge: 0 })
    const result = detectCoupleMode([self, stub])
    expect(result.isCoupleMode).toBe(false)
    expect(result.selfAdult).toBe(self)
    expect(result.partnerAdult).toBe(stub)
  })
})

// ---------------------------------------------------------------------------
// computePerAdultNetWorth
// ---------------------------------------------------------------------------
describe('computePerAdultNetWorth', () => {
  it('includes liquid + CPF balances', () => {
    const adult = makeAdult({ id: 'a1', owner: 'self', liquidNetWorth: 100_000 })
    const plan = makeCompiledPlan({
      cpfByAdultId: {
        a1: {
          adultId: 'a1',
          owner: 'self',
          retirementYearOffset: 25,
          cpfLifeYearOffset: 35,
          rows: [{
            adultId: 'a1',
            owner: 'self',
            yearOffset: 0,
            age: 30,
            oaBalance: 50_000,
            saBalance: 30_000,
            maBalance: 20_000,
            raBalance: 0,
            totalBalance: 100_000,
            annualContribution: 0,
            annualInterest: 0,
            cpfLifePayout: 0,
            oaHousingDeduction: 0,
            oaShortfall: 0,
            cpfisOA: 0,
            cpfisSA: 0,
            cpfisReturn: 0,
            bequest: 0,
            milestone: null,
            milestoneFormula: null,
          }],
        },
      },
      propertyOrder: [],
      propertiesById: {},
    })
    // 100k liquid + 50k OA + 30k SA + 20k MA + 0 RA = 200k
    expect(computePerAdultNetWorth(adult, plan)).toBe(200_000)
  })

  it('handles foreigner with no CPF rows', () => {
    const adult = makeAdult({ id: 'a1', owner: 'self', liquidNetWorth: 50_000 })
    const plan = makeCompiledPlan({
      cpfByAdultId: {},
      propertyOrder: [],
      propertiesById: {},
    })
    expect(computePerAdultNetWorth(adult, plan)).toBe(50_000)
  })

  it('includes property equity scaled by ownership percent', () => {
    const adult = makeAdult({ id: 'a1', owner: 'self', liquidNetWorth: 0 })
    const plan = makeCompiledPlan({
      cpfByAdultId: {},
      propertyOrder: ['p1'],
      propertiesById: {
        p1: {
          id: 'p1',
          owner: 'self',
          ownsProperty: true,
          existingPropertyValue: 1_000_000,
          existingMortgageBalance: 400_000,
          ownershipPercent: 0.5,
        } as CompiledHouseholdPlan['propertiesById'][string],
      },
    })
    // (1M - 400k) * 0.5 = 300k
    expect(computePerAdultNetWorth(adult, plan)).toBe(300_000)
  })

  it('skips property not owned by this adult', () => {
    const adult = makeAdult({ id: 'a1', owner: 'self', liquidNetWorth: 10_000 })
    const plan = makeCompiledPlan({
      cpfByAdultId: {},
      propertyOrder: ['p1'],
      propertiesById: {
        p1: {
          id: 'p1',
          owner: 'partner',
          ownsProperty: true,
          existingPropertyValue: 1_000_000,
          existingMortgageBalance: 0,
          ownershipPercent: 1,
        } as CompiledHouseholdPlan['propertiesById'][string],
      },
    })
    expect(computePerAdultNetWorth(adult, plan)).toBe(10_000)
  })

  it('skips property where ownsProperty is false', () => {
    const adult = makeAdult({ id: 'a1', owner: 'self', liquidNetWorth: 10_000 })
    const plan = makeCompiledPlan({
      cpfByAdultId: {},
      propertyOrder: ['p1'],
      propertiesById: {
        p1: {
          id: 'p1',
          owner: 'self',
          ownsProperty: false,
          existingPropertyValue: 500_000,
          existingMortgageBalance: 0,
          ownershipPercent: 1,
        } as CompiledHouseholdPlan['propertiesById'][string],
      },
    })
    expect(computePerAdultNetWorth(adult, plan)).toBe(10_000)
  })

  it('clamps negative property equity to zero (W4)', () => {
    const adult = makeAdult({ id: 'a1', owner: 'self', liquidNetWorth: 50_000 })
    const plan = makeCompiledPlan({
      cpfByAdultId: {},
      propertyOrder: ['p1'],
      propertiesById: {
        p1: {
          id: 'p1',
          owner: 'self',
          ownsProperty: true,
          existingPropertyValue: 400_000,
          existingMortgageBalance: 600_000,
          ownershipPercent: 1,
        } as CompiledHouseholdPlan['propertiesById'][string],
      },
    })
    // Underwater property: equity = max(0, 400k - 600k) = 0
    expect(computePerAdultNetWorth(adult, plan)).toBe(50_000)
  })

  it('includes 50% of shared-ownership properties with full ownership (W5)', () => {
    const adult = makeAdult({ id: 'a1', owner: 'self', liquidNetWorth: 0 })
    const plan = makeCompiledPlan({
      cpfByAdultId: {},
      propertyOrder: ['p1'],
      propertiesById: {
        p1: {
          id: 'p1',
          owner: 'shared',
          ownsProperty: true,
          existingPropertyValue: 1_000_000,
          existingMortgageBalance: 400_000,
          ownershipPercent: 1,
        } as CompiledHouseholdPlan['propertiesById'][string],
      },
    })
    // Shared property with 100% household ownership: (1M - 400k) * 1.0 * 0.5 = 300k per adult
    expect(computePerAdultNetWorth(adult, plan)).toBe(300_000)
  })

  it('shared property with default 50% ownershipPercent gives 25% per adult', () => {
    const adult = makeAdult({ id: 'a1', owner: 'self', liquidNetWorth: 0 })
    const plan = makeCompiledPlan({
      cpfByAdultId: {},
      propertyOrder: ['p1'],
      propertiesById: {
        p1: {
          id: 'p1',
          owner: 'shared',
          ownsProperty: true,
          existingPropertyValue: 1_000_000,
          existingMortgageBalance: 0,
          ownershipPercent: 0.5,
        } as CompiledHouseholdPlan['propertiesById'][string],
      },
    })
    // Shared property with 50% household ownership: 1M * 0.5 * 0.5 = 250k per adult
    expect(computePerAdultNetWorth(adult, plan)).toBe(250_000)
  })
})

// ---------------------------------------------------------------------------
// computePerAdultSavings
// ---------------------------------------------------------------------------
describe('computePerAdultSavings', () => {
  it('computes savings with no shared entries', () => {
    // We mock sumActiveIncomeByOwner / sumActiveExpensesByOwner indirectly
    // by providing the compiled plan data the real functions read.
    const plan = makeCompiledPlan({
      adultOrder: ['a1'],
      adultsById: { a1: makeAdult({ id: 'a1', owner: 'self', annualIncome: 100_000 }) },
      incomeOrder: ['i1'],
      incomeById: {
        i1: {
          id: 'i1',
          owner: 'self',
          label: 'Salary',
          kind: 'salary-model',
          annualAmount: 100_000,
          isActive: true,
        } as CompiledHouseholdPlan['incomeById'][string],
      },
      expenseOrder: ['e1'],
      expensesById: {
        e1: {
          id: 'e1',
          owner: 'self',
          label: 'Living',
          kind: 'base-living',
          amount: 3_000,
          periodicity: 'monthly',
        } as CompiledHouseholdPlan['expensesById'][string],
      },
      resolvedTiming: {
        incomeById: { i1: tw(-5, 25) },
        expenseById: { e1: tw(-5, 55) },
        dependentById: {},
        goalById: {},
        assetUnlockYearOffsetById: {},
      } as CompiledHouseholdPlan['resolvedTiming'],
    })
    // Income: 100k, Expenses: 3k*12=36k, Shared: 0 each
    // Savings = (100k + 0) - (36k + 0) = 64k
    expect(computePerAdultSavings(plan, 'self')).toBe(64_000)
  })

  it('splits shared income and expenses 50/50', () => {
    const plan = makeCompiledPlan({
      adultOrder: ['a1'],
      adultsById: { a1: makeAdult({ id: 'a1', owner: 'self' }) },
      incomeOrder: ['i1', 'i2'],
      incomeById: {
        i1: {
          id: 'i1',
          owner: 'self',
          label: 'Salary',
          kind: 'salary-model',
          annualAmount: 80_000,
          isActive: true,
        } as CompiledHouseholdPlan['incomeById'][string],
        i2: {
          id: 'i2',
          owner: 'shared',
          label: 'Rental',
          kind: 'income-stream',
          annualAmount: 24_000,
          isActive: true,
        } as CompiledHouseholdPlan['incomeById'][string],
      },
      expenseOrder: ['e1', 'e2'],
      expensesById: {
        e1: {
          id: 'e1',
          owner: 'self',
          label: 'Living',
          kind: 'base-living',
          amount: 24_000,
          periodicity: 'annual',
        } as CompiledHouseholdPlan['expensesById'][string],
        e2: {
          id: 'e2',
          owner: 'shared',
          label: 'Mortgage',
          kind: 'additional-living',
          amount: 20_000,
          periodicity: 'annual',
        } as CompiledHouseholdPlan['expensesById'][string],
      },
      resolvedTiming: {
        incomeById: { i1: tw(-5, 25), i2: tw(-5, 25) },
        expenseById: { e1: tw(-5, 55), e2: tw(-5, 55) },
        dependentById: {},
        goalById: {},
        assetUnlockYearOffsetById: {},
      } as CompiledHouseholdPlan['resolvedTiming'],
    })
    // Self income: 80k, shared income: 24k (50% = 12k)
    // Self expenses: 24k, shared expenses: 20k (50% = 10k)
    // Savings = (80k + 12k) - (24k + 10k) = 92k - 34k = 58k
    expect(computePerAdultSavings(plan, 'self')).toBe(58_000)
  })

  it('returns negative for zero-income partner', () => {
    const plan = makeCompiledPlan({
      adultOrder: ['a2'],
      adultsById: { a2: makeAdult({ id: 'a2', owner: 'partner' }) },
      incomeOrder: [],
      incomeById: {},
      expenseOrder: ['e1'],
      expensesById: {
        e1: {
          id: 'e1',
          owner: 'partner',
          label: 'Living',
          kind: 'base-living',
          amount: 2_000,
          periodicity: 'monthly',
        } as CompiledHouseholdPlan['expensesById'][string],
      },
      resolvedTiming: {
        incomeById: {},
        expenseById: { e1: tw(-5, 55) },
        dependentById: {},
        goalById: {},
        assetUnlockYearOffsetById: {},
      } as CompiledHouseholdPlan['resolvedTiming'],
    })
    // Income: 0, Expenses: 2k*12=24k
    // Savings = 0 - 24k = -24k
    expect(computePerAdultSavings(plan, 'partner')).toBe(-24_000)
  })
})
