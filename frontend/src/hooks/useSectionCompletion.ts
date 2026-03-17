import { useProfileStore, DEFAULT_PERSONAL_FIELDS, DEFAULT_FIRE_SETTINGS_FIELDS, DEFAULT_EXPENSE_FIELDS, DEFAULT_NET_WORTH_FIELDS } from '@/stores/useProfileStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
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

/** Map of which store validation error keys belong to which section */
const PROFILE_PERSONAL_FIELDS = ['currentAge', 'retirementAge', 'lifeExpectancy', 'maritalStatus', 'residencyStatus']
const PROFILE_FIRE_FIELDS = ['swr', 'fireType', 'expectedReturn', 'inflation']
const PROFILE_EXPENSES_FIELDS = ['annualExpenses', 'retirementSpendingAdjustment']
const PROFILE_NW_FIELDS = ['liquidNetWorth', 'annualIncome']
const PROFILE_CPF_FIELDS = ['cpfOA', 'cpfSA']

function countErrors(errors: Record<string, string>, fields: string[]): number {
  return fields.filter((f) => f in errors).length
}

export function useSectionCompletion(): UseSectionCompletionResult {
  const profile = useProfileStore()
  const income = useIncomeStore()
  const allocation = useAllocationStore()
  const property = usePropertyStore()

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

  function getStatus(isCustomized: boolean, errorCount: number): SectionStatus {
    if (errorCount > 0) return 'error'
    if (isCustomized) return 'customized'
    return 'default'
  }

  const personalCustomized =
    profile.currentAge !== DEFAULT_PERSONAL_FIELDS.currentAge ||
    profile.retirementAge !== DEFAULT_PERSONAL_FIELDS.retirementAge ||
    profile.lifeExpectancy !== DEFAULT_PERSONAL_FIELDS.lifeExpectancy ||
    profile.maritalStatus !== DEFAULT_PERSONAL_FIELDS.maritalStatus ||
    profile.residencyStatus !== DEFAULT_PERSONAL_FIELDS.residencyStatus

  const fireCustomized =
    profile.swr !== DEFAULT_FIRE_SETTINGS_FIELDS.swr ||
    profile.fireType !== DEFAULT_FIRE_SETTINGS_FIELDS.fireType ||
    profile.expectedReturn !== DEFAULT_FIRE_SETTINGS_FIELDS.expectedReturn ||
    profile.inflation !== DEFAULT_FIRE_SETTINGS_FIELDS.inflation

  const incomeCustomized =
    income.annualSalary !== 178800 ||
    income.salaryModel !== 'simple' ||
    income.incomeStreams.length > 0

  const expensesCustomized = profile.annualExpenses !== DEFAULT_EXPENSE_FIELDS.annualExpenses
  const nwCustomized = profile.liquidNetWorth !== DEFAULT_NET_WORTH_FIELDS.liquidNetWorth
  const cpfCustomized = profile.cpfOA !== DEFAULT_NET_WORTH_FIELDS.cpfOA || profile.cpfSA !== DEFAULT_NET_WORTH_FIELDS.cpfSA
  const healthcareCustomized = profile.healthcareConfig.enabled
  const propertyCustomized = property.ownsProperty !== false
  const allocationCustomized = allocation.selectedTemplate !== 'balanced'
  const goalsCustomized = profile.financialGoals.length > 0
  const goalsErrorCount = Object.keys(profileErrors).filter((k) => k.startsWith('goal_')).length

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

  const completedCount = Object.values(sections).filter((s) => s.isComplete).length
  const totalSections = Object.keys(sections).length
  const hasAnyErrors = Object.values(sections).some((s) => s.errorCount > 0)

  return { sections, completedCount, totalSections, hasAnyErrors }
}
