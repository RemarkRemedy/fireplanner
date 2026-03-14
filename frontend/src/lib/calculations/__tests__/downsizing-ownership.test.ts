/* eslint-disable @typescript-eslint/no-explicit-any -- test helpers use partial store shapes */
import { describe, expect, it } from 'vitest'
import { compileHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import type { HouseholdPlan, PlanningAdult, PropertyPlan } from '@/lib/household/types'
import { buildLegacyMonteCarloEngineParams } from '@/lib/simulation/monteCarloParams'
import { buildFullProjectionParams } from '@/lib/calculations/projectionParams'
import { generateProjection } from '@/lib/calculations/projection'
import { mergePerAdultProjections } from '@/lib/calculations/income'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'

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

// Shared constants for MC and projection tests
const BASE_ALLOCATION = {
  currentWeights: [0.25, 0.05, 0.10, 0.35, 0.05, 0.05, 0.15, 0],
  targetWeights: [0.20, 0.05, 0.10, 0.40, 0.05, 0.05, 0.15, 0],
  returnOverrides: [null, null, null, null, null, null, null, null],
  stdDevOverrides: [null, null, null, null, null, null, null, null],
  glidePathConfig: { enabled: false, method: 'linear' as const, startAge: 60, endAge: 75 },
  validationErrors: {},
}

const BASE_SIMULATION = {
  selectedStrategy: 'constant_dollar' as const,
  strategyParams: {
    constant_dollar: { swr: 0.04 },
    vpw: { expectedRealReturn: 0.03, targetEndValue: 0.10 },
    guardrails: { initialRate: 0.05, ceilingTrigger: 1.20, floorTrigger: 0.80, adjustmentSize: 0.10 },
    vanguard_dynamic: { swr: 0.04, ceiling: 0.05, floor: 0.025 },
    cape_based: { baseRate: 0.04, capeWeight: 0.50, currentCape: 30 },
    floor_ceiling: { floor: 60_000, ceiling: 150_000, targetRate: 0.045 },
    percent_of_portfolio: { rate: 0.04 },
    one_over_n: {},
    sensible_withdrawals: { baseRate: 0.03, extrasRate: 0.10 },
    ninety_five_percent: { swr: 0.04 },
    endowment: { swr: 0.04, smoothingWeight: 0.70 },
    hebeler_autopilot: { expectedRealReturn: 0.03 },
  },
  withdrawalBasis: 'expenses' as const,
}

function buildMcStores(ownershipPercent: number) {
  const fixture = makeDownsizingFixture(ownershipPercent)
  const adult = fixture.adults[0]
  const prop = fixture.properties[0]

  const profile = {
    currentAge: adult.currentAge,
    retirementAge: adult.retirementAge,
    lifeExpectancy: adult.lifeExpectancy,
    swr: 0.04,
    annualExpenses: adult.annualExpenses,
    inflation: 0.025,
    expectedReturn: 0.07,
    usePortfolioReturn: false,
    expenseRatio: 0.003,
    initialLiquidNW: adult.liquidNetWorth,
    liquidNetWorth: adult.liquidNetWorth,
    retirementSpendingAdjustment: 1.0,
    parentSupport: [],
    parentSupportEnabled: false,
    healthcareConfig: { enabled: false } as any,
    retirementWithdrawals: [],
    financialGoals: [],
    expenseAdjustments: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    cpfLifeStartAge: 65,
    cpfLifePlan: 'standard' as const,
    cpfOaWithdrawals: [],
    lockedAssets: [],
    validationErrors: {},
    cpfOA: 0,
    cpfSA: 0,
    cpfMA: 0,
    cpfRA: 0,
  }

  const income = {
    salaryModel: 'simple' as const,
    annualSalary: adult.annualIncome,
    salaryGrowthRate: 0.03,
    bonusMonths: 2,
    employerCpfEnabled: true,
    incomeStreams: [],
    lifeEvents: [],
    lifeEventsEnabled: false,
    realisticPhases: [],
    promotionJumps: [],
    momEducation: 'degree' as const,
    momAdjustment: 1.0,
    personalReliefs: 0,
    reliefBreakdown: null,
    reliefBasisAge: adult.currentAge,
    validationErrors: {},
  }

  const property = {
    ownsProperty: prop.ownsProperty,
    ownershipPercent: prop.ownershipPercent,
    existingPropertyValue: prop.existingPropertyValue,
    existingAppreciationRate: prop.existingAppreciationRate,
    existingLeaseYears: prop.existingLeaseYears,
    existingApplyBalaDecay: prop.existingApplyBalaDecay,
    existingMortgageBalance: prop.existingMortgageBalance,
    existingMortgageRate: prop.existingMortgageRate,
    existingMonthlyPayment: prop.existingMonthlyPayment,
    existingMortgageRemainingYears: prop.existingMortgageRemainingYears,
    mortgageCpfMonthly: prop.mortgageCpfMonthly,
    residencyForAbsd: prop.residencyForAbsd,
    propertyCount: prop.propertyCount,
    hdbCpfUsedForHousing: prop.hdbCpfUsedForHousing,
    hdbSublettingRooms: prop.hdbSublettingRooms,
    hdbSublettingRate: prop.hdbSublettingRate,
    downsizing: prop.downsizing,
  }

  return { profile, income, property }
}

describe('downsizing ownership scaling: legacy MC path', () => {
  it('scales downsizing portfolio adjustment by ownershipPercent', () => {
    const fullStores = buildMcStores(1.0)
    const halfStores = buildMcStores(0.5)

    const fullResult = buildLegacyMonteCarloEngineParams({
      profile: fullStores.profile as any,
      income: fullStores.income as any,
      allocation: BASE_ALLOCATION as any,
      simulation: BASE_SIMULATION as any,
      property: fullStores.property as any,
    })
    const halfResult = buildLegacyMonteCarloEngineParams({
      profile: halfStores.profile as any,
      income: halfStores.income as any,
      allocation: BASE_ALLOCATION as any,
      simulation: BASE_SIMULATION as any,
      property: halfStores.property as any,
    })

    const fullAdj = fullResult.portfolioAdjustments?.find((a) => a.amount !== 0)
    const halfAdj = halfResult.portfolioAdjustments?.find((a) => a.amount !== 0)

    expect(fullAdj).toBeDefined()
    expect(halfAdj).toBeDefined()
    expect(halfAdj!.amount).toBeCloseTo(fullAdj!.amount * 0.5, 0)
  })
})

function buildProjectionForOwnership(ownershipPercent: number) {
  const plan = makeDownsizingFixture(ownershipPercent)
  const compiled = compileHouseholdPlan(plan)
  const runtime = buildHouseholdRuntimeLegacyInputs(plan, compiled)

  const incomeProjection = mergePerAdultProjections({
    perAdultProjections: compiled.incomeByAdultId,
    adultOrder: compiled.adultOrder,
    referenceCurrentAge: runtime.profile.currentAge,
    referenceRetirementYearOffset: compiled.householdRetirementYearOffset,
    annualExpenses: runtime.profile.annualExpenses,
    inflation: runtime.profile.inflation,
    lockedAssets: runtime.profile.lockedAssets,
    expenseAdjustments: runtime.profile.expenseAdjustments,
  })

  const { params } = buildFullProjectionParams({
    profile: runtime.profile,
    income: runtime.income,
    property: runtime.property,
    allocation: BASE_ALLOCATION,
    simulation: BASE_SIMULATION,
    ages: {
      currentAge: runtime.profile.currentAge,
      retirementAge: runtime.profile.retirementAge,
      lifeExpectancy: runtime.profile.lifeExpectancy,
    },
    incomeProjection,
    healthcareCashOutlayByYear: runtime.healthcareCashOutlayByYear,
  })

  return generateProjection(params)
}

describe('downsizing ownership scaling: deterministic projection path', () => {
  it('scales downsizing equity injection by ownershipPercent', () => {
    const fullProjection = buildProjectionForOwnership(1.0)
    const halfProjection = buildProjectionForOwnership(0.5)

    const sellAge = 60
    const fullSellRow = fullProjection.rows.find((r) => r.age === sellAge)
    const halfSellRow = halfProjection.rows.find((r) => r.age === sellAge)

    expect(fullSellRow).toBeDefined()
    expect(halfSellRow).toBeDefined()

    // The liquidNW jump at sell age should be ~half for 50% ownership.
    const fullPreSell = fullProjection.rows.find((r) => r.age === sellAge - 1)
    const halfPreSell = halfProjection.rows.find((r) => r.age === sellAge - 1)

    const fullEquityJump = fullSellRow!.liquidNW - fullPreSell!.liquidNW
    const halfEquityJump = halfSellRow!.liquidNW - halfPreSell!.liquidNW

    // The ratio should be close to 0.5. It won't be exact because non-property
    // cash flows (savings, portfolio returns, expenses) are identical for both cases,
    // so only the property-related portion of the jump scales by ownership.
    const ratio = halfEquityJump / fullEquityJump
    expect(ratio).toBeGreaterThan(0.4)
    expect(ratio).toBeLessThan(0.7)
  })
})

describe('couple plan downsizing ownership scaling', () => {
  it('scales downsizing equity injection by ownership percent in couple plan', () => {
    // Build a couple plan with shared property at 100% and 50% ownership
    const fullPlan = makeDownsizingFixture(1.0)
    const halfPlan = makeDownsizingFixture(0.5)

    // Convert both to couple plans by adding a partner adult
    for (const plan of [fullPlan, halfPlan]) {
      plan.planType = 'couple'
      plan.adults[0].maritalStatus = 'married'
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

    // Find the downsizing portfolio adjustment by kind
    const fullAdj = fullCompiled.portfolioAdjustments.find((a) => a.kind === 'downsizing')
    const halfAdj = halfCompiled.portfolioAdjustments.find((a) => a.kind === 'downsizing')

    expect(fullAdj).toBeDefined()
    expect(halfAdj).toBeDefined()
    // 50% ownership should produce roughly half the equity injection
    const ratio = halfAdj!.amount / fullAdj!.amount
    expect(ratio).toBeGreaterThan(0.4)
    expect(ratio).toBeLessThan(0.7)
  })
})

// Export the fixture for use by downstream tests (Task 3 projection path)
export { makeDownsizingFixture }
