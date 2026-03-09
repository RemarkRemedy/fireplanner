import type {
  AssetItem,
  Dependent,
  EntryOwner,
  ExpenseItem,
  GoalItem,
  HouseholdAssumptions,
  HouseholdPlan,
  HouseholdPlanType,
  IncomeSource,
  LegacyParityMeta,
  PlanningAdult,
  PropertyPlan,
  TimingRule,
} from './types'

export interface NormalizedHouseholdPlan {
  schemaVersion: 1
  householdId: string
  planType: HouseholdPlanType
  assumptions: HouseholdAssumptions
  parityMeta: LegacyParityMeta
  adultOrder: string[]
  adultsById: Record<string, PlanningAdult>
  dependentOrder: string[]
  dependentsById: Record<string, Dependent>
  incomeOrder: string[]
  incomeById: Record<string, IncomeSource>
  expenseOrder: string[]
  expensesById: Record<string, ExpenseItem>
  assetOrder: string[]
  assetsById: Record<string, AssetItem>
  goalOrder: string[]
  goalsById: Record<string, GoalItem>
  propertyOrder: string[]
  propertiesById: Record<string, PropertyPlan>
}

function entryOwnerRank(owner: string, path: string): number {
  switch (owner) {
    case 'self':
      return 0
    case 'partner':
      return 1
    case 'shared':
      return 2
    default:
      throw new Error(`Unknown owner "${owner}" at ${path}. Expected "self", "partner", or "shared".`)
  }
}

function adultOwnerRank(owner: string, path: string): number {
  switch (owner) {
    case 'self':
      return 0
    case 'partner':
      return 1
    default:
      throw new Error(`Unknown adult owner "${owner}" at ${path}. Expected "self" or "partner".`)
  }
}

function timingSortKey(timing?: TimingRule): [number, number, number] {
  if (!timing) {
    return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
  }

  if (timing.kind === 'single-age') {
    return [timing.age, timing.age, 0]
  }

  return [
    timing.startAge,
    timing.endAge ?? Number.MAX_SAFE_INTEGER,
    1,
  ]
}

export function indexById<T extends { id: string }>(
  items: readonly T[],
  collectionName: string,
): Record<string, T> {
  const byId: Record<string, T> = {}

  for (const item of items) {
    if (item.id in byId) {
      console.warn(`Duplicate ${collectionName} id "${item.id}" in household plan — keeping first, skipping duplicate.`)
      continue
    }
    byId[item.id] = item
  }

  return byId
}

export function sortByOwnerThenTiming<T extends { id: string; owner: EntryOwner; timing?: TimingRule }>(
  items: readonly T[]
): T[] {
  return [...items].sort((left, right) => {
    const ownerDiff = entryOwnerRank(left.owner, `${left.id}.owner`) - entryOwnerRank(right.owner, `${right.id}.owner`)
    if (ownerDiff !== 0) return ownerDiff

    const [leftStart, leftEnd, leftKind] = timingSortKey(left.timing)
    const [rightStart, rightEnd, rightKind] = timingSortKey(right.timing)
    if (leftStart !== rightStart) return leftStart - rightStart
    if (leftEnd !== rightEnd) return leftEnd - rightEnd
    if (leftKind !== rightKind) return leftKind - rightKind

    return left.id.localeCompare(right.id)
  })
}

function sortAdults(adults: readonly PlanningAdult[]): PlanningAdult[] {
  return [...adults].sort((left, right) => {
    const ownerDiff = adultOwnerRank(left.owner, `adults.${left.id}.owner`) - adultOwnerRank(right.owner, `adults.${right.id}.owner`)
    if (ownerDiff !== 0) return ownerDiff
    if (left.currentAge !== right.currentAge) return left.currentAge - right.currentAge
    return left.id.localeCompare(right.id)
  })
}

function sortDependents(dependents: readonly Dependent[]): Dependent[] {
  return [...dependents].sort((left, right) => {
    const ownerDiff = entryOwnerRank(left.owner, `dependents.${left.id}.owner`) - entryOwnerRank(right.owner, `dependents.${right.id}.owner`)
    if (ownerDiff !== 0) return ownerDiff
    const leftAge = left.currentAge ?? Number.MAX_SAFE_INTEGER
    const rightAge = right.currentAge ?? Number.MAX_SAFE_INTEGER
    if (leftAge !== rightAge) return leftAge - rightAge
    return left.id.localeCompare(right.id)
  })
}

function sortProperties(properties: readonly PropertyPlan[]): PropertyPlan[] {
  return [...properties].sort((left, right) => {
    const ownerDiff = entryOwnerRank(left.owner, `properties.${left.id}.owner`) - entryOwnerRank(right.owner, `properties.${right.id}.owner`)
    if (ownerDiff !== 0) return ownerDiff
    return left.id.localeCompare(right.id)
  })
}

export function normalizeHouseholdPlan(plan: HouseholdPlan): NormalizedHouseholdPlan {
  const adults = sortAdults(plan.adults)
  const dependents = sortDependents(plan.dependents)
  const income = sortByOwnerThenTiming(plan.income)
  const expenses = sortByOwnerThenTiming(plan.expenses)
  // AssetItem has no timing — sorts by owner then id (timingSortKey returns MAX for undefined)
  const assets = sortByOwnerThenTiming(plan.assets)
  const goals = sortByOwnerThenTiming(plan.goals)
  const properties = sortProperties(plan.properties)

  return {
    schemaVersion: plan.schemaVersion,
    householdId: plan.id,
    planType: plan.planType,
    assumptions: plan.assumptions,
    parityMeta: plan.parityMeta,
    adultOrder: adults.map((adult) => adult.id),
    adultsById: indexById(adults, 'adult'),
    dependentOrder: dependents.map((dependent) => dependent.id),
    dependentsById: indexById(dependents, 'dependent'),
    incomeOrder: income.map((item) => item.id),
    incomeById: indexById(income, 'income'),
    expenseOrder: expenses.map((item) => item.id),
    expensesById: indexById(expenses, 'expense'),
    assetOrder: assets.map((item) => item.id),
    assetsById: indexById(assets, 'asset'),
    goalOrder: goals.map((item) => item.id),
    goalsById: indexById(goals, 'goal'),
    propertyOrder: properties.map((item) => item.id),
    propertiesById: indexById(properties, 'property'),
  }
}
