import { isHouseholdPlannerV1Enabled } from '@/lib/household/featureFlag'
import type { AdultOwner, HouseholdPlan } from '@/lib/household/types'
import type {
  HouseholdValidationEntityKind,
  HouseholdValidationErrors,
} from '@/lib/household/validation'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { usePropertyStore } from '@/stores/usePropertyStore'

export type SectionId =
  | 'section-personal'
  | 'section-fire-settings'
  | 'section-income'
  | 'section-expenses'
  | 'section-goals'
  | 'section-net-worth'
  | 'section-cpf'
  | 'section-healthcare'
  | 'section-property'
  | 'section-allocation'

export type SectionStatus = 'default' | 'customized' | 'error'

interface SectionCompletion {
  isComplete: boolean
  status: SectionStatus
  errorCount: number
}

interface UseSectionCompletionResult {
  sections: Record<SectionId, SectionCompletion>
  completedCount: number
  totalSections: number
  hasAnyErrors: boolean
}

const PROFILE_PERSONAL_FIELDS = ['currentAge', 'retirementAge', 'lifeExpectancy', 'maritalStatus', 'residencyStatus']
const PROFILE_FIRE_FIELDS = ['swr', 'fireType', 'expectedReturn', 'inflation']
const PROFILE_EXPENSES_FIELDS = ['annualExpenses', 'retirementSpendingAdjustment']
const PROFILE_NW_FIELDS = ['liquidNetWorth', 'annualIncome']
const PROFILE_CPF_FIELDS = ['cpfOA', 'cpfSA']

function countErrors(errors: Record<string, string>, fields: string[]): number {
  return fields.filter((field) => field in errors).length
}

function getStatus(isCustomized: boolean, errorCount: number): SectionStatus {
  if (errorCount > 0) return 'error'
  if (isCustomized) return 'customized'
  return 'default'
}

function countHouseholdErrors(
  errors: HouseholdValidationErrors,
  kinds: HouseholdValidationEntityKind[],
): number {
  return Object.entries(errors).reduce((count, [key, fieldErrors]) => {
    const [kind] = key.split(':', 1)
    if (!kind || !kinds.includes(kind as HouseholdValidationEntityKind)) {
      return count
    }

    return count + Object.keys(fieldErrors).length
  }, 0)
}

function buildLegacySectionCompletion(
  profile: ReturnType<typeof useProfileStore.getState>,
  income: ReturnType<typeof useIncomeStore.getState>,
  allocation: ReturnType<typeof useAllocationStore.getState>,
  property: ReturnType<typeof usePropertyStore.getState>,
): UseSectionCompletionResult {
  const profileErrors = profile.validationErrors
  const incomeErrors = income.validationErrors
  const allocationErrors = allocation.validationErrors
  const propertyErrors = property.validationErrors

  const personalErrors = countErrors(profileErrors, PROFILE_PERSONAL_FIELDS)
  const fireErrors = countErrors(profileErrors, PROFILE_FIRE_FIELDS)
  const incomeErrorCount = Object.keys(incomeErrors).length
  const expensesErrors = countErrors(profileErrors, PROFILE_EXPENSES_FIELDS)
  const nwErrors = countErrors(profileErrors, PROFILE_NW_FIELDS)
  const cpfErrors = countErrors(profileErrors, PROFILE_CPF_FIELDS)
  const propertyErrorCount = Object.keys(propertyErrors).length
  const allocationErrorCount = Object.keys(allocationErrors).length

  const personalCustomized =
    profile.currentAge !== 30 ||
    profile.retirementAge !== 65 ||
    profile.lifeExpectancy !== 90 ||
    profile.maritalStatus !== 'single' ||
    profile.residencyStatus !== 'citizen'

  const fireCustomized =
    profile.swr !== 0.036 ||
    profile.fireType !== 'regular' ||
    profile.expectedReturn !== 0.07 ||
    profile.inflation !== 0.025

  const incomeCustomized =
    income.annualSalary !== 72000 ||
    income.salaryModel !== 'simple' ||
    income.incomeStreams.length > 0

  const expensesCustomized = profile.annualExpenses !== 48000
  const nwCustomized = profile.liquidNetWorth !== 0
  const cpfCustomized = profile.cpfOA !== 0 || profile.cpfSA !== 0
  const healthcareCustomized = profile.healthcareConfig.enabled
  const propertyCustomized = property.ownsProperty !== false
  const allocationCustomized = allocation.selectedTemplate !== 'balanced'
  const goalsCustomized = profile.financialGoals.length > 0
  const goalsErrorCount = Object.keys(profileErrors).filter((key) => key.startsWith('goal_')).length

  const sections: Record<SectionId, SectionCompletion> = {
    'section-personal': {
      isComplete: personalCustomized,
      status: getStatus(personalCustomized, personalErrors),
      errorCount: personalErrors,
    },
    'section-fire-settings': {
      isComplete: fireCustomized,
      status: getStatus(fireCustomized, fireErrors),
      errorCount: fireErrors,
    },
    'section-income': {
      isComplete: incomeCustomized,
      status: getStatus(incomeCustomized, incomeErrorCount),
      errorCount: incomeErrorCount,
    },
    'section-expenses': {
      isComplete: expensesCustomized,
      status: getStatus(expensesCustomized, expensesErrors),
      errorCount: expensesErrors,
    },
    'section-goals': {
      isComplete: goalsCustomized,
      status: getStatus(goalsCustomized, goalsErrorCount),
      errorCount: goalsErrorCount,
    },
    'section-net-worth': {
      isComplete: nwCustomized,
      status: getStatus(nwCustomized, nwErrors),
      errorCount: nwErrors,
    },
    'section-cpf': {
      isComplete: cpfCustomized,
      status: getStatus(cpfCustomized, cpfErrors),
      errorCount: cpfErrors,
    },
    'section-healthcare': {
      isComplete: healthcareCustomized,
      status: getStatus(healthcareCustomized, 0),
      errorCount: 0,
    },
    'section-property': {
      isComplete: propertyCustomized,
      status: getStatus(propertyCustomized, propertyErrorCount),
      errorCount: propertyErrorCount,
    },
    'section-allocation': {
      isComplete: allocationCustomized,
      status: getStatus(allocationCustomized, allocationErrorCount),
      errorCount: allocationErrorCount,
    },
  }

  const completedCount = Object.values(sections).filter((section) => section.isComplete).length
  const totalSections = Object.keys(sections).length
  const hasAnyErrors = Object.values(sections).some((section) => section.errorCount > 0)

  return { sections, completedCount, totalSections, hasAnyErrors }
}

