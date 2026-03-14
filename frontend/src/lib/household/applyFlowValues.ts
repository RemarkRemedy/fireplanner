import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useAllocationStore } from '@/stores/useAllocationStore'
import { createId } from '@/lib/household/ids'
import type { NudgeFlowId } from '@/lib/data/nudgeFlows'
import type { HouseholdCpfConfig, GoalItem } from '@/lib/household/types'
import type { AllocationTemplate, DownsizingConfig, GoalCategory, GrowthModel, HealthcareConfig, SalaryModel } from '@/lib/types'

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
export function applyFlowValues(flowId: NudgeFlowId, values: Record<string, unknown>): void {
  const store = useHouseholdPlanStore.getState()
  const plan = store.plan
  const selfAdult = plan.adults.find((a) => a.owner === 'self')
  if (!selfAdult) return

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
        cpfUpdates.lifePlan = values.cpfLifePlan as HouseholdCpfConfig['lifePlan']
      }
      if (typeof values.cpfPayoutStartAge === 'number') {
        cpfUpdates.lifeStartAge = values.cpfPayoutStartAge
      }
      if (typeof values.hasCpfis === 'boolean') {
        cpfUpdates.cpfisEnabled = values.hasCpfis
      }

      store.updateAdult(selfAdult.id, {
        cpf: { ...selfAdult.cpf, ...cpfUpdates },
      })
      break
    }

    case 'property': {
      const property = plan.properties[0]
      if (!property) break

      const propertyUpdates: Record<string, unknown> = {}

      if (typeof values.propertyType === 'string') {
        propertyUpdates.propertyType = values.propertyType
      }
      if (typeof values.leaseTenure === 'string') {
        // 'freehold' maps to 999 years; numeric strings map directly
        const leaseYears = values.leaseTenure === 'freehold' ? 999 : parseInt(values.leaseTenure as string, 10)
        if (!isNaN(leaseYears)) {
          propertyUpdates.existingLeaseYears = leaseYears
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
        const currentYear = new Date().getFullYear()
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

      if (values.planToDownsize === true) {
        const downsizing: DownsizingConfig = {
          ...property.downsizing,
          scenario: 'sell-and-downsize',
        }
        if (typeof values.downsizeYear === 'number') {
          const currentYear = new Date().getFullYear()
          const selfAge = selfAdult.currentAge
          downsizing.sellAge = selfAge + (values.downsizeYear - currentYear)
        }
        if (typeof values.replacementPropertyCost === 'number') {
          downsizing.newPropertyCost = values.replacementPropertyCost
        }
        propertyUpdates.downsizing = downsizing
      }

      store.updateProperty(property.id, propertyUpdates)
      break
    }

    case 'expenses': {
      const baseExpense = plan.expenses.find(
        (e) => e.kind === 'base-living' && e.timing.owner === 'self'
      )
      if (!baseExpense) break

      const categoryFields = [
        'housingExpenses',
        'foodExpenses',
        'transportExpenses',
        'utilitiesExpenses',
        'entertainmentExpenses',
        'travelExpenses',
        'otherExpenses',
      ] as const

      const total = categoryFields.reduce((sum, field) => {
        const val = values[field]
        return sum + (typeof val === 'number' && val > 0 ? val : 0)
      }, 0)

      const expenseUpdates: Record<string, unknown> = {}
      if (total > 0) {
        // Category values are monthly; convert to annual
        expenseUpdates.amount = total * 12
      }
      if (typeof values.retirementSpendingRatio === 'number') {
        expenseUpdates.retirementSpendingAdjustment = values.retirementSpendingRatio
      }

      store.updateExpense(baseExpense.id, expenseUpdates)

      // Create a goal if large future expenses were provided
      if (values.hasLargeGoals === true && typeof values.goalName === 'string' && values.goalName) {
        const targetYear = typeof values.goalYear === 'number' ? values.goalYear : new Date().getFullYear() + 5
        const targetAge = selfAdult.currentAge + (targetYear - new Date().getFullYear())

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
      break
    }

    case 'healthcare': {
      const healthcareUpdates: Partial<HealthcareConfig> = {
        ...selfAdult.healthcare,
        enabled: true,
      }

      if (typeof values.ispTier === 'string') {
        healthcareUpdates.ispTier = values.ispTier as HealthcareConfig['ispTier']
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
      break
    }

    case 'salary': {
      // Find the salary-model income entry for self
      const salaryIncome = plan.income.find(
        (inc) => inc.kind === 'salary-model' && inc.owner === 'self'
      )
      if (!salaryIncome) break

      const incomeUpdates: Record<string, unknown> = {}

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

      store.updateIncome(salaryIncome.id, incomeUpdates)
      break
    }

    case 'srs': {
      const srsUpdates: Partial<typeof selfAdult.srs> = { ...selfAdult.srs }

      if (typeof values.srsBalance === 'number') {
        srsUpdates.balance = values.srsBalance
      }
      if (typeof values.annualSrsContribution === 'number') {
        srsUpdates.annualContribution = values.annualSrsContribution
      }
      if (typeof values.srsWithdrawalStartAge === 'number') {
        srsUpdates.drawdownStartAge = values.srsWithdrawalStartAge
      }

      store.updateAdult(selfAdult.id, {
        srs: srsUpdates,
      })
      break
    }

    case 'goals': {
      if (typeof values.goalName !== 'string' || !values.goalName) break

      const category = typeof values.goalCategory === 'string'
        ? toGoalCategory(values.goalCategory)
        : 'other'

      const targetYear = typeof values.goalTargetYear === 'number' ? values.goalTargetYear : new Date().getFullYear() + 5
      const targetAge = selfAdult.currentAge + (targetYear - new Date().getFullYear())

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
        durationYears: 1,
        priority: 'nice-to-have',
        inflationAdjusted: true,
        category,
      }

      store.addGoal(goal)
      break
    }

    case 'allocation': {
      if (typeof values.allocationTemplate === 'string') {
        const template = toAllocationTemplate(values.allocationTemplate)
        if (template) {
          useAllocationStore.getState().applyTemplate(template)
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
      }
      break
    }

    case 'protection': {
      const adultUpdates: Record<string, unknown> = {}

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
      break
    }

    default:
      break
  }
}
