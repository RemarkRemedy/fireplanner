import { useMemo } from 'react'
import type { AdultOwner, HouseholdPlan } from '@/lib/household/types'
import type {
  HouseholdValidationEntityKind,
  HouseholdValidationErrors,
} from '@/lib/household/validation'
import type { ProfileState } from '@/lib/types'
import { validateProfileField } from '@/lib/validation/schemas'
import { validateProfileConsistency } from '@/lib/validation/rules'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'

export type { SectionId } from '@/lib/household/sectionOrder'
import type { SectionId } from '@/lib/household/sectionOrder'

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

const HOUSEHOLD_CPF_VALIDATION_FIELDS = [
  'cpfOA',
  'cpfSA',
  'cpfMA',
  'cpfRA',
  'cpfTopUpOA',
  'cpfTopUpSA',
  'cpfTopUpMA',
  'cpfLifeActualMonthlyPayout',
  'cpfLifeStartAge',
  'cpfisOaReturn',
  'cpfisSaReturn',
] as const

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

/** W24: Count healthcare-related errors from adult validation entries. */
function countHouseholdHealthcareErrors(
  errors: HouseholdValidationErrors,
): number {
  return Object.entries(errors).reduce((count, [key, fieldErrors]) => {
    const [kind] = key.split(':', 1)
    if (kind !== 'adult') return count

    return count + Object.keys(fieldErrors).filter((field) => field.startsWith('healthcare.')).length
  }, 0)
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

function getAdultAnnualIncome(plan: HouseholdPlan, owner: AdultOwner, fallbackIncome: number): number {
  const salaryModel = plan.income.find((entry) => (
    entry.kind === 'salary-model'
    && entry.owner === owner
    && entry.timing.owner === owner
    && entry.isActive
  ))

  return salaryModel?.annualAmount ?? fallbackIncome
}

// TODO(W42): This function duplicates CPF field validation logic from
// the household adapter. Consider extracting shared CPF validation into
// a single utility and calling it from both useSectionCompletion and
// the household CPF adapter to avoid divergence.
function countHouseholdCpfErrors(plan: HouseholdPlan): number {
  return plan.adults.reduce((total, adult) => {
    const annualIncome = getAdultAnnualIncome(plan, adult.owner, adult.annualIncome)
    const snapshot = {
      currentAge: adult.currentAge,
      retirementAge: adult.retirementAge,
      lifeExpectancy: adult.lifeExpectancy,
      lifeStage: adult.lifeStage,
      annualIncome,
      cpfOA: adult.cpf.balances.oa,
      cpfSA: adult.cpf.balances.sa,
      cpfMA: adult.cpf.balances.ma,
      cpfRA: adult.cpf.balances.ra,
      cpfTopUpOA: adult.cpf.annualTopUps.oa,
      cpfTopUpSA: adult.cpf.annualTopUps.sa,
      cpfTopUpMA: adult.cpf.annualTopUps.ma,
      cpfLifeActualMonthlyPayout: adult.cpf.lifeActualMonthlyPayout,
      cpfLifeStartAge: adult.cpf.lifeStartAge,
      cpfLifePlan: adult.cpf.lifePlan,
      cpfRetirementSum: adult.cpf.retirementSum,
      cpfisEnabled: adult.cpf.cpfisEnabled,
      cpfisOaReturn: adult.cpf.cpfisOaReturn,
      cpfisSaReturn: adult.cpf.cpfisSaReturn,
      cpfAutoFallback: adult.cpf.autoFallback,
      cpfAutoFallbackIncludeSA: adult.cpf.autoFallbackIncludeSA,
      cpfVirtualRebalancing: adult.cpf.virtualRebalancing,
      cpfVirtualRebalancingMode: adult.cpf.virtualRebalancingMode,
      retirementPhase: adult.cpf.retirementPhase,
      parentSupportEnabled: adult.parentSupportEnabled,
      parentSupport: [],
      healthcareConfig: adult.healthcare,
      retirementWithdrawals: [],
      financialGoals: [],
      cpfOaWithdrawals: adult.cpf.oaWithdrawals,
      expenseAdjustments: [],
      lockedAssets: [],
    } satisfies Pick<
      ProfileState,
      | 'currentAge'
      | 'retirementAge'
      | 'lifeExpectancy'
      | 'lifeStage'
      | 'annualIncome'
      | 'cpfOA'
      | 'cpfSA'
      | 'cpfMA'
      | 'cpfRA'
      | 'cpfTopUpOA'
      | 'cpfTopUpSA'
      | 'cpfTopUpMA'
      | 'cpfLifeActualMonthlyPayout'
      | 'cpfLifeStartAge'
      | 'cpfLifePlan'
      | 'cpfRetirementSum'
      | 'cpfisEnabled'
      | 'cpfisOaReturn'
      | 'cpfisSaReturn'
      | 'cpfAutoFallback'
      | 'cpfAutoFallbackIncludeSA'
      | 'cpfVirtualRebalancing'
      | 'cpfVirtualRebalancingMode'
      | 'retirementPhase'
      | 'parentSupportEnabled'
      | 'parentSupport'
      | 'healthcareConfig'
      | 'retirementWithdrawals'
      | 'financialGoals'
      | 'cpfOaWithdrawals'
      | 'expenseAdjustments'
      | 'lockedAssets'
    >

    const fieldErrorCount = HOUSEHOLD_CPF_VALIDATION_FIELDS.reduce((count, field) => {
      return count + (validateProfileField(field, snapshot[field]) ? 1 : 0)
    }, 0)

    return total + fieldErrorCount + Object.keys(validateProfileConsistency(snapshot)).length
  }, 0)
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
  const cpfErrors = countHouseholdCpfErrors(plan)
  const healthcareErrors = countHouseholdHealthcareErrors(householdErrors)

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
      status: getStatus(cpfCustomized, cpfErrors),
      errorCount: cpfErrors,
    },
    'section-healthcare': {
      isComplete: healthcareCustomized,
      status: getStatus(healthcareCustomized, healthcareErrors),
      errorCount: healthcareErrors,
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
  const householdPlan = useHouseholdPlanStore((state) => state.plan)
  const householdErrors = useHouseholdPlanStore((state) => state.validationErrors)
  const allocationRevision = useAllocationStore((state) => state.allocationRevision)

  return useMemo(() => {
    return buildHouseholdSectionCompletion(
      householdPlan,
      householdErrors,
      useAllocationStore.getState(),
    )
  }, [
    householdPlan,
    householdErrors,
    allocationRevision,
  ])
}