function hasIncomeCoverage(plan: HouseholdPlan, owner: AdultOwner): boolean {
  return plan.income.some((entry) => (
    entry.isActive
    && entry.timing.owner === owner
    && (entry.owner === owner || entry.owner === 'shared')
  ))
}

function hasExpenseCoverage(plan: HouseholdPlan, owner: AdultOwner): boolean {
  return plan.expenses.some((entry) => (
    entry.amount > 0
    && entry.timing.owner === owner
    && (entry.owner === owner || entry.owner === 'shared')
  ))
}

function hasPropertyData(plan: HouseholdPlan): boolean {
  return plan.properties.some((property) => (
    property.ownsProperty
    || property.purchasePrice > 0
    || property.existingPropertyValue > 0
    || property.existingMortgageBalance > 0
    || property.existingMonthlyPayment > 0
  ))
}

function buildHouseholdSectionCompletion(
  plan: HouseholdPlan,
  householdErrors: HouseholdValidationErrors,
  allocation: ReturnType<typeof useAllocationStore.getState>,
): UseSectionCompletionResult {
  const adultOwners = plan.adults.map((adult) => adult.owner)
  const sharedExpenseCoverage = plan.expenses.some((entry) => entry.owner === 'shared' && entry.amount > 0)

  const personalCustomized =
    plan.adults.length > 1 ||
    plan.dependents.length > 0 ||
    plan.adults.some((adult) => (
      adult.displayName !== (adult.owner === 'self' ? 'You' : 'Partner')
      || adult.currentAge !== 30
      || adult.retirementAge !== 65
      || adult.lifeExpectancy !== 90
    ))

  const fireCustomized =
    plan.assumptions.fire.swr !== 0.036 ||
    plan.assumptions.fire.fireType !== 'regular' ||
    plan.assumptions.fire.fireNumberBasis !== 'fireAge' ||
    plan.assumptions.returns.expectedReturn !== 0.07 ||
    plan.assumptions.returns.usePortfolioReturn !== true ||
    plan.assumptions.returns.inflation !== 0.025 ||
    plan.assumptions.returns.expenseRatio !== 0.003 ||
    plan.assumptions.returns.rebalanceFrequency !== 'annual'

  const incomeCustomized =
    adultOwners.length > 0 &&
    adultOwners.every((owner) => hasIncomeCoverage(plan, owner))

  const expensesCustomized =
    plan.goals.length > 0 ||
    plan.dependents.length > 0 ||
    sharedExpenseCoverage ||
    (adultOwners.length > 0 && adultOwners.every((owner) => hasExpenseCoverage(plan, owner)))

  const goalsCustomized = plan.goals.length > 0

  const netWorthCustomized =
    plan.adults.some((adult) => adult.liquidNetWorth > 0 || adult.srs.balance > 0) ||
    plan.assets.some((asset) => asset.amount > 0) ||
    hasPropertyData(plan)

  const cpfCustomized = plan.adults.some((adult) => (
    adult.cpf.balances.oa > 0 ||
    adult.cpf.balances.sa > 0 ||
    adult.cpf.balances.ma > 0 ||
    adult.cpf.balances.ra > 0 ||
    adult.cpf.annualTopUps.oa > 0 ||
    adult.cpf.annualTopUps.sa > 0 ||
    adult.cpf.annualTopUps.ma > 0 ||
    adult.cpf.lifeActualMonthlyPayout > 0 ||
    adult.cpf.lifeStartAge !== 65 ||
    adult.cpf.lifePlan !== 'standard' ||
    adult.cpf.retirementSum !== 'frs' ||
    adult.cpf.oaWithdrawals.length > 0 ||
    adult.cpf.cpfisEnabled ||
    adult.cpf.cpfisOaReturn !== 0.04 ||
    adult.cpf.cpfisSaReturn !== 0.05 ||
    adult.cpf.autoFallback !== true ||
    adult.cpf.virtualRebalancing !== true ||
    adult.cpf.virtualRebalancingMode !== 'from55'
  ))

  const healthcareCustomized = plan.adults.some((adult) => (
    adult.healthcare.enabled ||
    adult.healthcare.ispTier !== 'none' ||
    adult.healthcare.mediSaveTopUpAnnual > 0
  ))

  const propertyCustomized = hasPropertyData(plan)
  const allocationErrorCount = Object.keys(allocation.validationErrors).length
  const allocationCustomized =
    allocation.selectedTemplate !== 'balanced' ||
    allocation.glidePathConfig.enabled

  const personalErrors = countHouseholdErrors(householdErrors, ['adult', 'dependent'])
  const fireErrors = countHouseholdErrors(householdErrors, ['assumptions'])
  const incomeErrors = countHouseholdErrors(householdErrors, ['income'])
  const expensesErrors = countHouseholdErrors(householdErrors, ['expense'])
  const goalsErrors = countHouseholdErrors(householdErrors, ['goal'])
  const netWorthErrors = countHouseholdErrors(householdErrors, ['asset'])
  const propertyErrors = countHouseholdErrors(householdErrors, ['property'])

  const sections: Record<SectionId, SectionCompletion> = {
    'section-personal': {
      isComplete: personalCustomized,
      status: getStatus(personalCustomized, personalErrors),
      errorCount: personalErrors,
    },
    'section-fire-settings': {
      isComplete: fireCustomized,
      status: getStatus(fireCustomized, fireErrors),
      errorCount: fireErrors,
    },
    'section-income': {
      isComplete: incomeCustomized,
      status: getStatus(incomeCustomized, incomeErrors),
      errorCount: incomeErrors,
    },
    'section-expenses': {
      isComplete: expensesCustomized,
      status: getStatus(expensesCustomized, expensesErrors),
      errorCount: expensesErrors,
    },
    'section-goals': {
      isComplete: goalsCustomized,
      status: getStatus(goalsCustomized, goalsErrors),
      errorCount: goalsErrors,
    },
    'section-net-worth': {
      isComplete: netWorthCustomized,
      status: getStatus(netWorthCustomized, netWorthErrors),
      errorCount: netWorthErrors,
    },
    'section-cpf': {
      isComplete: cpfCustomized,
      status: getStatus(cpfCustomized, 0),
      errorCount: 0,
    },
    'section-healthcare': {
      isComplete: healthcareCustomized,
      status: getStatus(healthcareCustomized, 0),
      errorCount: 0,
    },
    'section-property': {
      isComplete: propertyCustomized,
      status: getStatus(propertyCustomized, propertyErrors),
      errorCount: propertyErrors,
    },
    'section-allocation': {
      isComplete: allocationCustomized,
      status: getStatus(allocationCustomized, allocationErrorCount),
      errorCount: allocationErrorCount,
    },
  }

  const completedCount = Object.values(sections).filter((section) => section.isComplete).length
  const totalSections = Object.keys(sections).length
  const hasAnyErrors = Object.values(sections).some((section) => section.errorCount > 0)

  return { sections, completedCount, totalSections, hasAnyErrors }
}

export function useSectionCompletion(): UseSectionCompletionResult {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const allocation = useAllocationStore()
  const property = usePropertyStore()
  const householdPlan = useHouseholdPlanStore((state) => state.plan)
  const householdErrors = useHouseholdPlanStore((state) => state.validationErrors)

  const householdEnabled = isHouseholdPlannerV1Enabled() && householdPlan.planType !== 'individual'

  if (householdEnabled) {
    return buildHouseholdSectionCompletion(householdPlan, householdErrors, allocation)
  }

  return buildLegacySectionCompletion(profile, income, allocation, property)
}
