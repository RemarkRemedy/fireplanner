import type { IncomeState, ProfileState, PropertyState } from '@/lib/types'
import { computeTotalReliefs } from '@/lib/data/taxBrackets'
import {
  INCOME_DATA_KEYS,
  useIncomeStore,
} from '@/stores/useIncomeStore'
import {
  PROFILE_DATA_KEYS,
  useProfileStore,
} from '@/stores/useProfileStore'
import {
  PROPERTY_DATA_KEYS,
  usePropertyStore,
} from '@/stores/usePropertyStore'
import type {
  AdultOwner,
  AssetItem,
  ExpenseItem,
  GoalItem,
  HouseholdPlan,
  IncomeSource,
  PlanningAdult,
  PropertyPlan,
  TimingRule,
} from './types'

export type LegacyProfileSnapshot = Pick<ProfileState, (typeof PROFILE_DATA_KEYS)[number]>
export type LegacyIncomeSnapshot = Pick<IncomeState, (typeof INCOME_DATA_KEYS)[number]>
export type LegacyPropertySnapshot = Pick<PropertyState, (typeof PROPERTY_DATA_KEYS)[number]>

export interface LegacyIndividualSnapshot {
  profile: LegacyProfileSnapshot
  income: LegacyIncomeSnapshot
  property: LegacyPropertySnapshot
}

const PRIMARY_OWNER: AdultOwner = 'self'
const PRIMARY_ADULT_ID = 'adult-self'

function cloneTiming(timing: TimingRule): TimingRule {
  if (timing.kind === 'single-age') {
    return { ...timing }
  }

  return { ...timing }
}

function ageRange(startAge: number, endAge: number | null): TimingRule {
  return {
    kind: 'age-range',
    owner: PRIMARY_OWNER,
    startAge,
    endAge,
  }
}

function pickSnapshot<TState extends object, TKey extends keyof TState>(
  state: TState,
  keys: readonly TKey[]
): Pick<TState, TKey> {
  const snapshot = {} as Pick<TState, TKey>
  for (const key of keys) {
    snapshot[key] = state[key]
  }
  return snapshot
}

export function snapshotLegacyIndividual(): LegacyIndividualSnapshot {
  return {
    profile: pickSnapshot(useProfileStore.getState(), PROFILE_DATA_KEYS),
    income: pickSnapshot(useIncomeStore.getState(), INCOME_DATA_KEYS),
    property: pickSnapshot(usePropertyStore.getState(), PROPERTY_DATA_KEYS),
  }
}

function resolveReliefBasisAge(currentAge: number, income: LegacyIncomeSnapshot): number {
  if (typeof income.reliefBasisAge === 'number') {
    return income.reliefBasisAge
  }

  if (income.reliefBreakdown === null) {
    return currentAge
  }

  if (computeTotalReliefs(income.reliefBreakdown, currentAge) === income.personalReliefs) {
    return currentAge
  }

  let bestAge = currentAge
  let bestDistance = Number.MAX_SAFE_INTEGER

  for (let age = 0; age <= 120; age += 1) {
    if (computeTotalReliefs(income.reliefBreakdown, age) !== income.personalReliefs) {
      continue
    }

    const distance = Math.abs(age - currentAge)
    if (distance < bestDistance) {
      bestAge = age
      bestDistance = distance
    }
  }

  return bestDistance === Number.MAX_SAFE_INTEGER ? currentAge : bestAge
}

