import {
  compileHouseholdPlan,
  type CompiledHouseholdPlan,
} from '@/lib/household/compileHouseholdPlan'
import { fromLegacyIndividual } from '@/lib/household/fromLegacyIndividual'
import { LEGACY_PARITY_FIXTURES } from '@/lib/household/__tests__/legacyParityFixtures'
import type {
  HouseholdPlan,
  PlanningAdult,
  PropertyPlan,
} from '@/lib/household/types'

const DEFAULT_WARMUP_RUNS = 5
const DEFAULT_SAMPLE_RUNS = 40

export interface LaunchSizeCompileBenchmarkSummary {
  warmupRuns: number
  sampleRuns: number
  minMs: number
  maxMs: number
  meanMs: number
  p50Ms: number
  p95Ms: number
}

export interface LaunchSizeCompileBenchmarkResult {
  fixture: HouseholdPlan
  compiled: CompiledHouseholdPlan
  summary: LaunchSizeCompileBenchmarkSummary
}

function makePartnerAdult(self: PlanningAdult): PlanningAdult {
  return {
    ...structuredClone(self),
    id: 'adult-partner',
    owner: 'partner',
    displayName: 'Blair',
    currentAge: 33,
    retirementAge: 58,
    lifeExpectancy: 112,
    annualIncome: 135_000,
    annualExpenses: 0,
    liquidNetWorth: 260_000,
    healthcare: {
      ...structuredClone(self.healthcare),
      enabled: true,
      mediShieldLifeEnabled: true,
      ispTier: 'enhanced',
      careShieldLifeEnabled: true,
      oopBaseAmount: 2_800,
      oopModel: 'fixed',
      oopInflationRate: 0.03,
      oopReferenceAge: 33,
      mediSaveTopUpAnnual: 1_200,
      ispDowngradeTier: 'standard',
      ispDowngradeAge: 70,
    },
    cpf: {
      ...structuredClone(self.cpf),
      balances: {
        oa: 145_000,
        sa: 102_000,
        ma: 48_000,
        ra: 0,
      },
      annualTopUps: {
        oa: 0,
        sa: 4_000,
        ma: 1_500,
      },
      lifeStartAge: 65,
      lifeActualMonthlyPayout: 0,
      oaWithdrawals: [
        {
          id: 'partner-oa-bridge',
          label: 'Partner OA bridge',
          amount: 15_000,
          age: 59,
        },
      ],
    },
    srs: {
      ...structuredClone(self.srs),
      balance: 42_000,
      annualContribution: 7_500,
      investmentReturn: 0.05,
      drawdownStartAge: 63,
      postFireEnabled: false,
    },
    taxProfile: {
      ...structuredClone(self.taxProfile),
      personalReliefs: 9_000,
      reliefBreakdown: null,
      reliefBasisAge: 33,
    },
    lifeEvents: [
      {
        id: 'partner-sabbatical',
        name: 'Partner sabbatical',
        startAge: 45,
        endAge: 46,
        incomeImpact: 0.5,
        affectedStreamIds: [],
        savingsPause: true,
        cpfPause: false,
      },
    ],
  }
}

