/**
 * Utilities for slicing a multi-adult household plan into per-adult views.
 *
 * Two modes:
 * - `buildSingleAdultPlanSlice`: filter-only, no amount scaling.
 *   Used by IncomeSection where each adult sees full shared expenses.
 * - `buildSplitAdultPlanSlice`: filter + scale shared items by splitRatio.
 *   Used by ProjectionPage / StressTestPage where shared items are split.
 */

import type {
  AdultOwner,
  AssetItem,
  EntryOwner,
  ExpenseItem,
  GoalItem,
  HouseholdPlan,
  IncomeSource,
  PlanningAdult,
} from '@/lib/household/types'

export interface AdultAges {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
}

export interface PlanSliceResult {
  slice: HouseholdPlan
  adultAges: AdultAges
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function remapOwner<T extends { owner: EntryOwner }>(entry: T): T {
  return { ...entry, owner: 'self' as EntryOwner }
}

function remapTiming<T extends { timing: { owner: AdultOwner; [k: string]: unknown } }>(entry: T): T {
  return { ...entry, timing: { ...entry.timing, owner: 'self' as AdultOwner } }
}

function remapTimingIfPresent<T extends { timing?: { owner: AdultOwner; [k: string]: unknown } }>(entry: T): T {
  if (entry.timing?.owner) {
    return { ...entry, timing: { ...entry.timing, owner: 'self' as AdultOwner } } as T
  }
  return entry
}

// ---------------------------------------------------------------------------
// buildSingleAdultPlanSlice — filter only, no scaling
// ---------------------------------------------------------------------------

/**
 * Creates a single-adult plan slice by extracting one adult's data from a
 * multi-adult household plan. Shared items are included at FULL value.
 * All owners are remapped to 'self' so the legacy adapter accepts it.
 *
 * Used by IncomeSection for per-adult income projection.
 */
export function buildSingleAdultPlanSlice(
  plan: HouseholdPlan,
  adultId: string,
): PlanSliceResult | null {
  const targetAdult = plan.adults.find((a) => a.id === adultId)
  if (!targetAdult) return null

  const isOwnedByTarget = (owner: EntryOwner) => owner === targetAdult.owner

  const remappedAdult: PlanningAdult = {
    ...structuredClone(targetAdult),
    owner: 'self',
  }

  const adultIncome = plan.income
    .filter((entry) => isOwnedByTarget(entry.owner))
    .map((entry) => remapTiming(remapOwner(structuredClone(entry))))

  const adultExpenses = plan.expenses
    .filter((entry) => isOwnedByTarget(entry.owner) || entry.owner === 'shared')
    .map((entry) => remapTimingIfPresent(remapOwner(structuredClone(entry))))

  const adultGoals = plan.goals
    .filter((entry) => isOwnedByTarget(entry.owner) || entry.owner === 'shared')
    .map((entry) => remapTiming(remapOwner(structuredClone(entry))))

  const adultAssets = plan.assets
    .filter((entry) => isOwnedByTarget(entry.owner) || entry.owner === 'shared')
    .map((entry) => remapOwner(structuredClone(entry)))

  const adultProperties = plan.properties
    .filter((entry) => isOwnedByTarget(entry.owner) || entry.owner === 'shared')
    .map((entry) => remapOwner(structuredClone(entry)))

  return {
    slice: {
      ...structuredClone(plan),
      planType: 'individual',
      adults: [remappedAdult],
      dependents: [],
      income: adultIncome,
      expenses: adultExpenses,
      goals: adultGoals,
      assets: adultAssets,
      properties: adultProperties,
    },
    adultAges: {
      currentAge: targetAdult.currentAge,
      retirementAge: targetAdult.retirementAge,
      lifeExpectancy: targetAdult.lifeExpectancy,
    },
  }
}

// ---------------------------------------------------------------------------
// buildSplitAdultPlanSlice — filter + scale shared items
// ---------------------------------------------------------------------------

function scaleIncomeSource(entry: IncomeSource, ratio: number): IncomeSource {
  return { ...entry, annualAmount: entry.annualAmount * ratio }
}

function scaleExpenseItem(entry: ExpenseItem, ratio: number): ExpenseItem {
  return { ...entry, amount: entry.amount * ratio }
}

function scaleGoalItem(entry: GoalItem, ratio: number): GoalItem {
  return { ...entry, amount: entry.amount * ratio }
}

function scaleAssetItem(entry: AssetItem, ratio: number): AssetItem {
  return { ...entry, amount: entry.amount * ratio }
}

/**
 * Creates a single-adult plan slice with shared items SCALED by splitRatio.
 * Owned items are included at full value.
 * Property is NOT scaled here — ownershipPercent already handles the split
 * in the projection engine.
 *
 * Used by ProjectionPage and (future) StressTestPage for per-adult views.
 */
export function buildSplitAdultPlanSlice(
  plan: HouseholdPlan,
  adultId: string,
  splitRatio: number,
): PlanSliceResult | null {
  const targetAdult = plan.adults.find((a) => a.id === adultId)
  if (!targetAdult) return null

  const isOwnedByTarget = (owner: EntryOwner) => owner === targetAdult.owner
  const isShared = (owner: EntryOwner) => owner === 'shared'

  const remappedAdult: PlanningAdult = {
    ...structuredClone(targetAdult),
    owner: 'self',
    // Scale the adult's own annualExpenses if it includes shared base-living:
    // The actual expense amounts are in plan.expenses entries, so
    // annualExpenses on PlanningAdult is a summary field that gets
    // recomputed by toLegacyIndividual from plan.expenses. No scaling needed here.
  }

  // Income: include owned at full value + shared at splitRatio
  const adultIncome = [
    ...plan.income
      .filter((entry) => isOwnedByTarget(entry.owner))
      .map((entry) => remapTiming(remapOwner(structuredClone(entry)))),
    ...plan.income
      .filter((entry) => isShared(entry.owner))
      .map((entry) => scaleIncomeSource(remapTiming(remapOwner(structuredClone(entry))), splitRatio)),
  ]

  // Expenses: include owned at full value + shared at splitRatio
  const adultExpenses = [
    ...plan.expenses
      .filter((entry) => isOwnedByTarget(entry.owner))
      .map((entry) => remapTimingIfPresent(remapOwner(structuredClone(entry)))),
    ...plan.expenses
      .filter((entry) => isShared(entry.owner))
      .map((entry) => scaleExpenseItem(remapTimingIfPresent(remapOwner(structuredClone(entry))), splitRatio)),
  ]

  // Goals: include owned at full value + shared at splitRatio
  const adultGoals = [
    ...plan.goals
      .filter((entry) => isOwnedByTarget(entry.owner))
      .map((entry) => remapTiming(remapOwner(structuredClone(entry)))),
    ...plan.goals
      .filter((entry) => isShared(entry.owner))
      .map((entry) => scaleGoalItem(remapTiming(remapOwner(structuredClone(entry))), splitRatio)),
  ]

  // Assets: include owned at full value + shared at splitRatio
  const adultAssets = [
    ...plan.assets
      .filter((entry) => isOwnedByTarget(entry.owner))
      .map((entry) => remapOwner(structuredClone(entry))),
    ...plan.assets
      .filter((entry) => isShared(entry.owner))
      .map((entry) => scaleAssetItem(remapOwner(structuredClone(entry)), splitRatio)),
  ]

  // Properties: filter by owner, do NOT scale (ownershipPercent handles it)
  const adultProperties = plan.properties
    .filter((entry) => isOwnedByTarget(entry.owner) || entry.owner === 'shared')
    .map((entry) => remapOwner(structuredClone(entry)))

  return {
    slice: {
      ...structuredClone(plan),
      planType: 'individual',
      adults: [remappedAdult],
      dependents: [],
      income: adultIncome,
      expenses: adultExpenses,
      goals: adultGoals,
      assets: adultAssets,
      properties: adultProperties,
    },
    adultAges: {
      currentAge: targetAdult.currentAge,
      retirementAge: targetAdult.retirementAge,
      lifeExpectancy: targetAdult.lifeExpectancy,
    },
  }
}