function mapPlanningAdult(snapshot: LegacyIndividualSnapshot): PlanningAdult {
  const { profile, income } = snapshot

  return {
    id: PRIMARY_ADULT_ID,
    owner: PRIMARY_OWNER,
    displayName: 'Primary adult',
    currentAge: profile.currentAge,
    retirementAge: profile.retirementAge,
    lifeExpectancy: profile.lifeExpectancy,
    lifeStage: profile.lifeStage,
    maritalStatus: profile.maritalStatus,
    residencyStatus: profile.residencyStatus,
    prMonths: profile.prMonths,
    annualIncome: profile.annualIncome,
    annualExpenses: profile.annualExpenses,
    liquidNetWorth: profile.liquidNetWorth,
    parentSupportEnabled: profile.parentSupportEnabled,
    lifeEventsEnabled: income.lifeEventsEnabled,
    healthcare: { ...profile.healthcareConfig },
    cpf: {
      balances: {
        oa: profile.cpfOA,
        sa: profile.cpfSA,
        ma: profile.cpfMA,
        ra: profile.cpfRA,
      },
      annualTopUps: {
        oa: profile.cpfTopUpOA,
        sa: profile.cpfTopUpSA,
        ma: profile.cpfTopUpMA,
      },
      retirementPhase: profile.retirementPhase,
      lifeActualMonthlyPayout: profile.cpfLifeActualMonthlyPayout,
      lifeStartAge: profile.cpfLifeStartAge,
      lifePlan: profile.cpfLifePlan,
      retirementSum: profile.cpfRetirementSum,
      oaWithdrawals: profile.cpfOaWithdrawals.map((entry) => ({ ...entry })),
      cpfisEnabled: profile.cpfisEnabled,
      cpfisOaReturn: profile.cpfisOaReturn,
      cpfisSaReturn: profile.cpfisSaReturn,
      autoFallback: profile.cpfAutoFallback,
      autoFallbackIncludeSA: profile.cpfAutoFallbackIncludeSA,
      virtualRebalancing: profile.cpfVirtualRebalancing,
      virtualRebalancingMode: profile.cpfVirtualRebalancingMode,
    },
    srs: {
      balance: profile.srsBalance,
      annualContribution: profile.srsAnnualContribution,
      investmentReturn: profile.srsInvestmentReturn,
      drawdownStartAge: profile.srsDrawdownStartAge,
      postFireEnabled: profile.srsPostFireEnabled,
    },
    taxProfile: {
      momEducation: income.momEducation,
      momAdjustment: income.momAdjustment,
      personalReliefs: income.personalReliefs,
      reliefBreakdown: income.reliefBreakdown ? { ...income.reliefBreakdown } : null,
      reliefBasisAge: resolveReliefBasisAge(profile.currentAge, income),
    },
    lifeEvents: income.lifeEvents.map((event) => ({ ...event })),
  }
}

function mapSalaryIncome(snapshot: LegacyIndividualSnapshot): IncomeSource {
  const { profile, income } = snapshot

  return {
    id: 'income-salary-self',
    owner: PRIMARY_OWNER,
    label: 'Primary salary',
    kind: 'salary-model',
    timing: ageRange(profile.currentAge, profile.retirementAge),
    annualAmount: income.annualSalary,
    growthRate: income.salaryGrowthRate,
    growthModel: 'fixed',
    taxTreatment: 'taxable',
    isCpfApplicable: true,
    isActive: true,
    streamType: 'employment',
    salaryModel: income.salaryModel,
    bonusMonths: income.bonusMonths,
    employerCpfEnabled: income.employerCpfEnabled,
    realisticPhases: income.realisticPhases.map((phase) => ({ ...phase })),
    promotionJumps: income.promotionJumps.map((jump) => ({ ...jump })),
    legacySourceId: 'income.annualSalary',
  }
}

function mapIncomeStreams(snapshot: LegacyIndividualSnapshot): IncomeSource[] {
  return snapshot.income.incomeStreams.map((stream) => ({
    id: `income-stream-${stream.id}`,
    owner: PRIMARY_OWNER,
    label: stream.name,
    kind: 'income-stream',
    timing: ageRange(stream.startAge, stream.endAge),
    annualAmount: stream.annualAmount,
    growthRate: stream.growthRate,
    growthModel: stream.growthModel,
    taxTreatment: stream.taxTreatment,
    isCpfApplicable: stream.isCpfApplicable,
    isActive: stream.isActive,
    streamType: stream.type,
    legacySourceId: `income.incomeStreams.${stream.id}`,
  }))
}

