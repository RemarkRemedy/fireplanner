import { computeTotalReliefs, type ReliefBreakdown } from '@/lib/data/taxBrackets'
import type { HouseholdPlan, PlanningAdult, ExpenseItem, GoalItem } from '@/lib/household/types'
import {
  DEFAULT_INCOME,
  INCOME_DATA_KEYS,
} from '@/stores/useIncomeStore'
import {
  DEFAULT_PROFILE,
  PROFILE_DATA_KEYS,
} from '@/stores/useProfileStore'
import {
  DEFAULT_PROPERTY,
  PROPERTY_DATA_KEYS,
} from '@/stores/usePropertyStore'
import type { LegacyIndividualSnapshot } from '../fromLegacyIndividual'

function pickPersistedState<TState extends Record<string, unknown>, TKey extends keyof TState>(
  state: TState,
  keys: readonly TKey[]
): Pick<TState, TKey> {
  const picked = {} as Pick<TState, TKey>
  for (const key of keys) {
    picked[key] = state[key]
  }
  return picked
}

function makeBaseSnapshot(): LegacyIndividualSnapshot {
  return {
    profile: pickPersistedState(DEFAULT_PROFILE, PROFILE_DATA_KEYS),
    income: pickPersistedState(DEFAULT_INCOME, INCOME_DATA_KEYS),
    property: pickPersistedState(DEFAULT_PROPERTY, PROPERTY_DATA_KEYS),
  }
}

const prReliefBreakdown: ReliefBreakdown = {
  earnedIncomeRelief: 0,
  nsmanStatus: 'performedDuty',
  nsmanKAH: true,
  spouseRelief: true,
  nChildren: 2,
  parentReliefType: 'liveWith',
  nParents: 1,
  otherReliefs: 1500,
}

