import { describe, expect, it } from 'vitest'
import type { ReliefBreakdown } from '@/lib/data/taxBrackets'
import { mergePerAdultProjections } from '@/lib/calculations/income'
import { generateProjection } from '@/lib/calculations/projection'
import { buildFullProjectionParams } from '@/lib/calculations/projectionParams'
import { compileHouseholdPlan, type CompiledHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import { buildHouseholdRuntimeLegacyInputs } from '@/lib/household/runtimeLegacyInputs'
import type {
  ExpenseItem,
  GoalItem,
  HouseholdPlan,
  PlanningAdult,
} from '@/lib/household/types'
import type { AllocationState, SimulationState, StrategyParamsMap } from '@/lib/types'

/**
 * Two-adult fixture with deliberately different configs for every field under test.
 * TJ (self): age 32, retires at 55, life expectancy 85
 * Chloe (partner): age 28, retires at 60, life expectancy 90
 * Age delta: 4 years (TJ is older)
 */
function makeTwoAdultFixture(): HouseholdPlan {
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
    healthcare: {
      ...structuredClone(tj.healthcare),
      oopReferenceAge: 28,
    },
    cpf: {
      ...structuredClone(tj.cpf),
      balances: { oa: 30_000, sa: 20_000, ma: 15_000, ra: 0 },
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
      momEducation: 'diploma',
      momAdjustment: 0.9,
      personalReliefs: 2_000,
      reliefBreakdown: null,
      reliefBasisAge: 28,
    },
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

  const partnerRetirementWithdrawal: ExpenseItem = {
    id: 'expense-retirement-withdrawal-chloe-travel',
    owner: 'partner',
    label: "Chloe's Travel Fund",
    kind: 'retirement-withdrawal',
    timing: { kind: 'single-age', owner: 'partner', age: 62 },
    amount: 20_000,
    periodicity: 'one-off',
    durationYears: 3,
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

  return {
    schemaVersion: 1,
    id: 'test-seam-fixture',
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
    expenses: [
      baseLiving,
      partnerParentSupport,
      partnerExpenseAdj,
      partnerRetirementWithdrawal,
    ],
    assets: [],
    goals: [partnerGoal],
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

const BASE_STRATEGY_PARAMS: StrategyParamsMap = {
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
}

const BASE_ALLOCATION: Pick<
  AllocationState,
  'currentWeights' | 'targetWeights' | 'returnOverrides' | 'glidePathConfig' | 'validationErrors'
> = {
  currentWeights: [0.25, 0.05, 0.10, 0.35, 0.05, 0.05, 0.15, 0],
  targetWeights: [0.20, 0.05, 0.10, 0.40, 0.05, 0.05, 0.15, 0],
  returnOverrides: [null, null, null, null, null, null, null, null],
  glidePathConfig: {
    enabled: false,
    method: 'linear',
    startAge: 60,
    endAge: 75,
  },
  validationErrors: {},
}

const BASE_SIMULATION: Pick<
  SimulationState,
  'selectedStrategy' | 'strategyParams' | 'withdrawalBasis'
> = {
  selectedStrategy: 'constant_dollar',
  strategyParams: BASE_STRATEGY_PARAMS,
  withdrawalBasis: 'expenses',
}

interface RuntimeOverrides {
  profile?: Partial<ReturnType<typeof buildHouseholdRuntimeLegacyInputs>['profile']>
  income?: Partial<ReturnType<typeof buildHouseholdRuntimeLegacyInputs>['income']>
  property?: Partial<ReturnType<typeof buildHouseholdRuntimeLegacyInputs>['property']>
  healthcareCashOutlayByYear?: number[]
}

function buildJointProjection(
  plan: HouseholdPlan,
  compiled: CompiledHouseholdPlan,
  runtimeOverrides?: RuntimeOverrides,
) {
  const runtime = buildHouseholdRuntimeLegacyInputs(plan, compiled)
  const profile = runtimeOverrides?.profile
    ? { ...runtime.profile, ...runtimeOverrides.profile }
    : runtime.profile
  const income = runtimeOverrides?.income
    ? { ...runtime.income, ...runtimeOverrides.income }
    : runtime.income
  const property = runtimeOverrides?.property
    ? { ...runtime.property, ...runtimeOverrides.property }
    : runtime.property
  const healthcareCashOutlayByYear = runtimeOverrides?.healthcareCashOutlayByYear
    ?? runtime.healthcareCashOutlayByYear

  const incomeProjection = mergePerAdultProjections({
    perAdultProjections: compiled.incomeByAdultId,
    adultOrder: compiled.adultOrder,
    referenceCurrentAge: profile.currentAge,
    referenceRetirementYearOffset: compiled.householdRetirementYearOffset,
    annualExpenses: profile.annualExpenses,
    inflation: profile.inflation,
    lockedAssets: profile.lockedAssets,
    expenseAdjustments: profile.expenseAdjustments,
  })

  const { params, fireMetrics } = buildFullProjectionParams({
    profile,
    income,
    property,
    allocation: BASE_ALLOCATION,
    simulation: BASE_SIMULATION,
    ages: {
      currentAge: profile.currentAge,
      retirementAge: profile.retirementAge,
      lifeExpectancy: profile.lifeExpectancy,
    },
    incomeProjection,
    healthcareCashOutlayByYear,
  })

  return { runtime: { profile, income, property, healthcareCashOutlayByYear }, fireMetrics, projection: generateProjection(params) }
}

const ALT_RELIEF_BREAKDOWN: ReliefBreakdown = {
  earnedIncomeRelief: 1_000,
  nsmanStatus: 'none',
  nsmanKAH: false,
  spouseRelief: false,
  nChildren: 0,
  parentReliefType: 'none',
  nParents: 0,
  otherReliefs: 12_345,
}

describe('household adapter seam: timing owner age shift', () => {
  it('shifts partner-owned parent support timing to reference adult ages', () => {
    const plan = makeTwoAdultFixture()
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    const ps = result.profile.parentSupport.find((p) => p.id === 'chloe-mom')
    expect(ps).toBeDefined()
    expect(ps?.startAge).toBe(34)
    expect(ps?.endAge).toBe(64)
  })

  it('shifts partner-owned expense adjustment timing to reference adult ages', () => {
    const plan = makeTwoAdultFixture()
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    const adj = result.profile.expenseAdjustments.find((a) => a.id === 'childcare')
    expect(adj).toBeDefined()
    expect(adj?.startAge).toBe(36)
    expect(adj?.endAge).toBe(42)
  })

  it('shifts partner-owned retirement withdrawal timing to reference adult ages', () => {
    const plan = makeTwoAdultFixture()
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    const rw = result.profile.retirementWithdrawals.find((r) => r.id === 'chloe-travel')
    expect(rw).toBeDefined()
    expect(rw?.age).toBe(66)
  })

  it('shifts partner-owned financial goal timing to reference adult ages', () => {
    const plan = makeTwoAdultFixture()
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    const goal = result.profile.financialGoals.find((g) => g.id === 'chloe-education')
    expect(goal).toBeDefined()
    expect(goal?.targetAge).toBe(44)
  })

  it('does not shift self-owned timing (delta = 0)', () => {
    const plan = makeTwoAdultFixture()
    plan.expenses.push({
      id: 'expense-parent-support-tj-dad',
      owner: 'self',
      label: "TJ's Dad Support",
      kind: 'parent-support',
      timing: { kind: 'age-range', owner: 'self', startAge: 35, endAge: 70 },
      amount: 300,
      periodicity: 'monthly',
      growthRate: 0.01,
      growthModel: 'fixed',
    })
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    const ps = result.profile.parentSupport.find((p) => p.id === 'tj-dad')
    expect(ps?.startAge).toBe(35)
    expect(ps?.endAge).toBe(70)
  })
})

describe('household adapter seam: CPF merge strategies', () => {
  it('uses standard cpfLifePlan when any adult chose standard', () => {
    const plan = makeTwoAdultFixture()
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    expect(result.profile.cpfLifePlan).toBe('standard')
  })

  it('uses basic cpfLifePlan only when ALL adults chose basic', () => {
    const plan = makeTwoAdultFixture()
    plan.adults[0].cpf.lifePlan = 'basic'
    plan.adults[1].cpf.lifePlan = 'basic'
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    expect(result.profile.cpfLifePlan).toBe('basic')
  })

  it('uses "always" cpfVirtualRebalancingMode when any adult chose "always"', () => {
    const plan = makeTwoAdultFixture()
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    expect(result.profile.cpfVirtualRebalancingMode).toBe('always')
  })

  it('uses "from55" cpfVirtualRebalancingMode when all adults chose "from55"', () => {
    const plan = makeTwoAdultFixture()
    plan.adults[1].cpf.virtualRebalancingMode = 'from55'
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    expect(result.profile.cpfVirtualRebalancingMode).toBe('from55')
  })

  it('uses highest cpfRetirementSum tier when adults differ', () => {
    const plan = makeTwoAdultFixture()
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    expect(result.profile.cpfRetirementSum).toBe('frs')
  })

  it('uses ers cpfRetirementSum when any adult chose ers', () => {
    const plan = makeTwoAdultFixture()
    plan.adults[1].cpf.retirementSum = 'ers'
    const compiled = compileHouseholdPlan(plan)
    const result = buildHouseholdRuntimeLegacyInputs(plan, compiled)

    expect(result.profile.cpfRetirementSum).toBe('ers')
  })
})

describe('household adapter seam: fields not consumed in joint path', () => {
  it('momEducation/momAdjustment on merged IncomeState are not used by joint projection', () => {
    const plan = makeTwoAdultFixture()
    const compiled = compileHouseholdPlan(plan)
    const baseline = buildJointProjection(plan, compiled)
    const changed = buildJointProjection(plan, compiled, {
      income: {
        momEducation: 'secondary',
        momAdjustment: 0.5,
      },
    })

    expect(baseline.runtime.income.momEducation).toBe('degree')
    expect(changed.runtime.income.momEducation).toBe('secondary')
    expect(baseline.runtime.income.momAdjustment).toBe(1)
    expect(changed.runtime.income.momAdjustment).toBe(0.5)
    expect(changed.fireMetrics).toEqual(baseline.fireMetrics)
    expect(changed.projection.rows).toEqual(baseline.projection.rows)
    expect(changed.projection.summary).toEqual(baseline.projection.summary)
  })

  it('reliefBreakdown/reliefBasisAge on merged IncomeState are not used by joint projection', () => {
    const plan = makeTwoAdultFixture()
    const compiled = compileHouseholdPlan(plan)
    const baseline = buildJointProjection(plan, compiled)
    const changed = buildJointProjection(plan, compiled, {
      income: {
        reliefBreakdown: ALT_RELIEF_BREAKDOWN,
        reliefBasisAge: 60,
      },
    })

    expect(baseline.runtime.income.reliefBreakdown).toBeNull()
    expect(changed.runtime.income.reliefBreakdown).toEqual(ALT_RELIEF_BREAKDOWN)
    expect(baseline.runtime.income.reliefBasisAge).toBe(32)
    expect(changed.runtime.income.reliefBasisAge).toBe(60)
    expect(changed.fireMetrics).toEqual(baseline.fireMetrics)
    expect(changed.projection.rows).toEqual(baseline.projection.rows)
    expect(changed.projection.summary).toEqual(baseline.projection.summary)
  })
})
