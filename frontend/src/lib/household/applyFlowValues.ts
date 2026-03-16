/**
 * Known unmapped fields (no store destination yet):
 * - Healthcare: hasRider, annualIspPremium, useMediSaveForPremiums, careShieldSupplementPlan, annualCareShieldPremium
 * - Salary: variablePayPercent
 * - SRS: srsInvestmentStrategy
 * - Protection: emergencyFundTarget, emergencyFundType, hasTermLife, annualInsurancePremiums
 * - Property: rentalIncomeEndYear
 * - Expenses: retirementSpendingModel
 * - Allocation: rebalancingFrequency, glidePathEndTemplate
 * These are collected for future features. Adding store support requires schema changes.
 */

import { FLOW_FIELD_TO_CATEGORY } from '@/lib/data/retirementTemplates'
import { computeWeightedRetirementRatio } from '@/lib/calculations/expenses'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { createId } from '@/lib/household/ids'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'
import type { HouseholdCpfConfig, GoalItem } from '@/lib/household/types'
import type { AllocationTemplate, CareerPhase, DownsizingConfig, GoalCategory, GrowthModel, HealthcareConfig, IspTierOption, PromotionJump, PropertyType, SalaryModel } from '@/lib/types'
import type { ExpenseItem, IncomeSource, PlanningAdult, PropertyPlan } from '@/lib/household/types'

/**
 * Maps a nudge flow's goalCategory option value to a valid GoalCategory.
 * The nudge flow uses 'property' but the domain type uses 'housing';
 * 'charity' is not a valid GoalCategory and maps to 'other'.
 */
function toGoalCategory(value: string): GoalCategory {
  const mapping: Record<string, GoalCategory> = {
    property: 'housing',
    education: 'education',
    travel: 'travel',
    wedding: 'wedding',
    renovation: 'renovation',
    vehicle: 'vehicle',
    charity: 'other',
    other: 'other',
  }
  return mapping[value] ?? 'other'
}

/**
 * Maps a nudge flow allocation template option to a valid AllocationTemplate (excluding 'custom').
 * 'cpf-heavy' is not a recognised template; falls back to 'balanced'.
 */
function toIspTier(val: unknown): IspTierOption | null {
  const valid: IspTierOption[] = ['none', 'basic', 'standard', 'enhanced']
  return typeof val === 'string' && valid.includes(val as IspTierOption) ? val as IspTierOption : null
}

function toCpfLifePlan(val: unknown): HouseholdCpfConfig['lifePlan'] | null {
  const valid: HouseholdCpfConfig['lifePlan'][] = ['basic', 'standard', 'escalating']
  return typeof val === 'string' && valid.includes(val as HouseholdCpfConfig['lifePlan'])
    ? val as HouseholdCpfConfig['lifePlan']
    : null
}

function toPropertyType(val: unknown): PropertyType | null {
  const valid: PropertyType[] = ['hdb', 'condo', 'landed']
  return typeof val === 'string' && valid.includes(val as PropertyType) ? val as PropertyType : null
}

function toAllocationTemplate(value: string): Exclude<AllocationTemplate, 'custom'> | null {
  const valid: Record<string, Exclude<AllocationTemplate, 'custom'>> = {
    conservative: 'conservative',
    balanced: 'balanced',
    aggressive: 'aggressive',
  }
  return valid[value] ?? null
}

/**
 * Apply the collected values from a nudge flow to the appropriate stores.
 * Shared between RefineFlowPage (full-page flows) and NudgeDrawer (drawer flows).
 */
