import type {
  IncomeState,
  ProfileState,
  PropertyState,
  ValidationErrors,
} from '@/lib/types'
import {
  compileHouseholdPlan,
  type CompiledHouseholdPlan,
} from '@/lib/household/compileHouseholdPlan'
import {
  createDefaultLegacyIndividualSnapshot,
  type LegacyIndividualSnapshot,
} from '@/lib/household/fromLegacyIndividual'
import { toLegacyIndividual } from '@/lib/household/toLegacyIndividual'
import type {
  ExpenseItem,
  GoalItem,
  HouseholdPlan,
  IncomeSource,
  PlanningAdult,
  PropertyPlan,
  TimingRule,
} from '@/lib/household/types'

export interface HouseholdRuntimeLegacyInputs {
  profile: ProfileState
  income: IncomeState
  property: PropertyState
}

function emptyValidationErrors(): ValidationErrors {
  return {}
}

function cloneSnapshot(
  snapshot: LegacyIndividualSnapshot,
): HouseholdRuntimeLegacyInputs {
  return {
    profile: {
      ...structuredClone(snapshot.profile),
      validationErrors: emptyValidationErrors(),
    } as ProfileState,
    income: {
      ...structuredClone(snapshot.income),
      validationErrors: emptyValidationErrors(),
    } as IncomeState,
    property: {
      ...structuredClone(snapshot.property),
      validationErrors: emptyValidationErrors(),
    } as PropertyState,
  }
}

function getReferenceAdult(plan: HouseholdPlan): PlanningAdult {
  return plan.adults.find((adult) => adult.owner === 'self') ?? plan.adults[0]!
}

function getTimingRange(
  timing: TimingRule | null,
  fallbackCurrentAge: number,
  fallbackLifeExpectancy: number,
): { startAge: number; endAge: number | null } {
  if (!timing) {
    return {
      startAge: fallbackCurrentAge,
      endAge: fallbackLifeExpectancy,
    }
  }

  if (timing.kind === 'single-age') {
    return {
      startAge: timing.age,
      endAge: timing.age,
    }
  }

  return {
    startAge: timing.startAge,
    endAge: timing.endAge,
  }
}

function isActiveAtCurrentYear(
  sourceId: string,
  windows: Record<string, { startYearOffset: number; endYearOffset: number }>,
): boolean {
  const window = windows[sourceId]
  return !!window && window.startYearOffset <= 0 && window.endYearOffset >= 0
}

function weightedAverage(
  entries: Array<{ weight: number; value: number }>,
  fallback: number,
): number {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0)
  if (totalWeight <= 0) {
    return fallback
  }

  return entries.reduce((sum, entry) => (
    sum + Math.max(0, entry.weight) * entry.value
  ), 0) / totalWeight
}

function sumAdultField(
  adults: PlanningAdult[],
  pick: (adult: PlanningAdult) => number,
): number {
  return adults.reduce((sum, adult) => sum + pick(adult), 0)
}

function resolveGrowthRate(expense: ExpenseItem, inflation: number): number {
  const model = expense.growthModel ?? 'fixed'
  if (model === 'inflation-linked') return inflation
  if (model === 'none') return 0
  return expense.growthRate ?? 0
}

function mapParentSupport(
  expenses: ExpenseItem[],
  referenceAdult: PlanningAdult,
  inflation: number,
): ProfileState['parentSupport'] {
  return expenses
    .filter((expense) => expense.kind === 'parent-support')
    .map((expense) => {
      const range = getTimingRange(
        expense.timing,
        referenceAdult.currentAge,
        referenceAdult.lifeExpectancy,
      )
      const monthlyAmount = expense.periodicity === 'monthly'
        ? expense.amount
        : expense.periodicity === 'annual'
          ? expense.amount / 12
          : 0

      return {
        id: expense.id.replace(/^expense-parent-support-/, ''),
        label: expense.label,
        monthlyAmount,
        startAge: range.startAge,
        endAge: range.endAge ?? referenceAdult.lifeExpectancy,
        growthRate: resolveGrowthRate(expense, inflation),
      }
    })
}

