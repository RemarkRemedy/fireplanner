import { computeTotalReliefs, type ReliefBreakdown } from '@/lib/data/taxBrackets'
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
