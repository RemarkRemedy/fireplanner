import {
  createDefaultLegacyIndividualSnapshot,
  type LegacyIndividualSnapshot,
} from './fromLegacyIndividual'
import type {
  AdultOwner,
  AssetItem,
  EntryOwner,
  ExpenseItem,
  GoalItem,
  HouseholdPlan,
  IncomeSource,
  PropertyPlan,
  TimingRule,
} from './types'

const PRIMARY_OWNER: AdultOwner = 'self'

function isCompatibleOwner(owner: EntryOwner): boolean {
  return owner === PRIMARY_OWNER || owner === 'shared'
}

function isCompatibleTimingOwner(timing: TimingRule | null): boolean {
  if (!timing) return true
  return timing.owner === PRIMARY_OWNER
}

function toAgeRange(timing: TimingRule): { startAge: number; endAge: number | null } {
  if (timing.kind === 'single-age') {
    return { startAge: timing.age, endAge: timing.age }
  }

  return {
    startAge: timing.startAge,
    endAge: timing.endAge,
  }
}

function toAnnualAmount(item: Pick<ExpenseItem, 'amount' | 'periodicity'>): number | null {
  if (item.periodicity === 'annual') return item.amount
  if (item.periodicity === 'monthly') return item.amount * 12
  return null
}

function hasUnsupportedOwners(plan: HouseholdPlan): boolean {
  return [
    ...plan.dependents,
    ...plan.income,
    ...plan.expenses,
    ...plan.assets,
    ...plan.goals,
    ...plan.properties,
  ].some((entry) => !isCompatibleOwner(entry.owner))
}

function cloneIncomeSource(stream: IncomeSource) {
  const { startAge, endAge } = toAgeRange(stream.timing)
  return {
    id: stream.id.replace(/^income-stream-/, ''),
    name: stream.label,
    annualAmount: stream.annualAmount,
    startAge,
    endAge: endAge ?? 120,
    growthRate: stream.growthRate,
    type: stream.streamType,
    growthModel: stream.growthModel,
    taxTreatment: stream.taxTreatment,
    isCpfApplicable: stream.isCpfApplicable,
    isActive: stream.isActive,
  }
}

function cloneGoal(goal: GoalItem) {
  const { startAge, endAge } = toAgeRange(goal.timing)
  const durationYears = endAge === null ? goal.durationYears : Math.max(endAge - startAge + 1, 1)

  return {
    id: goal.id.replace(/^goal-/, ''),
    label: goal.label,
    amount: goal.amount,
    targetAge: startAge,
    durationYears,
    priority: goal.priority,
    inflationAdjusted: goal.inflationAdjusted,
    category: goal.category,
  }
}

function cloneLockedAsset(asset: AssetItem) {
  if (typeof asset.unlockAge !== 'number' || typeof asset.growthRate !== 'number') return null

  return {
    id: asset.id.replace(/^asset-locked-/, ''),
    name: asset.label,
    amount: asset.amount,
    unlockAge: asset.unlockAge,
    growthRate: asset.growthRate,
  }
}

function cloneExpenseAdjustment(expense: ExpenseItem) {
  const annualAmount = toAnnualAmount(expense)
  if (annualAmount === null) return null

  const { startAge, endAge } = toAgeRange(expense.timing)
  return {
    id: expense.id.replace(/^expense-adjustment-/, ''),
    label: expense.label,
    amount: annualAmount,
    startAge,
    endAge,
  }
}

function cloneParentSupport(expense: ExpenseItem, fallbackEndAge: number) {
  const monthlyAmount =
    expense.periodicity === 'monthly'
      ? expense.amount
      : expense.periodicity === 'annual'
        ? expense.amount / 12
        : null

  if (monthlyAmount === null) return null

  const { startAge, endAge } = toAgeRange(expense.timing)
  return {
    id: expense.id.replace(/^expense-parent-support-/, ''),
    label: expense.label,
    monthlyAmount,
    startAge,
    endAge: endAge ?? fallbackEndAge,
    growthRate: expense.growthRate ?? 0,
  }
}

function cloneRetirementWithdrawal(expense: ExpenseItem) {
  if (expense.periodicity === 'monthly') return null

  const { startAge, endAge } = toAgeRange(expense.timing)
  const durationYears = expense.durationYears ?? (endAge === null ? 1 : Math.max(endAge - startAge + 1, 1))

  return {
    id: expense.id.replace(/^expense-retirement-withdrawal-/, ''),
    label: expense.label,
    amount: expense.amount,
    age: startAge,
    durationYears,
    inflationAdjusted: expense.inflationAdjusted ?? false,
  }
}

function cloneProperty(property: PropertyPlan) {
  return {
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
  }
}

