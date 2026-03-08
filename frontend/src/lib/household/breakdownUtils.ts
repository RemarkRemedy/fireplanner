import type { CompiledHouseholdPlan } from '@/lib/household/compileHouseholdPlan'
import type { EntryOwner, ExpenseItem } from '@/lib/household/types'
import { formatCurrency } from '@/lib/utils'

export interface BreakdownSection {
  id: 'household' | EntryOwner
  title: string
  subtitle: string
  summary: string
  metrics: Array<{
    label: string
    value: string
    detail?: string
  }>
  itemLabels: string[]
}

export function annualizeExpense(expense: ExpenseItem): number {
  switch (expense.periodicity) {
    case 'monthly':
      return expense.amount * 12
    case 'annual':
    case 'one-off':
      return expense.amount
  }
}

export function isActiveAtCurrentYear(
  window: { startYearOffset: number; endYearOffset: number } | undefined,
): boolean {
  if (!window) return false
  return window.startYearOffset <= 0 && window.endYearOffset >= 0
}

export function formatMetric(value: number): string {
  return `${formatCurrency(value)}/yr`
}

export function sumActiveIncomeByOwner(compiledPlan: CompiledHouseholdPlan, owner: EntryOwner): number {
  return compiledPlan.incomeOrder.reduce((sum, incomeId) => {
    const income = compiledPlan.incomeById[incomeId]
    if (!income || income.owner !== owner || !isActiveAtCurrentYear(compiledPlan.resolvedTiming.incomeById[incomeId])) {
      return sum
    }
    return sum + income.annualAmount
  }, 0)
}

/** C25: Filter out retirement-withdrawal and one-off expenses from cost rollup. */
export function sumActiveExpensesByOwner(compiledPlan: CompiledHouseholdPlan, owner: EntryOwner): number {
  const directExpenses = compiledPlan.expenseOrder.reduce((sum, expenseId) => {
    const expense = compiledPlan.expensesById[expenseId]
    if (
      !expense
      || expense.owner !== owner
      || expense.kind === 'retirement-withdrawal'
      || !isActiveAtCurrentYear(compiledPlan.resolvedTiming.expenseById[expenseId])
    ) {
      return sum
    }
    return sum + annualizeExpense(expense)
  }, 0)

  const dependentCosts = compiledPlan.dependentOrder.reduce((sum, dependentId) => {
    const dependent = compiledPlan.dependentsById[dependentId]
    if (!dependent || dependent.owner !== owner || !isActiveAtCurrentYear(compiledPlan.resolvedTiming.dependentById[dependentId])) {
      return sum
    }
    return sum + dependent.annualCost
  }, 0)

  const healthcareCosts = compiledPlan.adultOrder.reduce((sum, adultId) => {
    const adult = compiledPlan.adultsById[adultId]
    if (!adult || adult.owner !== owner) return sum
    return sum + (compiledPlan.healthcareByAdultId[adultId]?.cashOutlayByYear[0] ?? 0)
  }, 0)

  /** C26: Apply ownershipPercent to property costs instead of raw monthly payment. */
  const propertyCosts = compiledPlan.propertyOrder.reduce((sum, propertyId) => {
    const property = compiledPlan.propertiesById[propertyId]
    if (!property || property.owner !== owner || !property.ownsProperty) return sum
    const ownershipPct = property.ownershipPercent ?? 1
    return sum + property.existingMonthlyPayment * 12 * ownershipPct
  }, 0)

  return directExpenses + dependentCosts + healthcareCosts + propertyCosts
}

export function sumCurrentHouseholdCosts(compiledPlan: CompiledHouseholdPlan): number {
  return sumActiveExpensesByOwner(compiledPlan, 'self')
    + sumActiveExpensesByOwner(compiledPlan, 'partner')
    + sumActiveExpensesByOwner(compiledPlan, 'shared')
}

export function sumAssetsByOwner(compiledPlan: CompiledHouseholdPlan, owner: EntryOwner): number {
  return compiledPlan.assetOrder.reduce((sum, assetId) => {
    const asset = compiledPlan.assetsById[assetId]
    if (!asset || asset.owner !== owner) return sum
    return sum + asset.amount
  }, 0)
}

/** W55: Deduplicate by (label, owner) tuple instead of label string alone. */
export function collectOwnerLabels(compiledPlan: CompiledHouseholdPlan, owner: EntryOwner): string[] {
  const seen = new Map<string, string>()
  const addLabel = (label: string, itemOwner: EntryOwner) => {
    const key = `${label}\0${itemOwner}`
    if (!seen.has(key)) {
      seen.set(key, label)
    }
  }

  for (const incomeId of compiledPlan.incomeOrder) {
    const income = compiledPlan.incomeById[incomeId]
    if (income && income.owner === owner) addLabel(income.label, income.owner)
  }
  for (const expenseId of compiledPlan.expenseOrder) {
    const expense = compiledPlan.expensesById[expenseId]
    if (expense && expense.owner === owner) addLabel(expense.label, expense.owner)
  }
  for (const assetId of compiledPlan.assetOrder) {
    const asset = compiledPlan.assetsById[assetId]
    if (asset && asset.owner === owner) addLabel(asset.label, asset.owner)
  }
  for (const goalId of compiledPlan.goalOrder) {
    const goal = compiledPlan.goalsById[goalId]
    if (goal && goal.owner === owner) addLabel(goal.label, goal.owner)
  }
  for (const propertyId of compiledPlan.propertyOrder) {
    const property = compiledPlan.propertiesById[propertyId]
    if (property && property.owner === owner) addLabel(property.label, property.owner)
  }
  for (const dependentId of compiledPlan.dependentOrder) {
    const dependent = compiledPlan.dependentsById[dependentId]
    if (dependent && dependent.owner === owner) addLabel(dependent.label, dependent.owner)
  }

  return Array.from(seen.values()).slice(0, 8)
}

