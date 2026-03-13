import { describe, expect, it } from 'vitest'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import type { HouseholdPlan, PlanningAdult, PropertyPlan } from '@/lib/household/types'

function makeDownsizingFixture(ownershipPercent: number): HouseholdPlan {
  const adult: PlanningAdult = {
    id: 'adult-tj',
    owner: 'self',
    displayName: 'TJ',
    currentAge: 32,
    retirementAge: 55,
    lifeExpectancy: 85,
    lifeStage: 'pre-fire',
    maritalStatus: 'single',
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
      virtualRebalancing: false,
      virtualRebalancingMode: 'from55',
    },
    srs: {
      balance: 0,
      annualContribution: 0,
      investmentReturn: 0.04,
      drawdownStartAge: 62,
      postFireEnabled: false,
    },
    taxProfile: {
      momEducation: 'degree',
      momAdjustment: 1.0,
      personalReliefs: 0,
      reliefBreakdown: null,
      reliefBasisAge: 32,
    },
    lifeEvents: [],
    cashSavings: 50_000,
    nonMortgageDebtTotal: 0,
    nonMortgageDebtMonthlyPayment: 0,
    insuranceDeathCoverage: 0,
    insuranceCICoverage: 0,
    insuranceDisabilityMonthly: 0,
    funeralCosts: 0,
    ciRecoveryYears: 5,
  }

  const property: PropertyPlan = {
    id: 'prop-1',
    owner: 'self',
    label: 'HDB',
    propertyType: 'hdb',
    purchasePrice: 800_000,
    leaseYears: 99,
    appreciationRate: 0.02,
    rentalYield: 0,
    mortgageRate: 0.026,
    mortgageTerm: 25,
    ltv: 0.75,
    purchaseYearsFromNow: 0,
    ownsProperty: true,
    ownershipPercent: ownershipPercent,
    existingPropertyValue: 800_000,
    existingAppreciationRate: 0.02,
    existingLeaseYears: 90,
    existingApplyBalaDecay: false,
    existingMortgageBalance: 400_000,
    existingMortgageRate: 0.026,
    existingMonthlyPayment: 2_000,
    existingMortgageRemainingYears: 20,
    mortgageCpfMonthly: 1_000,
    residencyForAbsd: 'citizen',
    propertyCount: 1,
    hdbFlatType: '4-room',
    hdbLbsRetainedLease: 35,
    hdbCpfUsedForHousing: 0,
    hdbSublettingRooms: 0,
    hdbSublettingRate: 0,
    hdbMonetizationStrategy: 'none',
    downsizing: {
      scenario: 'sell-and-downsize',
      sellAge: 60,
      expectedSalePrice: 1_000_000,
      newPropertyCost: 600_000,
      newLtv: 0.75,
      newMortgageRate: 0.03,
      newMortgageTerm: 25,
      monthlyRent: 0,
      rentGrowthRate: 0.03,
    },
  }

  return {
    schemaVersion: 1,
    id: 'test-downsizing-fixture',
    planType: 'individual',
    planYear: 2026,
    adults: [adult],
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
    ],
    expenses: [],
    assets: [],
    goals: [],
    properties: [property],
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

describe('downsizing ownership scaling: compiler path', () => {
  it('scales downsizing equity injection by ownershipPercent', () => {
    const fullPlan = makeDownsizingFixture(1.0)
    const halfPlan = makeDownsizingFixture(0.5)

    const fullCompiled = compileHouseholdPlan(fullPlan)
    const halfCompiled = compileHouseholdPlan(halfPlan)

    // Find the downsizing portfolio adjustment
    const fullAdj = fullCompiled.portfolioAdjustments.find((a) => a.kind === 'downsizing')
    const halfAdj = halfCompiled.portfolioAdjustments.find((a) => a.kind === 'downsizing')

    expect(fullAdj).toBeDefined()
    expect(halfAdj).toBeDefined()

    // 50% ownership should produce exactly half the equity injection
    expect(halfAdj!.amount).toBeCloseTo(fullAdj!.amount * 0.5, 0)
  })

  it('scales post-sale annual mortgage by ownershipPercent', () => {
    const fullPlan = makeDownsizingFixture(1.0)
    const halfPlan = makeDownsizingFixture(0.5)

    const fullCompiled = compileHouseholdPlan(fullPlan)
    const halfCompiled = compileHouseholdPlan(halfPlan)

    // After sell age, propertyExpense includes post-sale mortgage.
    // Use the first year AFTER sell to isolate post-sale mortgage (pre-sale mortgage is paid off by then).
    const sellYearOffset = 60 - 32 // sellAge - currentAge = 28
    const postSellYear = sellYearOffset + 1
    const fullRow = fullCompiled.rows[postSellYear]
    const halfRow = halfCompiled.rows[postSellYear]

    expect(fullRow).toBeDefined()
    expect(halfRow).toBeDefined()
    // Post-sale mortgage expense should be ~50% for half ownership
    expect(halfRow.propertyExpense).toBeCloseTo(fullRow.propertyExpense * 0.5, 0)
  })

  it('scales sell-and-rent annual rent by ownershipPercent', () => {
    const fullPlan = makeDownsizingFixture(1.0)
    const halfPlan = makeDownsizingFixture(0.5)

    // Switch to sell-and-rent scenario
    fullPlan.properties[0].downsizing.scenario = 'sell-and-rent'
    fullPlan.properties[0].downsizing.monthlyRent = 2_500
    halfPlan.properties[0].downsizing.scenario = 'sell-and-rent'
    halfPlan.properties[0].downsizing.monthlyRent = 2_500

    const fullCompiled = compileHouseholdPlan(fullPlan)
    const halfCompiled = compileHouseholdPlan(halfPlan)

    // At sell year, propertyExpense is the annual rent
    const sellYearOffset = 60 - 32
    const fullRow = fullCompiled.rows[sellYearOffset]
    const halfRow = halfCompiled.rows[sellYearOffset]

    expect(fullRow).toBeDefined()
    expect(halfRow).toBeDefined()
    expect(halfRow.propertyExpense).toBeCloseTo(fullRow.propertyExpense * 0.5, 0)
  })
})

// Export the fixture for use by Task 2 and Task 3 tests
export { makeDownsizingFixture }