export function toLegacyIndividual(plan: HouseholdPlan): LegacyIndividualSnapshot | null {
  if (plan.adults.length !== 1 || plan.dependents.length > 0) return null
  if (plan.adults[0]?.owner !== PRIMARY_OWNER) return null
  if (hasUnsupportedOwners(plan)) return null
  if (!plan.income.every((entry) => isCompatibleTimingOwner(entry.timing))) return null
  if (!plan.expenses.every((entry) => isCompatibleTimingOwner(entry.timing))) return null
  if (!plan.goals.every((entry) => isCompatibleTimingOwner(entry.timing))) return null
  if (plan.properties.length > 1) return null

  const adult = plan.adults[0]
  const snapshot = createDefaultLegacyIndividualSnapshot()

  snapshot.profile.currentAge = adult.currentAge
  snapshot.profile.retirementAge = adult.retirementAge
  snapshot.profile.lifeExpectancy = adult.lifeExpectancy
  snapshot.profile.lifeStage = adult.lifeStage
  snapshot.profile.maritalStatus = adult.maritalStatus
  snapshot.profile.residencyStatus = adult.residencyStatus
  snapshot.profile.prMonths = adult.prMonths
  snapshot.profile.annualIncome = adult.annualIncome
  snapshot.profile.annualExpenses = adult.annualExpenses
  snapshot.profile.liquidNetWorth = adult.liquidNetWorth
  snapshot.profile.cpfOA = adult.cpf.balances.oa
  snapshot.profile.cpfSA = adult.cpf.balances.sa
  snapshot.profile.cpfMA = adult.cpf.balances.ma
  snapshot.profile.cpfRA = adult.cpf.balances.ra
  snapshot.profile.cpfTopUpOA = adult.cpf.annualTopUps.oa
  snapshot.profile.cpfTopUpSA = adult.cpf.annualTopUps.sa
  snapshot.profile.cpfTopUpMA = adult.cpf.annualTopUps.ma
  snapshot.profile.srsBalance = adult.srs.balance
  snapshot.profile.srsAnnualContribution = adult.srs.annualContribution
  snapshot.profile.srsInvestmentReturn = adult.srs.investmentReturn
  snapshot.profile.srsDrawdownStartAge = adult.srs.drawdownStartAge
  snapshot.profile.srsPostFireEnabled = adult.srs.postFireEnabled
  snapshot.profile.retirementPhase = adult.cpf.retirementPhase
  snapshot.profile.cpfLifeActualMonthlyPayout = adult.cpf.lifeActualMonthlyPayout
  snapshot.profile.cpfLifeStartAge = adult.cpf.lifeStartAge
  snapshot.profile.cpfLifePlan = adult.cpf.lifePlan
  snapshot.profile.cpfRetirementSum = adult.cpf.retirementSum
  snapshot.profile.cpfOaWithdrawals = adult.cpf.oaWithdrawals.map((entry) => ({ ...entry }))
  snapshot.profile.cpfisEnabled = adult.cpf.cpfisEnabled
  snapshot.profile.cpfisOaReturn = adult.cpf.cpfisOaReturn
  snapshot.profile.cpfisSaReturn = adult.cpf.cpfisSaReturn
  snapshot.profile.cpfAutoFallback = adult.cpf.autoFallback
  snapshot.profile.cpfAutoFallbackIncludeSA = adult.cpf.autoFallbackIncludeSA
  snapshot.profile.cpfVirtualRebalancing = adult.cpf.virtualRebalancing
  snapshot.profile.cpfVirtualRebalancingMode = adult.cpf.virtualRebalancingMode
  snapshot.profile.healthcareConfig = { ...adult.healthcare }

  snapshot.profile.fireType = plan.assumptions.fire.fireType
  snapshot.profile.swr = plan.assumptions.fire.swr
  snapshot.profile.fireNumberBasis = plan.assumptions.fire.fireNumberBasis
  snapshot.profile.expectedReturn = plan.assumptions.returns.expectedReturn
  snapshot.profile.usePortfolioReturn = plan.assumptions.returns.usePortfolioReturn
  snapshot.profile.inflation = plan.assumptions.returns.inflation
  snapshot.profile.expenseRatio = plan.assumptions.returns.expenseRatio
  snapshot.profile.rebalanceFrequency = plan.assumptions.returns.rebalanceFrequency
  snapshot.profile.cashReserveEnabled = plan.assumptions.cashReserve.enabled
  snapshot.profile.cashReserveMode = plan.assumptions.cashReserve.mode
  snapshot.profile.cashReserveFixedAmount = plan.assumptions.cashReserve.fixedAmount
  snapshot.profile.cashReserveMonths = plan.assumptions.cashReserve.months
  snapshot.profile.cashReserveReturn = plan.assumptions.cashReserve.returnRate
  snapshot.profile.retirementMitigation = { ...plan.assumptions.retirementMitigation }

  snapshot.income.momEducation = adult.taxProfile.momEducation
  snapshot.income.momAdjustment = adult.taxProfile.momAdjustment
  snapshot.income.personalReliefs = adult.taxProfile.personalReliefs
  snapshot.income.reliefBreakdown = adult.taxProfile.reliefBreakdown
    ? { ...adult.taxProfile.reliefBreakdown }
    : null
  snapshot.income.reliefBasisAge = adult.taxProfile.reliefBasisAge
  snapshot.income.lifeEvents = adult.lifeEvents.map((event) => ({ ...event }))
  snapshot.income.lifeEventsEnabled = adult.lifeEventsEnabled

  const salaryEntries = plan.income.filter((entry) => entry.kind === 'salary-model')
  if (salaryEntries.length > 1) return null
  const salaryEntry = salaryEntries[0]
  if (salaryEntry) {
    snapshot.profile.annualIncome = salaryEntry.annualAmount
    snapshot.income.salaryModel = salaryEntry.salaryModel ?? snapshot.income.salaryModel
    snapshot.income.annualSalary = salaryEntry.annualAmount
    snapshot.income.salaryGrowthRate = salaryEntry.growthRate
    snapshot.income.bonusMonths = salaryEntry.bonusMonths ?? 0
    snapshot.income.employerCpfEnabled = salaryEntry.employerCpfEnabled ?? true
    snapshot.income.realisticPhases = salaryEntry.realisticPhases
      ? salaryEntry.realisticPhases.map((phase) => ({ ...phase }))
      : snapshot.income.realisticPhases
    snapshot.income.promotionJumps = salaryEntry.promotionJumps
      ? salaryEntry.promotionJumps.map((jump) => ({ ...jump }))
      : snapshot.income.promotionJumps
  }

  snapshot.income.incomeStreams = plan.income
    .filter((entry) => entry.kind === 'income-stream')
    .map((entry) => cloneIncomeSource(entry))

  const baseExpenses = plan.expenses.filter((entry) => entry.kind === 'base-living')
  if (baseExpenses.length > 1) return null
  const baseExpense = baseExpenses[0]
  if (baseExpense) {
    const annualAmount = toAnnualAmount(baseExpense)
    if (annualAmount === null) return null
    snapshot.profile.annualExpenses = annualAmount
    if (typeof baseExpense.retirementSpendingAdjustment === 'number') {
      snapshot.profile.retirementSpendingAdjustment = baseExpense.retirementSpendingAdjustment
    }
  }

  const parentSupport = plan.expenses
    .filter((entry) => entry.kind === 'parent-support')
    .map((entry) => cloneParentSupport(entry, adult.lifeExpectancy))
  if (parentSupport.some((entry) => entry === null)) return null
  snapshot.profile.parentSupport = parentSupport.filter((entry) => entry !== null)
  snapshot.profile.parentSupportEnabled = adult.parentSupportEnabled || snapshot.profile.parentSupport.length > 0

  const expenseAdjustments = plan.expenses
    .filter((entry) => entry.kind === 'expense-adjustment')
    .map((entry) => cloneExpenseAdjustment(entry))
  if (expenseAdjustments.some((entry) => entry === null)) return null
  snapshot.profile.expenseAdjustments = expenseAdjustments.filter((entry) => entry !== null)

  const retirementWithdrawals = plan.expenses
    .filter((entry) => entry.kind === 'retirement-withdrawal')
    .map((entry) => cloneRetirementWithdrawal(entry))
  if (retirementWithdrawals.some((entry) => entry === null)) return null
  snapshot.profile.retirementWithdrawals = retirementWithdrawals.filter((entry) => entry !== null)

  const liquidAssets = plan.assets.filter((entry) => entry.kind === 'liquid-net-worth')
  if (liquidAssets.length > 1) return null
  const liquidAsset = liquidAssets[0]
  if (liquidAsset) {
    snapshot.profile.liquidNetWorth = liquidAsset.amount
  }

  const lockedAssets = plan.assets
    .filter((entry) => entry.kind === 'locked-asset')
    .map((entry) => cloneLockedAsset(entry))
  if (lockedAssets.some((entry) => entry === null)) return null
  snapshot.profile.lockedAssets = lockedAssets.filter((entry) => entry !== null)

  snapshot.profile.financialGoals = plan.goals.map((goal) => cloneGoal(goal))

  const property = plan.properties[0]
  if (property) {
    Object.assign(snapshot.property, cloneProperty(property))
  }

  return snapshot
}