function mapExpenseAdjustments(
  expenses: ExpenseItem[],
  referenceAdult: PlanningAdult,
): ProfileState['expenseAdjustments'] {
  return expenses
    .filter((expense) => expense.kind === 'expense-adjustment')
    .map((expense) => {
      const range = getTimingRange(
        expense.timing,
        referenceAdult.currentAge,
        referenceAdult.lifeExpectancy,
      )
      const annualAmount = expense.periodicity === 'monthly'
        ? expense.amount * 12
        : expense.amount

      return {
        id: expense.id.replace(/^expense-adjustment-/, ''),
        label: expense.label,
        amount: annualAmount,
        startAge: range.startAge,
        endAge: range.endAge,
      }
    })
}

function mapRetirementWithdrawals(
  expenses: ExpenseItem[],
  referenceAdult: PlanningAdult,
): ProfileState['retirementWithdrawals'] {
  return expenses
    .filter((expense) => expense.kind === 'retirement-withdrawal')
    .map((expense) => {
      const range = getTimingRange(
        expense.timing,
        referenceAdult.currentAge,
        referenceAdult.lifeExpectancy,
      )
      const durationYears = expense.durationYears
        ?? (range.endAge == null ? 1 : Math.max(1, range.endAge - range.startAge + 1))

      return {
        id: expense.id.replace(/^expense-retirement-withdrawal-/, ''),
        label: expense.label,
        amount: expense.amount,
        age: range.startAge,
        durationYears,
        inflationAdjusted: expense.inflationAdjusted ?? false,
      }
    })
}

function mapGoals(
  goals: GoalItem[],
  referenceAdult: PlanningAdult,
): ProfileState['financialGoals'] {
  return goals.map((goal) => {
    const range = getTimingRange(
      goal.timing,
      referenceAdult.currentAge,
      referenceAdult.lifeExpectancy,
    )

    return {
      id: goal.id.replace(/^goal-/, ''),
      label: goal.label,
      amount: goal.amount,
      targetAge: range.startAge,
      durationYears: goal.durationYears,
      priority: goal.priority,
      inflationAdjusted: goal.inflationAdjusted,
      category: goal.category,
    }
  })
}

function mapLockedAssets(
  plan: HouseholdPlan,
): ProfileState['lockedAssets'] {
  return plan.assets
    .filter((asset) => asset.kind === 'locked-asset')
    .flatMap((asset) => {
      if (typeof asset.unlockAge !== 'number' || typeof asset.growthRate !== 'number') {
        return []
      }

      return [{
        id: asset.id.replace(/^asset-locked-/, ''),
        name: asset.label,
        amount: asset.amount,
        unlockAge: asset.unlockAge,
        growthRate: asset.growthRate,
      }]
    })
}

function pickPrimaryProperty(
  properties: PropertyPlan[],
): PropertyPlan | null {
  return properties.find((property) => property.owner === 'shared')
    ?? properties.find((property) => property.owner === 'self')
    ?? properties[0]
    ?? null
}

function mapProperty(
  property: PropertyPlan | null,
  defaults: PropertyState,
): PropertyState {
  if (!property) {
    return {
      ...defaults,
      validationErrors: emptyValidationErrors(),
    }
  }

  return {
    ...defaults,
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
    downsizing: structuredClone(property.downsizing),
    hdbFlatType: property.hdbFlatType,
    hdbMonetizationStrategy: property.hdbMonetizationStrategy,
    hdbLbsRetainedLease: property.hdbLbsRetainedLease,
    hdbSublettingRooms: property.hdbSublettingRooms,
    hdbSublettingRate: property.hdbSublettingRate,
    hdbCpfUsedForHousing: property.hdbCpfUsedForHousing,
    validationErrors: emptyValidationErrors(),
  }
}