function mapExpenseItems(snapshot: LegacyIndividualSnapshot): ExpenseItem[] {
  const { profile } = snapshot

  const baseExpense: ExpenseItem = {
    id: 'expense-base-living-self',
    owner: PRIMARY_OWNER,
    label: 'Base living expenses',
    kind: 'base-living',
    timing: ageRange(profile.currentAge, profile.lifeExpectancy),
    amount: profile.annualExpenses,
    periodicity: 'annual',
    retirementSpendingAdjustment: profile.retirementSpendingAdjustment,
    legacySourceId: 'profile.annualExpenses',
  }

  const parentSupport = profile.parentSupport.map<ExpenseItem>((entry) => ({
    id: `expense-parent-support-${entry.id}`,
    owner: PRIMARY_OWNER,
    label: entry.label,
    kind: 'parent-support',
    timing: ageRange(entry.startAge, entry.endAge),
    amount: entry.monthlyAmount,
    periodicity: 'monthly',
    growthRate: entry.growthRate,
    legacySourceId: `profile.parentSupport.${entry.id}`,
  }))

  const adjustments = profile.expenseAdjustments.map<ExpenseItem>((entry) => ({
    id: `expense-adjustment-${entry.id}`,
    owner: PRIMARY_OWNER,
    label: entry.label,
    kind: 'expense-adjustment',
    timing: ageRange(entry.startAge, entry.endAge),
    amount: entry.amount,
    periodicity: 'annual',
    legacySourceId: `profile.expenseAdjustments.${entry.id}`,
  }))

  const withdrawals = profile.retirementWithdrawals.map<ExpenseItem>((entry) => ({
    id: `expense-retirement-withdrawal-${entry.id}`,
    owner: PRIMARY_OWNER,
    label: entry.label,
    kind: 'retirement-withdrawal',
    timing: ageRange(entry.age, entry.age + Math.max(entry.durationYears - 1, 0)),
    amount: entry.amount,
    periodicity: entry.durationYears > 1 ? 'annual' : 'one-off',
    durationYears: entry.durationYears,
    inflationAdjusted: entry.inflationAdjusted,
    legacySourceId: `profile.retirementWithdrawals.${entry.id}`,
  }))

  return [
    baseExpense,
    ...parentSupport,
    ...adjustments,
    ...withdrawals,
  ]
}

function mapAssetItems(snapshot: LegacyIndividualSnapshot): AssetItem[] {
  const { profile } = snapshot

  const liquidPortfolio: AssetItem = {
    id: 'asset-liquid-net-worth-self',
    owner: PRIMARY_OWNER,
    label: 'Liquid net worth',
    kind: 'liquid-net-worth',
    amount: profile.liquidNetWorth,
    legacySourceId: 'profile.liquidNetWorth',
  }

  const lockedAssets = profile.lockedAssets.map<AssetItem>((entry) => ({
    id: `asset-locked-${entry.id}`,
    owner: PRIMARY_OWNER,
    label: entry.name,
    kind: 'locked-asset',
    amount: entry.amount,
    unlockAge: entry.unlockAge,
    growthRate: entry.growthRate,
    legacySourceId: `profile.lockedAssets.${entry.id}`,
  }))

  return [liquidPortfolio, ...lockedAssets]
}

function mapGoalItems(snapshot: LegacyIndividualSnapshot): GoalItem[] {
  return snapshot.profile.financialGoals.map((goal) => ({
    id: `goal-${goal.id}`,
    owner: PRIMARY_OWNER,
    label: goal.label,
    kind: 'financial-goal',
    timing: ageRange(goal.targetAge, goal.targetAge + Math.max(goal.durationYears - 1, 0)),
    amount: goal.amount,
    durationYears: goal.durationYears,
    priority: goal.priority,
    inflationAdjusted: goal.inflationAdjusted,
    category: goal.category,
    legacySourceId: `profile.financialGoals.${goal.id}`,
  }))
}