export const LEGACY_PARITY_FIXTURES = {
  salaryOnly: (() => {
    const base = makeBaseSnapshot()
    return {
      profile: {
        ...base.profile,
        currentAge: 32,
        retirementAge: 60,
        lifeExpectancy: 92,
        annualIncome: 98_000,
        annualExpenses: 46_000,
        liquidNetWorth: 125_000,
      },
      income: {
        ...base.income,
        salaryModel: 'simple',
        annualSalary: 98_000,
        salaryGrowthRate: 0.04,
        bonusMonths: 2,
        employerCpfEnabled: true,
        incomeStreams: [],
        lifeEvents: [],
        lifeEventsEnabled: false,
        personalReliefs: 20_000,
        reliefBreakdown: null,
      },
      property: {
        ...base.property,
        ownsProperty: false,
        propertyCount: 0,
      },
    }
  })(),

  propertyAndCpf: (() => {
    const base = makeBaseSnapshot()
    return {
      profile: {
        ...base.profile,
        currentAge: 40,
        retirementAge: 60,
        lifeExpectancy: 95,
        annualIncome: 180_000,
        annualExpenses: 72_000,
        liquidNetWorth: 420_000,
        cpfOA: 160_000,
        cpfSA: 110_000,
        cpfMA: 52_000,
        cpfRA: 0,
        cpfTopUpSA: 8_000,
        cpfTopUpMA: 4_000,
        srsBalance: 90_000,
        srsAnnualContribution: 15_300,
        srsPostFireEnabled: true,
        cashReserveEnabled: true,
        cashReserveMode: 'months',
        cashReserveMonths: 12,
        cashReserveFixedAmount: 60_000,
        cashReserveReturn: 0.025,
        retirementMitigation: {
          type: 'cash_bucket',
          targetMonths: 24,
          cashReturn: 0.02,
        },
        cpfAutoFallback: false,
        cpfAutoFallbackIncludeSA: false,
        cpfVirtualRebalancing: true,
        cpfVirtualRebalancingMode: 'always',
      },
      income: {
        ...base.income,
        annualSalary: 180_000,
        salaryGrowthRate: 0.035,
        bonusMonths: 1.5,
        incomeStreams: [
          {
            id: 'rental-income',
            name: 'Rental income',
            annualAmount: 24_000,
            startAge: 40,
            endAge: 95,
            growthRate: 0.02,
            type: 'rental',
            growthModel: 'inflation-linked',
            taxTreatment: 'taxable',
            isCpfApplicable: false,
            isActive: true,
          },
        ],
      },
      property: {
        ...base.property,
        propertyType: 'hdb',
        residencyForAbsd: 'pr',
        propertyCount: 1,
        ownsProperty: true,
        existingPropertyValue: 1_400_000,
        existingMortgageBalance: 550_000,
        existingMonthlyPayment: 3_200,
        existingMortgageRate: 0.028,
        existingMortgageRemainingYears: 21,
        mortgageCpfMonthly: 1_800,
        ownershipPercent: 0.5,
        existingAppreciationRate: 0.025,
        existingLeaseYears: 82,
        downsizing: {
          scenario: 'sell-and-downsize',
          sellAge: 65,
          expectedSalePrice: 1_550_000,
          newPropertyCost: 920_000,
          newMortgageRate: 0.03,
          newMortgageTerm: 18,
          newLtv: 0.55,
          monthlyRent: 0,
          rentGrowthRate: 0.03,
        },
        hdbFlatType: '5-room',
        hdbMonetizationStrategy: 'sublet',
        hdbLbsRetainedLease: 35,
        hdbSublettingRooms: 2,
        hdbSublettingRate: 1_200,
        hdbCpfUsedForHousing: 75_000,
      },
    }
  })(),

  goalsAndLifeEvents: (() => {
    const base = makeBaseSnapshot()
    return {
      profile: {
        ...base.profile,
        currentAge: 37,
        retirementAge: 58,
        lifeExpectancy: 93,
        annualIncome: 128_000,
        annualExpenses: 64_000,
        liquidNetWorth: 210_000,
        parentSupportEnabled: true,
        parentSupport: [
          {
            id: 'parent-support-mom',
            label: 'Support for mom',
            monthlyAmount: 650,
            startAge: 37,
            endAge: 70,
            growthRate: 0.02,
          },
        ],
        healthcareConfig: {
          ...base.profile.healthcareConfig,
          enabled: true,
          ispTier: 'standard',
          oopBaseAmount: 2_000,
          mediSaveTopUpAnnual: 1_500,
        },
        retirementWithdrawals: [
          {
            id: 'kitchen-reno',
            label: 'Kitchen renovation',
            amount: 25_000,
            age: 61,
            durationYears: 1,
            inflationAdjusted: true,
          },
        ],
        expenseAdjustments: [
          {
            id: 'travel-step-up',
            label: 'Travel step-up',
            amount: 6_000,
            startAge: 45,
            endAge: 55,
          },
          {
            id: 'downsized-commuting',
            label: 'Lower commuting spend',
            amount: -1_800,
            startAge: 58,
            endAge: null,
          },
        ],
        financialGoals: [
          {
            id: 'child-education',
            label: 'Child education',
            amount: 120_000,
            targetAge: 48,
            durationYears: 4,
            priority: 'essential',
            inflationAdjusted: true,
            category: 'education',
          },
          {
            id: 'europe-trip',
            label: 'Europe trip',
            amount: 18_000,
            targetAge: 42,
            durationYears: 1,
            priority: 'nice-to-have',
            inflationAdjusted: false,
            category: 'travel',
          },
        ],
        lockedAssets: [
          {
            id: 'espp',
            name: 'ESPP vesting',
            amount: 45_000,
            unlockAge: 39,
            growthRate: 0.05,
          },
        ],
      },
      income: {
        ...base.income,
        salaryModel: 'realistic',
        annualSalary: 118_000,
        salaryGrowthRate: 0.03,
        promotionJumps: [
          { age: 41, increasePercent: 0.12 },
        ],
        lifeEventsEnabled: true,
        incomeStreams: [
          {
            id: 'side-business',
            name: 'Side business',
            annualAmount: 12_000,
            startAge: 38,
            endAge: 55,
            growthRate: 0.01,
            type: 'business',
            growthModel: 'fixed',
            taxTreatment: 'taxable',
            isCpfApplicable: false,
            isActive: true,
          },
        ],
        lifeEvents: [
          {
            id: 'parental-leave',
            name: 'Parental leave',
            startAge: 38,
            endAge: 39,
            incomeImpact: 0.7,
            affectedStreamIds: [],
            savingsPause: true,
            cpfPause: false,
          },
          {
            id: 'sabbatical',
            name: 'Sabbatical',
            startAge: 50,
            endAge: 51,
            incomeImpact: 0,
            affectedStreamIds: ['side-business'],
            savingsPause: true,
            cpfPause: true,
            additionalAnnualExpense: 4_000,
          },
        ],
      },
      property: {
        ...base.property,
        ownsProperty: false,
        propertyCount: 0,
      },
    }
  })(),

  prResidencyTransition: (() => {
    const base = makeBaseSnapshot()
    const currentAge = 57
    return {
      profile: {
        ...base.profile,
        currentAge,
        retirementAge: 67,
        lifeExpectancy: 92,
        residencyStatus: 'pr',
        prMonths: 11,
        annualIncome: 150_000,
        annualExpenses: 70_000,
        liquidNetWorth: 360_000,
        cpfOA: 80_000,
        cpfSA: 65_000,
        cpfMA: 34_000,
        cpfRA: 18_000,
        healthcareConfig: {
          ...base.profile.healthcareConfig,
          enabled: true,
          oopReferenceAge: currentAge,
        },
      },
      income: {
        ...base.income,
        salaryModel: 'simple',
        annualSalary: 150_000,
        salaryGrowthRate: 0.02,
        momEducation: 'diploma',
        lifeEventsEnabled: true,
        personalReliefs: computeTotalReliefs(prReliefBreakdown, currentAge),
        reliefBreakdown: prReliefBreakdown,
        reliefBasisAge: currentAge,
        lifeEvents: [
          {
            id: 'residency-step-up',
            name: 'PR rate transition',
            startAge: 57,
            endAge: 59,
            incomeImpact: 1,
            affectedStreamIds: [],
            savingsPause: false,
            cpfPause: false,
          },
        ],
      },
      property: {
        ...base.property,
        propertyType: 'condo',
        residencyForAbsd: 'pr',
        propertyCount: 1,
        ownsProperty: true,
        existingPropertyValue: 980_000,
        existingMortgageBalance: 220_000,
        existingMonthlyPayment: 2_100,
        mortgageCpfMonthly: 900,
        ownershipPercent: 1,
      },
    }
  })(),
} satisfies Record<string, LegacyIndividualSnapshot>

export type LegacyParityFixtureName = keyof typeof LEGACY_PARITY_FIXTURES

/**
 * Joint golden scenario fixture: two adults with healthcare, SRS, CPF top-ups,
 * partner timing shifts, life events, and property with downsizing.
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
