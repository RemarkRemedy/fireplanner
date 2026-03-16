/**
 * Reads current store state and returns seed values for a given nudge flow.
 * This pre-populates flow fields so users see their existing data instead of blanks.
 *
 * Field names match the nudge flow field definitions in nudgeFlows.ts.
 * The reverse mapping is done in applyFlowValues.ts.
 */

import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'
import type { NudgeFlowScreen } from '@/lib/data/nudgeFlows'
import type { PlanningAdult } from '@/lib/household/types'
import {
  DEFAULT_CPF_PAYOUT_START_AGE,
  DEFAULT_CPF_LIFE_PLAN,
  DEFAULT_EMERGENCY_FUND_MONTHS,
  DEFAULT_REBALANCING_FREQUENCY,
  DEFAULT_ISP_TIER,
  DEFAULT_CARESHIELD_ENROLLED,
} from '@/lib/data/setupDefaults'

function getSelfAdult(): PlanningAdult | undefined {
  return useHouseholdPlanStore.getState().plan.adults.find((a) => a.owner === 'self')
}

function seedCpf(adult: PlanningAdult): Record<string, unknown> {
  const seeds: Record<string, unknown> = {}
  seeds.currentAge = adult.currentAge
  seeds.cpfOA = adult.cpf.balances.oa
  seeds.cpfSA = adult.cpf.balances.sa
  seeds.cpfMA = adult.cpf.balances.ma
  seeds.cpfRA = adult.cpf.balances.ra
  seeds.cpfLifePlan = adult.cpf.lifePlan
  seeds.cpfPayoutStartAge = adult.cpf.lifeStartAge

  const hasTopUps =
    adult.cpf.annualTopUps.sa > 0 || adult.cpf.annualTopUps.ma > 0
  seeds.hasCpfTopUps = hasTopUps
  if (hasTopUps) {
    seeds.annualSaTopUp = adult.cpf.annualTopUps.sa
    seeds.annualMaTopUp = adult.cpf.annualTopUps.ma
  }

  seeds.hasCpfis = adult.cpf.cpfisEnabled
  return seeds
}

function seedProperty(): Record<string, unknown> {
  const plan = useHouseholdPlanStore.getState().plan
  const property = plan.properties[0]
  if (!property) return {}

  const seeds: Record<string, unknown> = {}
  seeds.propertyType = property.propertyType
  seeds.propertyValue = property.existingPropertyValue

  const hasMortgage = property.existingMortgageBalance > 0
  seeds.hasMortgage = hasMortgage
  if (hasMortgage) {
    seeds.mortgageOutstanding = property.existingMortgageBalance
    seeds.monthlyMortgagePayment = property.existingMonthlyPayment
    seeds.mortgageRatePercent = property.existingMortgageRate
    const currentYear = new Date().getFullYear()
    seeds.mortgageEndYear = currentYear + property.existingMortgageRemainingYears
  }

  const hasDownsizing = property.downsizing.scenario !== 'none'
  seeds.planToDownsize = hasDownsizing
  if (hasDownsizing) {
    const selfAdult = getSelfAdult()
    if (selfAdult) {
      const currentYear = new Date().getFullYear()
      seeds.downsizeYear = currentYear + (property.downsizing.sellAge - selfAdult.currentAge)
    }
    seeds.replacementPropertyCost = property.downsizing.newPropertyCost
  }

  const hasRental = property.rentalYield > 0
  seeds.hasRentalIncome = hasRental
  if (hasRental && property.existingPropertyValue > 0) {
    seeds.monthlyRentalIncome = Math.round(
      (property.rentalYield * property.existingPropertyValue) / 12
    )
  }

  return seeds
}

function seedExpenses(adult: PlanningAdult): Record<string, unknown> {
  const plan = useHouseholdPlanStore.getState().plan
  const baseExpense = plan.expenses.find(
    (e) => e.kind === 'base-living' && e.timing.owner === 'self'
  )
  const seeds: Record<string, unknown> = {}

  if (baseExpense) {
    seeds.retirementSpendingRatio =
      baseExpense.retirementSpendingAdjustment ?? 1.0
  }

  // currentAge needed for age-conditional fields
  seeds.currentAge = adult.currentAge
  return seeds
}

function seedHealthcare(adult: PlanningAdult): Record<string, unknown> {
  const seeds: Record<string, unknown> = {}
  seeds.ispTier = adult.healthcare.ispTier
  seeds.careShieldEnrolled = adult.healthcare.careShieldLifeEnabled
  seeds.mediSaveBalance = adult.cpf.balances.ma
  seeds.mediSaveTopUpAnnual = adult.healthcare.mediSaveTopUpAnnual ?? 0
  return seeds
}