function buildAggregateRuntimeSnapshot(
  plan: HouseholdPlan,
  compiledPlan: CompiledHouseholdPlan,
): HouseholdRuntimeLegacyInputs {
  const defaults = cloneSnapshot(createDefaultLegacyIndividualSnapshot())
  const referenceAdult = getReferenceAdult(plan)
  const activeSalaryModels = plan.income.filter((income): income is IncomeSource & {
    kind: 'salary-model'
  } => (
    income.kind === 'salary-model'
    && income.isActive !== false
    && isActiveAtCurrentYear(income.id, compiledPlan.resolvedTiming.incomeById)
  ))
  const activeBaseLivingExpenses = plan.expenses.filter((expense) => (
    (expense.kind === 'base-living' || expense.kind === 'additional-living')
    && isActiveAtCurrentYear(expense.id, compiledPlan.resolvedTiming.expenseById)
  ))
  const currentRecurringBaseExpense = activeBaseLivingExpenses.reduce((sum, expense) => {
    const annualAmount = expense.periodicity === 'monthly'
      ? expense.amount * 12
      : expense.amount
    return sum + annualAmount
  }, 0)
  const retirementSpendingAdjustment = weightedAverage(
    activeBaseLivingExpenses.map((expense) => ({
      weight: expense.periodicity === 'monthly' ? expense.amount * 12 : expense.amount,
      value: expense.retirementSpendingAdjustment ?? 1,
    })),
    1,
  )
  const aggregateAnnualIncome = plan.income.reduce((sum, income) => (
    income.isActive !== false && isActiveAtCurrentYear(income.id, compiledPlan.resolvedTiming.incomeById)
      ? sum + income.annualAmount
      : sum
  ), 0)
  const salaryGrowthRate = weightedAverage(
    activeSalaryModels.map((income) => ({
      weight: income.annualAmount,
      value: income.growthRate,
    })),
    0,
  )
  const bonusMonths = weightedAverage(
    activeSalaryModels.map((income) => ({
      weight: income.annualAmount,
      value: income.bonusMonths ?? 0,
    })),
    0,
  )
  const salaryModel = activeSalaryModels.length === 1
    ? activeSalaryModels[0].salaryModel ?? 'simple'
    : 'simple'
  const primaryProperty = pickPrimaryProperty(plan.properties)

  defaults.profile.currentAge = referenceAdult.currentAge
  defaults.profile.retirementAge = referenceAdult.currentAge + compiledPlan.householdRetirementYearOffset
  defaults.profile.lifeExpectancy = referenceAdult.currentAge + compiledPlan.yearCount - 1
  defaults.profile.lifeStage = compiledPlan.householdRetirementYearOffset === 0 ? 'post-fire' : 'pre-fire'
  defaults.profile.maritalStatus = plan.planType === 'individual' ? referenceAdult.maritalStatus : 'married'
  defaults.profile.residencyStatus = referenceAdult.residencyStatus
  defaults.profile.prMonths = referenceAdult.prMonths
  defaults.profile.annualIncome = aggregateAnnualIncome
  defaults.profile.annualExpenses = currentRecurringBaseExpense || compiledPlan.rows[0]?.retirementExpenseBase || referenceAdult.annualExpenses
  defaults.profile.liquidNetWorth = sumAdultField(plan.adults, (adult) => adult.liquidNetWorth)
  defaults.profile.cpfOA = sumAdultField(plan.adults, (adult) => adult.cpf.balances.oa)
  defaults.profile.cpfSA = sumAdultField(plan.adults, (adult) => adult.cpf.balances.sa)
  defaults.profile.cpfMA = sumAdultField(plan.adults, (adult) => adult.cpf.balances.ma)
  defaults.profile.cpfRA = sumAdultField(plan.adults, (adult) => adult.cpf.balances.ra)
  defaults.profile.cpfTopUpOA = sumAdultField(plan.adults, (adult) => adult.cpf.annualTopUps.oa)
  defaults.profile.cpfTopUpSA = sumAdultField(plan.adults, (adult) => adult.cpf.annualTopUps.sa)
  defaults.profile.cpfTopUpMA = sumAdultField(plan.adults, (adult) => adult.cpf.annualTopUps.ma)
  defaults.profile.srsBalance = sumAdultField(plan.adults, (adult) => adult.srs.balance)
  defaults.profile.srsAnnualContribution = sumAdultField(plan.adults, (adult) => adult.srs.annualContribution)
  defaults.profile.srsInvestmentReturn = weightedAverage(
    plan.adults.map((adult) => ({
      weight: Math.max(adult.srs.balance, 1),
      value: adult.srs.investmentReturn,
    })),
    referenceAdult.srs.investmentReturn,
  )
  defaults.profile.srsDrawdownStartAge = Math.min(
    ...plan.adults.map((adult) => adult.srs.drawdownStartAge),
  )
  defaults.profile.srsPostFireEnabled = plan.adults.some((adult) => adult.srs.postFireEnabled)
  defaults.profile.cashReserveEnabled = plan.assumptions.cashReserve.enabled
  defaults.profile.cashReserveMode = plan.assumptions.cashReserve.mode
  defaults.profile.cashReserveFixedAmount = plan.assumptions.cashReserve.fixedAmount
  defaults.profile.cashReserveMonths = plan.assumptions.cashReserve.months
  defaults.profile.cashReserveReturn = plan.assumptions.cashReserve.returnRate
  defaults.profile.retirementMitigation = structuredClone(plan.assumptions.retirementMitigation)
  defaults.profile.fireType = plan.assumptions.fire.fireType
  defaults.profile.swr = plan.assumptions.fire.swr
  defaults.profile.fireNumberBasis = plan.assumptions.fire.fireNumberBasis
  defaults.profile.retirementSpendingAdjustment = retirementSpendingAdjustment
  defaults.profile.expectedReturn = plan.assumptions.returns.expectedReturn
  defaults.profile.usePortfolioReturn = plan.assumptions.returns.usePortfolioReturn
  defaults.profile.inflation = plan.assumptions.returns.inflation
  defaults.profile.expenseRatio = plan.assumptions.returns.expenseRatio
  defaults.profile.rebalanceFrequency = plan.assumptions.returns.rebalanceFrequency
  defaults.profile.retirementPhase = referenceAdult.cpf.retirementPhase
  defaults.profile.cpfLifeActualMonthlyPayout = sumAdultField(plan.adults, (adult) => adult.cpf.lifeActualMonthlyPayout)
  defaults.profile.cpfLifeStartAge = Math.min(...plan.adults.map((adult) => adult.cpf.lifeStartAge))
  defaults.profile.cpfLifePlan = referenceAdult.cpf.lifePlan
  defaults.profile.cpfRetirementSum = referenceAdult.cpf.retirementSum
  defaults.profile.parentSupportEnabled = plan.expenses.some((expense) => expense.kind === 'parent-support')
  defaults.profile.parentSupport = mapParentSupport(plan.expenses, referenceAdult, plan.assumptions.returns.inflation)
  defaults.profile.healthcareConfig = structuredClone(referenceAdult.healthcare)
  defaults.profile.cpfOaWithdrawals = plan.adults.flatMap((adult) => (
    adult.cpf.oaWithdrawals.map((withdrawal) => ({ ...withdrawal }))
  ))
  defaults.profile.cpfisEnabled = plan.adults.some((adult) => adult.cpf.cpfisEnabled)
  defaults.profile.cpfisOaReturn = weightedAverage(
    plan.adults.map((adult) => ({
      weight: Math.max(adult.cpf.balances.oa, 1),
      value: adult.cpf.cpfisOaReturn,
    })),
    referenceAdult.cpf.cpfisOaReturn,
  )
  defaults.profile.cpfisSaReturn = weightedAverage(
    plan.adults.map((adult) => ({
      weight: Math.max(adult.cpf.balances.sa, 1),
      value: adult.cpf.cpfisSaReturn,
    })),
    referenceAdult.cpf.cpfisSaReturn,
  )
  defaults.profile.cpfAutoFallback = plan.adults.some((adult) => adult.cpf.autoFallback)
  defaults.profile.cpfAutoFallbackIncludeSA = plan.adults.some((adult) => adult.cpf.autoFallbackIncludeSA)
  defaults.profile.cpfVirtualRebalancing = plan.adults.some((adult) => adult.cpf.virtualRebalancing)
  defaults.profile.cpfVirtualRebalancingMode = referenceAdult.cpf.virtualRebalancingMode
  defaults.profile.retirementWithdrawals = mapRetirementWithdrawals(plan.expenses, referenceAdult)
  defaults.profile.expenseAdjustments = mapExpenseAdjustments(plan.expenses, referenceAdult)
  defaults.profile.financialGoals = mapGoals(plan.goals, referenceAdult)
  defaults.profile.lockedAssets = mapLockedAssets(plan)

  defaults.income.salaryModel = salaryModel
  defaults.income.annualSalary = activeSalaryModels.reduce((sum, income) => sum + income.annualAmount, 0)
  defaults.income.salaryGrowthRate = salaryGrowthRate
  defaults.income.bonusMonths = bonusMonths
  defaults.income.employerCpfEnabled = activeSalaryModels.some((income) => income.employerCpfEnabled)
  defaults.income.incomeStreams = plan.income
    .filter((income) => income.kind === 'income-stream')
    .map((income) => {
      const window = compiledPlan.resolvedTiming.incomeById[income.id]
      return {
        id: income.id.replace(/^income-stream-/, ''),
        name: income.label,
        annualAmount: income.annualAmount,
        startAge: window?.startAge ?? referenceAdult.currentAge,
        endAge: (window?.endAge ?? referenceAdult.lifeExpectancy) + 1,
        growthRate: income.growthRate,
        type: income.streamType,
        growthModel: income.growthModel,
        taxTreatment: income.taxTreatment,
        isCpfApplicable: income.isCpfApplicable,
        isActive: income.isActive,
      }
    })
  defaults.income.lifeEvents = plan.adults.flatMap((adult) => adult.lifeEvents.map((event) => ({ ...event })))
  defaults.income.realisticPhases = activeSalaryModels.length === 1
    ? structuredClone(activeSalaryModels[0].realisticPhases ?? [])
    : []
  defaults.income.promotionJumps = activeSalaryModels.length === 1
    ? structuredClone(activeSalaryModels[0].promotionJumps ?? [])
    : []
  defaults.income.momEducation = referenceAdult.taxProfile.momEducation
  defaults.income.momAdjustment = referenceAdult.taxProfile.momAdjustment
  defaults.income.lifeEventsEnabled = plan.adults.some((adult) => adult.lifeEventsEnabled && adult.lifeEvents.length > 0)
  defaults.income.personalReliefs = sumAdultField(plan.adults, (adult) => adult.taxProfile.personalReliefs)
  defaults.income.reliefBreakdown = referenceAdult.taxProfile.reliefBreakdown
    ? structuredClone(referenceAdult.taxProfile.reliefBreakdown)
    : null
  defaults.income.reliefBasisAge = referenceAdult.taxProfile.reliefBasisAge

  defaults.property = mapProperty(primaryProperty, defaults.property)

  return defaults
}

export function buildHouseholdRuntimeLegacyInputs(
  plan: HouseholdPlan,
  compiledPlan?: CompiledHouseholdPlan,
): HouseholdRuntimeLegacyInputs {
  const exact = toLegacyIndividual(plan)
  if (exact) {
    return cloneSnapshot(exact)
  }

  const compiled = compiledPlan ?? compileHouseholdPlan(plan)
  return buildAggregateRuntimeSnapshot(plan, compiled)
}