export function buildOwnerSection(
  compiledPlan: CompiledHouseholdPlan,
  owner: EntryOwner,
): BreakdownSection | null {
  const labels = collectOwnerLabels(compiledPlan, owner)
  const matchingAdult = compiledPlan.adultOrder
    .map((adultId) => compiledPlan.adultsById[adultId])
    .find((adult) => !!adult && adult.owner === owner)

  const propertyCount = compiledPlan.propertyOrder.filter(
    (propertyId) => compiledPlan.propertiesById[propertyId]?.owner === owner,
  ).length
  const goalCount = compiledPlan.goalOrder.filter(
    (goalId) => compiledPlan.goalsById[goalId]?.owner === owner,
  ).length

  if (!matchingAdult && owner !== 'shared' && labels.length === 0) {
    return null
  }

  const title = owner === 'shared' ? 'Shared' : matchingAdult?.displayName ?? owner
  const incomeNow = sumActiveIncomeByOwner(compiledPlan, owner)
  const costsNow = sumActiveExpensesByOwner(compiledPlan, owner)
  const assetsTracked = sumAssetsByOwner(compiledPlan, owner)

  return {
    id: owner,
    title,
    subtitle: owner === 'shared'
      ? 'Items owned jointly across the plan.'
      : `${matchingAdult?.currentAge ?? '—'} now • retires at ${matchingAdult?.retirementAge ?? '—'}`,
    summary: `${formatMetric(incomeNow)} in authored income today`,
    metrics: [
      {
        label: 'Income today',
        value: formatMetric(incomeNow),
      },
      {
        label: 'Costs today',
        value: formatMetric(costsNow),
      },
      {
        label: 'Net today',
        value: formatMetric(incomeNow - costsNow),
      },
      {
        label: 'Tracked assets',
        value: formatCurrency(assetsTracked),
        detail: `${propertyCount} home${propertyCount === 1 ? '' : 's'} • ${goalCount} goal${goalCount === 1 ? '' : 's'}`,
      },
    ],
    itemLabels: labels,
  }
}

/** W54: Log warning when retirement row index clamp activates. */
export function buildHouseholdSection(compiledPlan: CompiledHouseholdPlan): BreakdownSection {
  const currentRow = compiledPlan.rows[0]
  if (compiledPlan.householdRetirementYearOffset >= compiledPlan.rows.length) {
    console.warn(
      `[HouseholdBreakdownPanel] householdRetirementYearOffset (${compiledPlan.householdRetirementYearOffset}) >= rows.length (${compiledPlan.rows.length}), clamping to last row`,
    )
  }
  const retirementRow = compiledPlan.rows[
    Math.min(compiledPlan.householdRetirementYearOffset, Math.max(0, compiledPlan.rows.length - 1))
  ]
  const authoredCostsToday = sumCurrentHouseholdCosts(compiledPlan)
  const itemLabels = [
    ...compiledPlan.adultOrder.map((adultId) => compiledPlan.adultsById[adultId]?.displayName ?? 'Adult'),
    ...compiledPlan.dependentOrder.map((dependentId) => compiledPlan.dependentsById[dependentId]?.label ?? 'Dependent'),
  ]

  return {
    id: 'household',
    title: 'Household',
    subtitle: `${compiledPlan.adultOrder.length} adult(s) • ${compiledPlan.dependentOrder.length} dependent(s)`,
    summary: `${formatMetric(currentRow?.annualSavings ?? 0)} in net household cashflow today`,
    metrics: [
      {
        label: 'Net income today',
        value: formatMetric(
          (currentRow?.totalNetIncome ?? 0) + (currentRow?.sharedIncome ?? 0) + (currentRow?.propertyIncome ?? 0),
        ),
      },
      {
        label: 'Costs today',
        value: formatMetric(authoredCostsToday),
        detail: 'Current authored costs rolled up from the household, self, partner, and shared sections.',
      },
      {
        label: 'Net today',
        value: formatMetric(currentRow?.annualSavings ?? 0),
      },
      {
        label: 'Retirement gap',
        value: formatMetric(retirementRow?.householdWithdrawalNeed ?? 0),
        detail: `${compiledPlan.portfolioAdjustments.length} portfolio adjustment(s) on the normalized timeline.`,
      },
    ],
    itemLabels,
  }
}

export function buildBreakdownSections(compiledPlan: CompiledHouseholdPlan): BreakdownSection[] {
  return [
    buildHouseholdSection(compiledPlan),
    buildOwnerSection(compiledPlan, 'self'),
    buildOwnerSection(compiledPlan, 'partner'),
    buildOwnerSection(compiledPlan, 'shared'),
  ].filter((section): section is BreakdownSection => !!section)
}