function seedSalary(): Record<string, unknown> {
  const plan = useHouseholdPlanStore.getState().plan
  const salaryIncome = plan.income.find(
    (inc) => inc.kind === 'salary-model' && inc.owner === 'self'
  )
  if (!salaryIncome) return {}

  const seeds: Record<string, unknown> = {}

  // Reverse-map domain salaryModel to nudge flow option values
  const reverseModelMap: Record<string, string> = {
    simple: 'simple',
    realistic: 'realistic',
    'data-driven': 'mom',
  }
  if (salaryIncome.salaryModel) {
    seeds.salaryModel = reverseModelMap[salaryIncome.salaryModel] ?? 'simple'
  }
  if (salaryIncome.growthRate != null) {
    seeds.annualSalaryGrowthPercent = salaryIncome.growthRate
  }
  if (salaryIncome.bonusMonths != null) {
    seeds.annualBonusMonths = salaryIncome.bonusMonths
  }
  if (salaryIncome.realisticPhases && salaryIncome.realisticPhases.length > 0) {
    seeds.careerPhases = salaryIncome.realisticPhases.map((p) => ({ ...p }))
  }
  if (salaryIncome.promotionJumps && salaryIncome.promotionJumps.length > 0) {
    seeds.promotionJumps = salaryIncome.promotionJumps.map((j) => ({ ...j }))
  }
  return seeds
}

function seedSrs(adult: PlanningAdult): Record<string, unknown> {
  const seeds: Record<string, unknown> = {}
  seeds.srsBalance = adult.srs.balance
  seeds.contributeToSrs = adult.srs.annualContribution > 0
  if (adult.srs.annualContribution > 0) {
    seeds.annualSrsContribution = adult.srs.annualContribution
  }
  seeds.srsWithdrawalStartAge = adult.srs.drawdownStartAge
  return seeds
}

function seedAllocation(): Record<string, unknown> {
  const allocationState = useAllocationStore.getState()
  const seeds: Record<string, unknown> = {}
  seeds.rebalancingFrequency = 'annual' // informational default

  const glide = allocationState.glidePathConfig
  seeds.enableGlidePath = glide.enabled
  if (glide.enabled) {
    seeds.glidePathStartAge = glide.startAge
    seeds.glidePathEndAge = glide.endAge
  }
  return seeds
}

function seedProtection(adult: PlanningAdult): Record<string, unknown> {
  const seeds: Record<string, unknown> = {}
  seeds.emergencyFundBalance = adult.cashSavings
  seeds.emergencyFundTarget = 6 // sensible default

  const hasDebt = adult.nonMortgageDebtTotal > 0
  seeds.hasOutstandingDebt = hasDebt

  seeds.lifeCoverageAmount = adult.insuranceDeathCoverage
  seeds.ciCoverageAmount = adult.insuranceCICoverage
  seeds.disabilityCoverageMonthly = adult.insuranceDisabilityMonthly
  return seeds
}

/**
 * Returns seed values for a nudge flow based on current store state.
 * Keys match the field names in the nudge flow definitions.
 */
export function seedFlowValues(flowId: NudgeFlowId): Record<string, unknown> {
  const selfAdult = getSelfAdult()
  if (!selfAdult) return {}

  switch (flowId) {
    case 'cpf':
      return seedCpf(selfAdult)
    case 'property':
      return seedProperty()
    case 'expenses':
      return seedExpenses(selfAdult)
    case 'healthcare':
      return seedHealthcare(selfAdult)
    case 'salary':
      return seedSalary()
    case 'srs':
      return seedSrs(selfAdult)
    case 'goals':
      return {} // goals are new entries, nothing to seed
    case 'allocation':
      return seedAllocation()
    case 'protection':
      return seedProtection(selfAdult)
    default:
      return {}
  }
}

/**
 * Apply sensible defaults and toggle initialization to seeded flow values.
 * Shared between RefineFlowPage and NudgeDrawer to avoid duplication.
 */
export function applyFlowDefaults(
  seeds: Record<string, unknown>,
  screens: NudgeFlowScreen[],
): Record<string, unknown> {
  // Initialize toggles to false for showWhen logic
  for (const screen of screens) {
    for (const field of screen.fields) {
      if (field.type === 'toggle' && seeds[field.name] === undefined) {
        seeds[field.name] = false
      }
    }
  }
  // Sensible defaults for fields not populated by store data
  if (seeds.retirementSpendingRatio === undefined) seeds.retirementSpendingRatio = 1.0
  if (seeds.cpfPayoutStartAge === undefined) seeds.cpfPayoutStartAge = DEFAULT_CPF_PAYOUT_START_AGE
  if (seeds.cpfLifePlan === undefined) seeds.cpfLifePlan = DEFAULT_CPF_LIFE_PLAN
  if (seeds.emergencyFundTarget === undefined) seeds.emergencyFundTarget = DEFAULT_EMERGENCY_FUND_MONTHS
  if (seeds.rebalancingFrequency === undefined) seeds.rebalancingFrequency = DEFAULT_REBALANCING_FREQUENCY
  if (seeds.ispTier === undefined) seeds.ispTier = DEFAULT_ISP_TIER
  if (seeds.careShieldEnrolled === undefined) seeds.careShieldEnrolled = DEFAULT_CARESHIELD_ENROLLED
  return seeds
}