function mapPropertyPlan(snapshot: LegacyIndividualSnapshot): PropertyPlan[] {
  const property = snapshot.property

  return [{
    id: 'property-primary',
    owner: PRIMARY_OWNER,
    label: property.ownsProperty ? 'Primary property' : 'Property analysis',
    propertyType: property.propertyType,
    purchasePrice: property.purchasePrice,
    leaseYears: property.leaseYears,
    appreciationRate: property.appreciationRate,
    rentalYield: property.rentalYield,
    mortgageRate: property.mortgageRate,
    mortgageTerm: property.mortgageTerm,
    ltv: property.ltv,
    residencyForAbsd: property.residencyForAbsd,
    propertyCount: property.propertyCount,
    ownsProperty: property.ownsProperty,
    existingPropertyValue: property.existingPropertyValue,
    existingMortgageBalance: property.existingMortgageBalance,
    existingMonthlyPayment: property.existingMonthlyPayment,
    existingMortgageRate: property.existingMortgageRate,
    existingMortgageRemainingYears: property.existingMortgageRemainingYears,
    mortgageCpfMonthly: property.mortgageCpfMonthly,
    ownershipPercent: property.ownershipPercent,
    existingAppreciationRate: property.existingAppreciationRate,
    existingLeaseYears: property.existingLeaseYears,
    existingApplyBalaDecay: property.existingApplyBalaDecay,
    downsizing: { ...property.downsizing },
    hdbFlatType: property.hdbFlatType,
    hdbMonetizationStrategy: property.hdbMonetizationStrategy,
    hdbLbsRetainedLease: property.hdbLbsRetainedLease,
    hdbSublettingRooms: property.hdbSublettingRooms,
    hdbSublettingRate: property.hdbSublettingRate,
    hdbCpfUsedForHousing: property.hdbCpfUsedForHousing,
  }]
}

export function fromLegacyIndividual(
  snapshot: LegacyIndividualSnapshot = snapshotLegacyIndividual()
): HouseholdPlan {
  const adult = mapPlanningAdult(snapshot)

  return {
    schemaVersion: 1,
    id: 'legacy-individual-household',
    planType: 'individual',
    adults: [adult],
    dependents: [],
    income: [
      mapSalaryIncome(snapshot),
      ...mapIncomeStreams(snapshot),
    ],
    expenses: mapExpenseItems(snapshot).map((item) => ({
      ...item,
      timing: cloneTiming(item.timing),
    })),
    assets: mapAssetItems(snapshot),
    goals: mapGoalItems(snapshot).map((goal) => ({
      ...goal,
      timing: cloneTiming(goal.timing),
    })),
    properties: mapPropertyPlan(snapshot),
    assumptions: {
      fire: {
        fireType: snapshot.profile.fireType,
        swr: snapshot.profile.swr,
        fireNumberBasis: snapshot.profile.fireNumberBasis,
      },
      returns: {
        expectedReturn: snapshot.profile.expectedReturn,
        usePortfolioReturn: snapshot.profile.usePortfolioReturn,
        inflation: snapshot.profile.inflation,
        expenseRatio: snapshot.profile.expenseRatio,
        rebalanceFrequency: snapshot.profile.rebalanceFrequency,
      },
      cashReserve: {
        enabled: snapshot.profile.cashReserveEnabled,
        mode: snapshot.profile.cashReserveMode,
        fixedAmount: snapshot.profile.cashReserveFixedAmount,
        months: snapshot.profile.cashReserveMonths,
        returnRate: snapshot.profile.cashReserveReturn,
      },
      retirementMitigation: { ...snapshot.profile.retirementMitigation },
    },
    parityMeta: {
      source: 'legacy-individual-store-adapter',
      persistedKeyCounts: {
        profile: PROFILE_DATA_KEYS.length,
        income: INCOME_DATA_KEYS.length,
        property: PROPERTY_DATA_KEYS.length,
      },
      mutationCouplings: [
        {
          id: 'income-relief-breakdown-current-age',
          trigger: 'income.setReliefBreakdown()',
          reads: ['profile.currentAge'],
          preservedBy: 'adult.taxProfile.reliefBasisAge',
        },
        {
          id: 'profile-current-age-healthcare-oop-reference-age',
          trigger: 'profile.setField("currentAge") when oopReferenceAge matches the old age',
          reads: ['profile.currentAge', 'profile.healthcareConfig.oopReferenceAge'],
          preservedBy: 'adult.healthcare.oopReferenceAge',
        },
      ],
    },
  }
}
