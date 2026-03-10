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
  TimingRule,
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

/**
 * Shift timing ages when the timing's original owner differs from the target adult.
 * If a shared expense says "Age based on: TJ, startAge: 32" and TJ is 32 but Chloe
 * is 28, the calendar-equivalent for Chloe is startAge: 28.
 *
 * ageDelta = originalOwnerAge - targetAdultAge (positive when target is younger)
 */
function shiftTimingAges(timing: TimingRule, ageDelta: number): TimingRule {
  if (ageDelta === 0) return timing
  if (timing.kind === 'single-age') {
    return { ...timing, age: timing.age - ageDelta }
  }
  return {
    ...timing,
    startAge: timing.startAge - ageDelta,
    endAge: timing.endAge !== null ? timing.endAge - ageDelta : null,
  }
}

/**
 * Look up the current age of the adult who owns a timing rule.
 * Returns 0 delta if the owner matches the target already.
 */
function getTimingAgeDelta(
  timing: TimingRule,
  targetAdult: PlanningAdult,
  allAdults: readonly PlanningAdult[],
): number {
  // If the timing owner matches the target adult's original owner, no shift needed
  if (timing.owner === targetAdult.owner) return 0
  // Find the adult who originally owns this timing
  const originalOwner = allAdults.find((a) => a.owner === timing.owner)
  if (!originalOwner) return 0
  return originalOwner.currentAge - targetAdult.currentAge
}

function remapTiming<T extends { timing: TimingRule }>(
  entry: T,
  ageDelta: number,
): T {
  return {
    ...entry,
    timing: { ...shiftTimingAges(entry.timing, ageDelta), owner: 'self' as AdultOwner },
  }
}

function remapTimingIfPresent<T extends { timing?: TimingRule }>(
  entry: T,
  ageDelta: number,
): T {
  if (entry.timing) {
    return {
      ...entry,
      timing: { ...shiftTimingAges(entry.timing, ageDelta), owner: 'self' as AdultOwner },
    } as T
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
    .map((entry) => {
      const delta = getTimingAgeDelta(entry.timing, targetAdult, plan.adults)
      return remapTiming(remapOwner(structuredClone(entry)), delta)
    })

  const adultExpenses = plan.expenses
    .filter((entry) => isOwnedByTarget(entry.owner) || entry.owner === 'shared')
    .map((entry) => {
      const delta = entry.timing ? getTimingAgeDelta(entry.timing, targetAdult, plan.adults) : 0
      return remapTimingIfPresent(remapOwner(structuredClone(entry)), delta)
    })

  const adultGoals = plan.goals
    .filter((entry) => isOwnedByTarget(entry.owner) || entry.owner === 'shared')
    .map((entry) => {
      const delta = getTimingAgeDelta(entry.timing, targetAdult, plan.adults)
      return remapTiming(remapOwner(structuredClone(entry)), delta)
    })

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
      .map((entry) => {
        const delta = getTimingAgeDelta(entry.timing, targetAdult, plan.adults)
        return remapTiming(remapOwner(structuredClone(entry)), delta)
      }),
    ...plan.income
      .filter((entry) => isShared(entry.owner))
      .map((entry) => {
        const delta = getTimingAgeDelta(entry.timing, targetAdult, plan.adults)
        return scaleIncomeSource(remapTiming(remapOwner(structuredClone(entry)), delta), splitRatio)
      }),
  ]

  // Expenses: include owned at full value + shared at splitRatio
  const adultExpenses = [
    ...plan.expenses
      .filter((entry) => isOwnedByTarget(entry.owner))
      .map((entry) => {
        const delta = entry.timing ? getTimingAgeDelta(entry.timing, targetAdult, plan.adults) : 0
        return remapTimingIfPresent(remapOwner(structuredClone(entry)), delta)
      }),
    ...plan.expenses
      .filter((entry) => isShared(entry.owner))
      .map((entry) => {
        const delta = entry.timing ? getTimingAgeDelta(entry.timing, targetAdult, plan.adults) : 0
        return scaleExpenseItem(remapTimingIfPresent(remapOwner(structuredClone(entry)), delta), splitRatio)
      }),
  ]

  // Goals: include owned at full value + shared at splitRatio
  const adultGoals = [
    ...plan.goals
      .filter((entry) => isOwnedByTarget(entry.owner))
      .map((entry) => {
        const delta = getTimingAgeDelta(entry.timing, targetAdult, plan.adults)
        return remapTiming(remapOwner(structuredClone(entry)), delta)
      }),
    ...plan.goals
      .filter((entry) => isShared(entry.owner))
      .map((entry) => {
        const delta = getTimingAgeDelta(entry.timing, targetAdult, plan.adults)
        return scaleGoalItem(remapTiming(remapOwner(structuredClone(entry)), delta), splitRatio)
      }),
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
