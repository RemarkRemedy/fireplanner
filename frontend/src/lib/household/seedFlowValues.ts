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
import { FLOW_FIELD_TO_CATEGORY } from '@/lib/data/retirementTemplates'
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
    if (property.downsizing.proceedsAllocationPercent != null) {
      seeds.downsizeProceedsPercent = property.downsizing.proceedsAllocationPercent
    }
  }

  const hasRental = property.rentalYield > 0
  seeds.hasRentalIncome = hasRental
  if (hasRental && property.existingPropertyValue > 0) {
    seeds.monthlyRentalIncome = Math.round(
      (property.rentalYield * property.existingPropertyValue) / 12
    )
    if (property.rentalExpensesPercent != null && property.rentalExpensesPercent > 0) {
      seeds.rentalExpensesPercent = property.rentalExpensesPercent
    }
    // Reverse-compute calendar year from stored age
    if (property.rentalIncomeEndAge != null) {
      const selfAdult = getSelfAdult()
      if (selfAdult) {
        const currentYear = new Date().getFullYear()
        seeds.rentalIncomeEndYear = currentYear + (property.rentalIncomeEndAge - selfAdult.currentAge)
      }
    }
  }

  return seeds
}

function seedExpenses(adult: PlanningAdult): Record<string, unknown> {
  const plan = useHouseholdPlanStore.getState().plan
  const baseExpense = plan.expenses.find(
    (e) => e.kind === 'base-living' && e.timing.owner === 'self'
  )
  const seeds: Record<string, unknown> = {}

  // Sentinel fields for showWhen/skipWhen (not persisted, computed at seed time)
  const ownsProperty = plan.properties.some((p) => p.ownsProperty)
  seeds._ownsProperty = ownsProperty

  if (baseExpense) {
    seeds.retirementSpendingRatio =
      baseExpense.retirementSpendingAdjustment ?? 1.0

    // Seed category breakdown if persisted
    const bd = baseExpense.categoryBreakdown
    if (bd) {
      const amounts = bd.amounts ?? {}
      // Suppress rent for property owners
      if (!ownsProperty && amounts.rent != null) seeds.housingExpenses = amounts.rent
      if (amounts.food != null) seeds.foodExpenses = amounts.food
      if (amounts.transport != null) seeds.transportExpenses = amounts.transport
      if (amounts.utilities != null) seeds.utilitiesExpenses = amounts.utilities
      if (amounts.entertainment != null) seeds.entertainmentExpenses = amounts.entertainment
      if (amounts.travel != null) seeds.travelExpenses = amounts.travel
      if (amounts.other != null) seeds.otherExpenses = amounts.other
      if (bd.templateId) seeds.templateId = bd.templateId
      if (bd.multipliers) seeds.multipliers = { ...bd.multipliers }
    }

    // Compute _hasAnyExpenseCategory sentinel from seeded values
    // Use FLOW_FIELD_TO_CATEGORY keys to stay in sync with RefineFlowPage's reactive update
    const categoryFlowFields = Object.keys(FLOW_FIELD_TO_CATEGORY)
    seeds._hasAnyExpenseCategory = categoryFlowFields.some((f) => typeof seeds[f] === 'number' && (seeds[f] as number) > 0)
  }

  // Auto-set hasLargeGoals if goals already exist in the plan
  const existingGoals = plan.goals.filter((g) => g.owner === 'self')
  if (existingGoals.length > 0) {
    seeds.hasLargeGoals = true
    // Seed goalDrafts for multi-goal editor
    const currentYear = new Date().getFullYear()
    seeds.goalDrafts = existingGoals.map((g) => ({
      id: g.id,
      name: g.label,
      amount: g.amount,
      year: g.timing.kind === 'single-age' ? currentYear + (g.timing.age - adult.currentAge) : currentYear + 5,
      category: g.category ?? 'other',
    }))
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
  if (adult.healthcare.customIspPremium != null) {
    seeds.annualIspPremium = adult.healthcare.customIspPremium
  }
  if (adult.healthcare.customCareShieldPremium != null) {
    seeds.annualCareShieldPremium = adult.healthcare.customCareShieldPremium
  }
  seeds.useMediSaveForPremiums = adult.healthcare.useMediSaveForPremiums ?? true
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
  // Reverse-compute salaryStopYear from endAge
  if (salaryIncome.timing.kind === 'age-range' && salaryIncome.timing.endAge != null) {
    const selfAdult = getSelfAdult()
    if (selfAdult) {
      const currentYear = new Date().getFullYear()
      seeds.salaryStopYear = currentYear + (salaryIncome.timing.endAge - selfAdult.currentAge)
    }
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

  // Reverse-map investmentReturn to strategy label (only if it matches a known rate)
  const returnToStrategy: [number, string][] = [
    [0.005, 'cash'],
    [0.05, 'mixed'],
    [0.06, 'etf'],
    [0.08, 'stocks'],
  ]
  const matched = returnToStrategy.find(([rate]) => Math.abs(adult.srs.investmentReturn - rate) < 0.001)
  if (matched) {
    seeds.srsInvestmentStrategy = matched[1]
  }
  // If no match, leave unset so the user must actively choose (avoids silently overwriting custom rates)

  return seeds
}

function seedAllocation(): Record<string, unknown> {
  const allocationState = useAllocationStore.getState()
  const plan = useHouseholdPlanStore.getState().plan
  const seeds: Record<string, unknown> = {}
  seeds.rebalancingFrequency = plan.assumptions.returns.rebalanceFrequency ?? 'annual'

  const glide = allocationState.glidePathConfig
  seeds.enableGlidePath = glide.enabled
  if (glide.enabled) {
    seeds.glidePathStartAge = glide.startAge
    seeds.glidePathEndAge = glide.endAge
  }

  // Reverse-seed target template from selectedTargetTemplate
  const targetTemplate = allocationState.selectedTargetTemplate
  if (targetTemplate && targetTemplate !== 'custom') {
    seeds.glidePathEndTemplate = targetTemplate
  } else if (targetTemplate === 'custom') {
    // Check if target weights match the very-conservative preset (applied via setTargetWeights)
    const veryConservativeWeights = [0.05, 0.03, 0.02, 0.60, 0.10, 0.05, 0.15, 0.00]
    const tw = allocationState.targetWeights
    if (tw.length === veryConservativeWeights.length &&
        tw.every((w, i) => Math.abs(w - veryConservativeWeights[i]) < 0.001)) {
      seeds.glidePathEndTemplate = 'very-conservative'
    }
  }

  return seeds
}

function seedProtection(adult: PlanningAdult): Record<string, unknown> {
  const seeds: Record<string, unknown> = {}
  seeds.emergencyFundBalance = adult.cashSavings
  seeds.emergencyFundTarget = adult.emergencyFundTarget ?? 6

  const hasDebt = adult.nonMortgageDebtTotal > 0
  seeds.hasOutstandingDebt = hasDebt

  seeds.lifeCoverageAmount = adult.insuranceDeathCoverage
  seeds.ciCoverageAmount = adult.insuranceCICoverage
  seeds.disabilityCoverageMonthly = adult.insuranceDisabilityMonthly
  seeds.annualInsurancePremiums = adult.annualInsurancePremiums ?? 0
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