export function applyFlowValues(flowId: NudgeFlowId, values: Record<string, unknown>): boolean {
  const store = useHouseholdPlanStore.getState()
  const plan = store.plan
  const selfAdult = plan.adults.find((a) => a.owner === 'self')
  if (!selfAdult) return false

  switch (flowId) {
    case 'cpf': {
      const balances: HouseholdCpfConfig['balances'] = {
        ...selfAdult.cpf.balances,
        ...(typeof values.cpfOA === 'number' ? { oa: values.cpfOA } : {}),
        ...(typeof values.cpfSA === 'number' ? { sa: values.cpfSA } : {}),
        ...(typeof values.cpfMA === 'number' ? { ma: values.cpfMA } : {}),
        ...(typeof values.cpfRA === 'number' ? { ra: values.cpfRA } : {}),
      }

      const annualTopUps: HouseholdCpfConfig['annualTopUps'] = {
        ...selfAdult.cpf.annualTopUps,
        ...(typeof values.annualSaTopUp === 'number' ? { sa: values.annualSaTopUp } : {}),
        ...(typeof values.annualMaTopUp === 'number' ? { ma: values.annualMaTopUp } : {}),
      }

      const cpfUpdates: Partial<HouseholdCpfConfig> = {
        balances,
        annualTopUps,
      }

      if (typeof values.cpfLifePlan === 'string') {
        const plan = toCpfLifePlan(values.cpfLifePlan)
        if (plan) cpfUpdates.lifePlan = plan
      }
      if (typeof values.cpfPayoutStartAge === 'number') {
        cpfUpdates.lifeStartAge = values.cpfPayoutStartAge
      }
      if (typeof values.hasCpfis === 'boolean') {
        cpfUpdates.cpfisEnabled = values.hasCpfis
      }

      // Toggle-off: clear top-ups when user says they don't make voluntary top-ups
      if (values.hasCpfTopUps === false) {
        cpfUpdates.annualTopUps = { oa: 0, sa: 0, ma: 0 }
      }

      store.updateAdult(selfAdult.id, {
        cpf: { ...selfAdult.cpf, ...cpfUpdates },
      })
      return true
    }

    case 'property': {
      const property = plan.properties[0]
      if (!property) return false

      const currentYear = new Date().getFullYear()
      const propertyUpdates: Partial<PropertyPlan> = {}

      if (typeof values.propertyType === 'string') {
        const pt = toPropertyType(values.propertyType)
        if (pt) propertyUpdates.propertyType = pt
      }
      if (typeof values.leaseTenure === 'string') {
        // 'freehold' maps to 999 years; numeric strings map directly
        const leaseYears = values.leaseTenure === 'freehold' ? 999 : parseInt(values.leaseTenure as string, 10)
        if (!isNaN(leaseYears)) {
          propertyUpdates.existingLeaseYears = leaseYears
        }
      }
      if (typeof values.leaseStartYear === 'number' && typeof values.leaseTenure === 'string') {
        const originalLease = values.leaseTenure === 'freehold' ? 999 : parseInt(values.leaseTenure as string, 10)
        if (!isNaN(originalLease)) {
          const elapsed = currentYear - values.leaseStartYear
          propertyUpdates.existingLeaseYears = Math.max(0, originalLease - elapsed)
        }
      }
      if (typeof values.propertyValue === 'number') {
        propertyUpdates.existingPropertyValue = values.propertyValue
      }
      if (typeof values.mortgageOutstanding === 'number') {
        propertyUpdates.existingMortgageBalance = values.mortgageOutstanding
      }
      if (typeof values.monthlyMortgagePayment === 'number') {
        propertyUpdates.existingMonthlyPayment = values.monthlyMortgagePayment
      }
      if (typeof values.mortgageRatePercent === 'number') {
        propertyUpdates.existingMortgageRate = values.mortgageRatePercent
      }
      if (typeof values.mortgageEndYear === 'number') {
        const remainingYears = Math.max(0, values.mortgageEndYear - currentYear)
        propertyUpdates.existingMortgageRemainingYears = remainingYears
      }
      if (typeof values.monthlyRentalIncome === 'number') {
        // Rental yield as annual rental / property value
        const propValue =
          typeof values.propertyValue === 'number'
            ? values.propertyValue
            : property.existingPropertyValue
        if (propValue > 0) {
          propertyUpdates.rentalYield = ((values.monthlyRentalIncome as number) * 12) / propValue
        }
      }

      if (typeof values.rentalExpensesPercent === 'number') {
        propertyUpdates.rentalExpensesPercent = values.rentalExpensesPercent
      }

      if (values.planToDownsize === true) {
        const downsizing: DownsizingConfig = {
          ...property.downsizing,
          scenario: 'sell-and-downsize',
        }
        if (typeof values.downsizeYear === 'number') {
          const selfAge = selfAdult.currentAge
          downsizing.sellAge = selfAge + (values.downsizeYear - currentYear)
        }
        if (typeof values.replacementPropertyCost === 'number') {
          downsizing.newPropertyCost = values.replacementPropertyCost
        }
        if (typeof values.downsizeProceedsPercent === 'number') {
          downsizing.proceedsAllocationPercent = values.downsizeProceedsPercent
        }
        propertyUpdates.downsizing = downsizing
      }

      // Toggle-off: reset downsizing when user says no
      if (values.planToDownsize === false) {
        propertyUpdates.downsizing = { ...property.downsizing, scenario: 'none' as const }
      }

      // Toggle-off: clear mortgage fields when user says no mortgage
      if (values.hasMortgage === false) {
        propertyUpdates.existingMortgageBalance = 0
        propertyUpdates.existingMonthlyPayment = 0
        propertyUpdates.existingMortgageRate = 0
        propertyUpdates.existingMortgageRemainingYears = 0
      }

      // Toggle-off: clear rental yield and expenses when user says no rental income
      if (values.hasRentalIncome === false) {
        propertyUpdates.rentalYield = 0
        propertyUpdates.rentalExpensesPercent = 0
      }

      store.updateProperty(property.id, propertyUpdates)
      return true
    }

    case 'expenses': {
      const baseExpense = plan.expenses.find(
        (e) => e.kind === 'base-living' && e.timing.owner === 'self'
      )
      if (!baseExpense) return false

      // Build canonical breakdown from nudge flow field names
      const breakdown: Record<string, number> = {}
      for (const [flowField, catKey] of Object.entries(FLOW_FIELD_TO_CATEGORY)) {
        const val = values[flowField]
        if (typeof val === 'number' && val >= 0) {
          breakdown[catKey] = val
        }
      }

      const filledCategories = Object.values(breakdown).filter((v) => v > 0)
      const total = filledCategories.reduce((sum, v) => sum + v, 0)

      const expenseUpdates: Partial<ExpenseItem> = {}

      if (filledCategories.length >= 1 && total > 0) {
        // Persist category breakdown
        const multipliers = (typeof values.multipliers === 'object' && values.multipliers != null)
          ? values.multipliers as Record<string, number>
          : {}
        const templateId = typeof values.templateId === 'string'
          ? values.templateId as 'frugal' | 'active' | 'none' | 'custom'
          : 'none'

        expenseUpdates.categoryBreakdown = {
          amounts: breakdown,
          templateId,
          multipliers,
        }

        // Compute weighted retirement ratio
        expenseUpdates.retirementSpendingAdjustment = computeWeightedRetirementRatio(breakdown, multipliers)

        // Only overwrite total if 2+ categories filled (avoid understating with partial entry)
        if (filledCategories.length >= 2) {
          expenseUpdates.amount = total * 12
        }
      } else if (typeof values.retirementSpendingRatio === 'number') {
        // Fallback: scalar ratio if no categories (e.g., re-entering with old data)
        expenseUpdates.retirementSpendingAdjustment = values.retirementSpendingRatio
      }

      store.updateExpense(baseExpense.id, expenseUpdates)

      // Create a goal if large future expenses were provided
      if (values.hasLargeGoals === true && typeof values.goalName === 'string' && values.goalName) {
        const currentYear = new Date().getFullYear()
        const targetYear = typeof values.goalYear === 'number' ? values.goalYear : currentYear + 5
        const targetAge = selfAdult.currentAge + (targetYear - currentYear)

        // Avoid creating duplicate goals with the same label
        const existingGoal = plan.goals.find(
          (g) => g.label === values.goalName && g.owner === 'self'
        )
        if (!existingGoal) {
          const goal: GoalItem = {
            id: createId('goal'),
            owner: 'self',
            label: values.goalName,
            kind: 'financial-goal',
            timing: {
              kind: 'single-age',
              owner: 'self',
              age: targetAge,
            },
            amount: typeof values.goalAmount === 'number' ? values.goalAmount : 0,
            durationYears: 1,
            priority: 'important',
            inflationAdjusted: true,
            category: 'other',
          }
          store.addGoal(goal)
        }
      }
      return true
    }

    case 'healthcare': {
      const healthcareUpdates: Partial<HealthcareConfig> = {
        ...selfAdult.healthcare,
        enabled: true,
      }

      if (typeof values.ispTier === 'string') {
        const tier = toIspTier(values.ispTier)
        if (tier) healthcareUpdates.ispTier = tier
      }
      if (typeof values.careShieldEnrolled === 'boolean') {
        healthcareUpdates.careShieldLifeEnabled = values.careShieldEnrolled
      }
      if (typeof values.mediSaveTopUpAnnual === 'number') {
        healthcareUpdates.mediSaveTopUpAnnual = values.mediSaveTopUpAnnual
      }

      store.updateAdult(selfAdult.id, {
        healthcare: healthcareUpdates as HealthcareConfig,
      })

      // mediSaveBalance maps to CPF MA balance (MediSave is the MA account)
      if (typeof values.mediSaveBalance === 'number') {
        store.updateAdult(selfAdult.id, {
          cpf: {
            ...selfAdult.cpf,
            balances: {
              ...selfAdult.cpf.balances,
              ma: values.mediSaveBalance,
            },
          },
        })
      }
      return true
    }

    case 'salary': {
      // Find the salary-model income entry for self
      const salaryIncome = plan.income.find(
        (inc) => inc.kind === 'salary-model' && inc.owner === 'self'
      )
      if (!salaryIncome) return false

      const incomeUpdates: Partial<IncomeSource> = {}

      if (typeof values.salaryModel === 'string') {
        // Map nudge flow option values to SalaryModel domain values
        const salaryModelMap: Record<string, SalaryModel> = {
          simple: 'simple',
          realistic: 'realistic',
          mom: 'data-driven',
        }
        const mappedSalaryModel = salaryModelMap[values.salaryModel]
        if (mappedSalaryModel) {
          incomeUpdates.salaryModel = mappedSalaryModel
          // All salary models use 'fixed' growthModel — the salary model itself handles growth
          incomeUpdates.growthModel = 'fixed' as GrowthModel
        }
      }
      if (typeof values.annualSalaryGrowthPercent === 'number') {
        // Only apply growth rate when salary model is 'simple' (flat growth)
        const effectiveModel = typeof values.salaryModel === 'string'
          ? (values.salaryModel === 'mom' ? 'data-driven' : values.salaryModel)
          : salaryIncome.salaryModel
        if (effectiveModel === 'simple') {
          incomeUpdates.growthRate = values.annualSalaryGrowthPercent
        }
      }
      if (typeof values.annualBonusMonths === 'number') {
        incomeUpdates.bonusMonths = values.annualBonusMonths
      }

      // Map salaryStopYear to timing.endAge
      if (typeof values.salaryStopYear === 'number') {
        const currentYear = new Date().getFullYear()
        const endAge = selfAdult.currentAge + (values.salaryStopYear - currentYear)
        if (endAge >= selfAdult.currentAge) {
          incomeUpdates.timing = {
            kind: 'age-range',
            owner: salaryIncome.timing.owner,
            startAge: salaryIncome.timing.kind === 'age-range' ? salaryIncome.timing.startAge : selfAdult.currentAge,
            endAge,
          }
        }
      }

      // Career phases and promotion jumps for "realistic" model
      const effectiveModel = typeof values.salaryModel === 'string'
        ? (values.salaryModel === 'mom' ? 'data-driven' : values.salaryModel)
        : salaryIncome.salaryModel
      if (effectiveModel === 'realistic') {
        if (Array.isArray(values.careerPhases) && values.careerPhases.length > 0) {
          incomeUpdates.realisticPhases = values.careerPhases as CareerPhase[]
        }
        if (Array.isArray(values.promotionJumps)) {
          incomeUpdates.promotionJumps = values.promotionJumps as PromotionJump[]
        }
      }

      store.updateIncome(salaryIncome.id, incomeUpdates)
      return true
    }

    case 'srs': {
      const srsUpdates: Partial<typeof selfAdult.srs> = { ...selfAdult.srs }

      if (typeof values.srsBalance === 'number') {
        srsUpdates.balance = values.srsBalance
      }

      // Only set contribution values if the toggle is not explicitly off
      if (values.contributeToSrs !== false) {
        if (typeof values.annualSrsContribution === 'number') {
          srsUpdates.annualContribution = values.annualSrsContribution
        }
        if (typeof values.srsWithdrawalStartAge === 'number') {
          srsUpdates.drawdownStartAge = values.srsWithdrawalStartAge
        }
      }

      // Toggle-off: zero out SRS contribution when user says they don't contribute
      if (values.contributeToSrs === false) {
        srsUpdates.annualContribution = 0
      }

      store.updateAdult(selfAdult.id, {
        srs: srsUpdates,
      })
      return true
    }

    case 'goals': {
      if (typeof values.goalName !== 'string' || !values.goalName) return false

      const category = typeof values.goalCategory === 'string'
        ? toGoalCategory(values.goalCategory)
        : 'other'

      const currentYear = new Date().getFullYear()
      const targetYear = typeof values.goalTargetYear === 'number' ? values.goalTargetYear : currentYear + 5
      const targetAge = selfAdult.currentAge + (targetYear - currentYear)

      const goal: GoalItem = {
        id: createId('goal'),
        owner: 'self',
        label: values.goalName,
        kind: 'financial-goal',
        timing: {
          kind: 'single-age',
          owner: 'self',
          age: targetAge,
        },
        amount: typeof values.goalTargetAmount === 'number' ? values.goalTargetAmount : 0,
        ...(typeof values.goalCurrentSavings === 'number' && values.goalCurrentSavings > 0
          ? { amountSaved: values.goalCurrentSavings }
          : {}),
        durationYears: 1,
        priority: 'nice-to-have',
        inflationAdjusted: true,
        category,
      }

      // Avoid creating duplicate goals with the same label
      const existingGoal = plan.goals.find(
        (g) => g.label === values.goalName && g.owner === 'self'
      )
      if (!existingGoal) {
        store.addGoal(goal)
      }
      return true
    }

    case 'allocation': {
      let applied = false
      if (typeof values.allocationTemplate === 'string') {
        const template = toAllocationTemplate(values.allocationTemplate)
        if (template) {
          useAllocationStore.getState().applyTemplate(template)
          applied = true
        }
      }

      // Wire glide path config fields
      if (typeof values.enableGlidePath === 'boolean') {
        const allocationState = useAllocationStore.getState()
        const currentGlidePathConfig = allocationState.glidePathConfig
        const updatedConfig = {
          ...currentGlidePathConfig,
          enabled: values.enableGlidePath,
          ...(typeof values.glidePathStartAge === 'number' ? { startAge: values.glidePathStartAge } : {}),
          ...(typeof values.glidePathEndAge === 'number' ? { endAge: values.glidePathEndAge } : {}),
        }
        allocationState.setGlidePathConfig(updatedConfig)
        applied = true
      }
      return applied
    }

    case 'protection': {
      const adultUpdates: Partial<PlanningAdult> = {}

      if (typeof values.emergencyFundBalance === 'number') {
        adultUpdates.cashSavings = values.emergencyFundBalance
      }

      // Sum all debt fields into nonMortgageDebtTotal
      const debtFields = [
        'carLoanOutstanding',
        'studentLoanOutstanding',
        'personalLoanOutstanding',
        'creditCardDebt',
        'otherDebt',
      ] as const
      const totalDebt = debtFields.reduce((sum, field) => {
        const val = values[field]
        return sum + (typeof val === 'number' && val > 0 ? val : 0)
      }, 0)
      if (totalDebt > 0 || values.hasOutstandingDebt === true) {
        adultUpdates.nonMortgageDebtTotal = totalDebt
      }

      // Toggle-off: clear debt fields when user says no outstanding debt
      if (values.hasOutstandingDebt === false) {
        adultUpdates.nonMortgageDebtTotal = 0
        adultUpdates.nonMortgageDebtMonthlyPayment = 0
      }

      // Insurance fields
      if (typeof values.lifeCoverageAmount === 'number') {
        adultUpdates.insuranceDeathCoverage = values.lifeCoverageAmount
      }
      if (typeof values.ciCoverageAmount === 'number') {
        adultUpdates.insuranceCICoverage = values.ciCoverageAmount
      }
      if (typeof values.disabilityCoverageMonthly === 'number') {
        adultUpdates.insuranceDisabilityMonthly = values.disabilityCoverageMonthly
      }

      if (Object.keys(adultUpdates).length > 0) {
        store.updateAdult(selfAdult.id, adultUpdates)
      }
      return true
    }

    default:
      return false
  }
}