export function makeLaunchSizeCompileFixture(): HouseholdPlan {
  const fixture = structuredClone(fromLegacyIndividual(LEGACY_PARITY_FIXTURES.propertyAndCpf))
  const self = fixture.adults[0]

  // The rollout plan calls for a launch-size fixture with an 80-year horizon.
  self.displayName = 'Alex'
  self.currentAge = 35
  self.retirementAge = 60
  self.lifeExpectancy = 114
  self.annualIncome = 165_000
  self.annualExpenses = 0
  self.liquidNetWorth = 520_000
  self.healthcare = {
    ...structuredClone(self.healthcare),
    enabled: true,
    mediShieldLifeEnabled: true,
    ispTier: 'standard',
    careShieldLifeEnabled: true,
    oopBaseAmount: 3_200,
    oopModel: 'fixed',
    oopInflationRate: 0.03,
    oopReferenceAge: 35,
    mediSaveTopUpAnnual: 1_800,
  }
  self.cpf = {
    ...structuredClone(self.cpf),
    balances: {
      oa: 190_000,
      sa: 135_000,
      ma: 64_000,
      ra: 0,
    },
    annualTopUps: {
      oa: 0,
      sa: 8_000,
      ma: 4_000,
    },
    lifeStartAge: 65,
    lifeActualMonthlyPayout: 0,
    oaWithdrawals: [
      {
        id: 'self-oa-bridge',
        label: 'Self OA bridge',
        amount: 20_000,
        age: 61,
      },
    ],
  }
  self.srs = {
    ...structuredClone(self.srs),
    balance: 105_000,
    annualContribution: 15_300,
    investmentReturn: 0.05,
    drawdownStartAge: 63,
    postFireEnabled: true,
  }
  self.taxProfile = {
    ...structuredClone(self.taxProfile),
    personalReliefs: 18_000,
    reliefBreakdown: null,
    reliefBasisAge: 35,
  }
  self.lifeEvents = [
    {
      id: 'self-parental-leave',
      name: 'Self parental leave',
      startAge: 37,
      endAge: 38,
      incomeImpact: 0.75,
      affectedStreamIds: [],
      savingsPause: true,
      cpfPause: false,
    },
  ]

  fixture.planType = 'household'
  fixture.adults = [self, makePartnerAdult(self)]
  fixture.dependents = [
    {
      id: 'dependent-child-1',
      owner: 'shared',
      label: 'Child 1',
      relationship: 'child',
      currentAge: 6,
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 35,
        endAge: 53,
      },
      annualCost: 18_000,
    },
    {
      id: 'dependent-child-2',
      owner: 'shared',
      label: 'Child 2',
      relationship: 'child',
      currentAge: 3,
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 33,
        endAge: 54,
      },
      annualCost: 16_000,
    },
    {
      id: 'dependent-parent',
      owner: 'self',
      label: 'Parent care',
      relationship: 'parent',
      currentAge: 68,
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 45,
        endAge: 62,
      },
      annualCost: 9_600,
    },
  ]

  fixture.income = [
    {
      ...structuredClone(fixture.income[0]),
      id: 'income-salary-self',
      owner: 'self',
      label: 'Alex salary',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 35,
        endAge: 60,
      },
      annualAmount: 165_000,
      growthRate: 0.03,
      bonusMonths: 2,
      employerCpfEnabled: true,
      realisticPhases: [],
      promotionJumps: [
        { age: 43, increasePercent: 0.1 },
      ],
    },
    {
      ...structuredClone(fixture.income[1]),
      id: 'income-rental-self',
      owner: 'self',
      label: 'Rental income',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 35,
        endAge: 90,
      },
      annualAmount: 28_800,
      growthRate: 0.02,
    },
    {
      ...structuredClone(fixture.income[0]),
      id: 'income-salary-partner',
      owner: 'partner',
      label: 'Blair salary',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 33,
        endAge: 58,
      },
      annualAmount: 135_000,
      growthRate: 0.028,
      bonusMonths: 1,
      employerCpfEnabled: true,
      realisticPhases: [],
      promotionJumps: [
        { age: 40, increasePercent: 0.08 },
      ],
    },
    {
      ...structuredClone(fixture.income[1]),
      id: 'income-consulting-partner',
      owner: 'partner',
      label: 'Consulting income',
      kind: 'income-stream',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 36,
        endAge: 64,
      },
      annualAmount: 18_000,
      growthRate: 0.01,
      growthModel: 'fixed',
      taxTreatment: 'taxable',
      isCpfApplicable: false,
      isActive: true,
      streamType: 'business',
    },
  ]

  fixture.expenses = [
    {
      id: 'expense-base-shared',
      owner: 'shared',
      label: 'Shared living',
      kind: 'base-living',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 35,
        endAge: 114,
      },
      amount: 66_000,
      periodicity: 'annual',
      retirementSpendingAdjustment: 0.78,
    },
    {
      id: 'expense-base-self',
      owner: 'self',
      label: 'Self private spend',
      kind: 'base-living',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 35,
        endAge: 114,
      },
      amount: 12_000,
      periodicity: 'annual',
      retirementSpendingAdjustment: 0.6,
    },
    {
      id: 'expense-base-partner',
      owner: 'partner',
      label: 'Partner private spend',
      kind: 'base-living',
      timing: {
        kind: 'age-range',
        owner: 'partner',
        startAge: 33,
        endAge: 112,
      },
      amount: 10_800,
      periodicity: 'annual',
      retirementSpendingAdjustment: 0.6,
    },
    {
      id: 'expense-childcare-step-up',
      owner: 'shared',
      label: 'Childcare step-up',
      kind: 'expense-adjustment',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 35,
        endAge: 44,
      },
      amount: 7_200,
      periodicity: 'annual',
      growthRate: 0.02,
    },
    {
      id: 'expense-aging-parent-support',
      owner: 'self',
      label: 'Aging parent support',
      kind: 'parent-support',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 45,
        endAge: 62,
      },
      amount: 800,
      periodicity: 'monthly',
      growthRate: 0.02,
    },
    {
      id: 'expense-retirement-withdrawal',
      owner: 'shared',
      label: 'Home refresh',
      kind: 'retirement-withdrawal',
      timing: {
        kind: 'age-range',
        owner: 'self',
        startAge: 66,
        endAge: 67,
      },
      amount: 18_000,
      periodicity: 'annual',
      durationYears: 2,
      inflationAdjusted: true,
    },
  ]

  fixture.assets = [
    {
      id: 'asset-liquid-self',
      owner: 'self',
      label: 'Liquid self',
      kind: 'liquid-net-worth',
      amount: 520_000,
    },
    {
      id: 'asset-liquid-partner',
      owner: 'partner',
      label: 'Liquid partner',
      kind: 'liquid-net-worth',
      amount: 260_000,
    },
    {
      id: 'asset-rsu-self',
      owner: 'self',
      label: 'Self RSU vesting',
      kind: 'locked-asset',
      amount: 70_000,
      unlockAge: 41,
      growthRate: 0.06,
    },
    {
      id: 'asset-espp-partner',
      owner: 'partner',
      label: 'Partner ESPP vesting',
      kind: 'locked-asset',
      amount: 48_000,
      unlockAge: 39,
      growthRate: 0.05,
    },
  ]

  fixture.goals = [
    {
      id: 'goal-university',
      owner: 'shared',
      label: 'University fund',
      kind: 'financial-goal',
      timing: {
        kind: 'single-age',
        owner: 'self',
        age: 50,
      },
      amount: 140_000,
      durationYears: 4,
      priority: 'essential',
      inflationAdjusted: true,
      category: 'education',
    },
    {
      id: 'goal-renovation',
      owner: 'shared',
      label: 'Renovation refresh',
      kind: 'financial-goal',
      timing: {
        kind: 'single-age',
        owner: 'self',
        age: 55,
      },
      amount: 45_000,
      durationYears: 1,
      priority: 'important',
      inflationAdjusted: false,
      category: 'housing',
    },
    {
      id: 'goal-retirement-travel',
      owner: 'partner',
      label: 'Retirement travel',
      kind: 'financial-goal',
      timing: {
        kind: 'single-age',
        owner: 'partner',
        age: 63,
      },
      amount: 30_000,
      durationYears: 1,
      priority: 'nice-to-have',
      inflationAdjusted: false,
      category: 'travel',
    },
  ]

  const existingProperty = fixture.properties[0] ?? ({} as PropertyPlan)
  fixture.properties = [
    {
      ...structuredClone(existingProperty),
      id: 'property-family-home',
      owner: 'self',
      label: 'Family home',
      propertyType: 'hdb',
      residencyForAbsd: 'pr',
      propertyCount: 1,
      ownsProperty: true,
      existingPropertyValue: 1_550_000,
      existingMortgageBalance: 610_000,
      existingMonthlyPayment: 3_450,
      existingMortgageRate: 0.028,
      existingMortgageRemainingYears: 24,
      mortgageCpfMonthly: 1_900,
      ownershipPercent: 0.5,
      existingAppreciationRate: 0.025,
      existingLeaseYears: 83,
      downsizing: {
        scenario: 'sell-and-downsize',
        sellAge: 64,
        expectedSalePrice: 1_720_000,
        newPropertyCost: 980_000,
        newMortgageRate: 0.03,
        newMortgageTerm: 18,
        newLtv: 0.5,
        monthlyRent: 0,
        rentGrowthRate: 0.02,
      },
      hdbFlatType: '5-room',
      hdbMonetizationStrategy: 'sublet',
      hdbLbsRetainedLease: 35,
      hdbSublettingRooms: 2,
      hdbSublettingRate: 1_400,
      hdbCpfUsedForHousing: 82_000,
    },
  ]

  fixture.assumptions.returns.inflation = 0.025

  return fixture
}

function percentile(samples: number[], percent: number): number {
  const sorted = [...samples].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1)
  )
  return sorted[index]
}

export function runLaunchSizeCompileBenchmark(options?: {
  warmupRuns?: number
  sampleRuns?: number
}): LaunchSizeCompileBenchmarkResult {
  const warmupRuns = options?.warmupRuns ?? DEFAULT_WARMUP_RUNS
  const sampleRuns = options?.sampleRuns ?? DEFAULT_SAMPLE_RUNS
  const fixture = makeLaunchSizeCompileFixture()
  const samples: number[] = []
  let compiled = compileHouseholdPlan(fixture)

  for (let run = 0; run < warmupRuns + sampleRuns; run += 1) {
    const start = performance.now()
    compiled = compileHouseholdPlan(fixture)
    const durationMs = performance.now() - start

    if (run >= warmupRuns) {
      samples.push(durationMs)
    }
  }

  const totalMs = samples.reduce((sum, sample) => sum + sample, 0)
  const summary: LaunchSizeCompileBenchmarkSummary = {
    warmupRuns,
    sampleRuns,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    meanMs: totalMs / sampleRuns,
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
  }

  return {
    fixture,
    compiled,
    summary,
  }
}
